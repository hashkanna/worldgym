"""HappyOyster (Adventure) on Reactor, driven through its Web SDK in headless Chrome.

The Reactor model `reactor/happy-oyster-adventure` only builds worlds and issues travel
credentials; the live video and the move/look controls flow directly between the HappyOyster
Web SDK and HappyOyster. So this backend runs that SDK in a headless Chrome page
(`happy_oyster_bridge/`) through Playwright, polls decoded frames out of its <video>, and maps
WorldEnv's reset commands (set_prompt, set_image, start) onto createWorld + startTravel.

Needs `pip install playwright`, Google Chrome, and `happy_oyster_bridge/happy-oyster.bundle.js`
(`npm install && npm run build` in that folder). Adventure travels are capped at 2 minutes.
"""

from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import os
import time
import urllib.request
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from . import FrameCallback, MessageCallback

BRIDGE = Path(__file__).parent / "happy_oyster_bridge"
ORIGIN = "https://worldgym.local"  # served from BRIDGE by request interception, so the page gets an https origin


def mint_jwt(model: str, api_key: str, ttl_s: int = 3600) -> str:
    body = json.dumps({
        "authorization_details": [{"type": "session", "resources": {"models": {"match": [model]}}}],
        "expires_after": ttl_s,
    }).encode()
    req = urllib.request.Request("https://api.reactor.inc/tokens", data=body, method="POST", headers={
        "Reactor-API-Key": api_key, "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())["jwt"]


class HappyOysterBackend:
    def __init__(
        self,
        model: str = "reactor/happy-oyster-adventure",
        api_key: str | None = None,
        perspective: str = "first_person",
        poll_hz: float = 60.0,
    ):
        self.model = model
        self._api_key = api_key or os.environ.get("REACTOR_API_KEY")
        if not self._api_key:
            raise RuntimeError("REACTOR_API_KEY not set (see .env.example)")
        self.perspective = perspective
        self._poll_s = 1.0 / poll_hz
        self._frame_cbs: list[FrameCallback] = []
        self._msg_cbs: list[MessageCallback] = []
        self._pw: Any = None
        self._browser: Any = None
        self._page: Any = None
        self._pump: asyncio.Task | None = None
        self._prompt: str | None = None
        self._image: str | bytes | None = None
        self._last_n: int | None = None
        self._t0 = time.monotonic()
        self.info: dict[str, Any] = {"dropped_frames": 0}

    # -- lifecycle ------------------------------------------------------------------
    async def connect(self) -> None:
        from playwright.async_api import async_playwright

        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch(
            channel="chrome", headless=True, args=["--autoplay-policy=no-user-gesture-required"]
        )
        self._page = await self._browser.new_page(viewport={"width": 800, "height": 600})
        self._page.on("console", self._on_console)

        async def serve(route: Any) -> None:
            path = BRIDGE / (route.request.url[len(ORIGIN):].lstrip("/") or "bridge.html")
            if not path.is_file():
                await route.fulfill(status=404, body="not found")
                return
            ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            await route.fulfill(status=200, body=path.read_bytes(), content_type=ctype)

        await self._page.route(f"{ORIGIN}/**", serve)
        await self._page.goto(f"{ORIGIN}/bridge.html")

    async def disconnect(self) -> None:
        if self._pump:
            self._pump.cancel()
        if self._page:
            try:
                await self._page.evaluate("() => window.hoEnd()")
            except Exception:  # noqa: BLE001
                pass
        for close in (self._browser.close if self._browser else None, self._pw.stop if self._pw else None):
            if close:
                try:
                    await close()
                except Exception:  # noqa: BLE001
                    pass

    # -- I/O -----------------------------------------------------------------------
    async def send(self, name: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        if name == "set_prompt":
            self._prompt = params.get("prompt")
            return None
        if name == "set_image":
            self._image = params.get("image")
            return None
        if name in ("set_seed", "reset"):  # HappyOyster has no seed; each reset builds a new world
            return None
        if name == "start":
            return await self._start()
        if name in ("move", "look", "stop"):
            sent = await self._page.evaluate("([n, a]) => window.hoControl(n, a)", [name, params.get("direction")])
            return {"type": "control", "data": {"command": name, "sent": sent}}
        raise ValueError(f"{self.model} has no command {name!r}")

    async def upload(self, source: str | bytes) -> Any:
        return source  # the image travels with createWorld

    def on_frame(self, cb: FrameCallback) -> None:
        self._frame_cbs.append(cb)

    def on_message(self, cb: MessageCallback) -> None:
        self._msg_cbs.append(cb)

    # -- internals -----------------------------------------------------------------
    async def _start(self) -> dict[str, Any]:
        if not self._prompt:
            raise RuntimeError("set_prompt before start")
        image_url = image_b64 = None
        if isinstance(self._image, str) and self._image.startswith(("http://", "https://")):
            image_url = self._image  # HappyOyster fetches it; uploaded files were refused upstream (400001)
        elif self._image is not None:
            data = Path(self._image).read_bytes() if isinstance(self._image, (str, Path)) else bytes(self._image)
            image_b64 = base64.b64encode(data).decode()
        args = {"prompt": self._prompt, "imageUrl": image_url, "imageB64": image_b64, "imageType": "image/jpeg",
                "perspective": self.perspective}
        for attempt in range(1, 31):
            args["jwt"] = await asyncio.to_thread(mint_jwt, self.model, self._api_key)
            try:
                self.info.update(await self._page.evaluate("(a) => window.hoStart(a)", args))
                break
            except Exception as e:  # noqa: BLE001
                if "429" not in str(e) or attempt == 30:
                    raise
                print(f"  Reactor at capacity (attempt {attempt}/30); retrying in 10s")
                await asyncio.sleep(10)
                await self._page.reload()
        self._emit({"type": "state", "data": {"started": True}})
        self._pump = asyncio.create_task(self._pump_frames())
        return dict(self.info)

    async def _pump_frames(self) -> None:
        last_events = time.monotonic()
        while True:
            try:
                got = await self._page.evaluate("() => window.hoGrab()")
                if time.monotonic() - last_events > 0.5:
                    for ev in await self._page.evaluate("() => window.hoEvents()"):
                        self._emit(ev)
                    last_events = time.monotonic()
            except Exception:  # noqa: BLE001  (page closed)
                return
            if not got:
                await asyncio.sleep(self._poll_s)
                continue
            if self._last_n is not None and got["n"] > self._last_n + 1:
                self.info["dropped_frames"] += got["n"] - self._last_n - 1
            self._last_n = got["n"]
            bgr = cv2.imdecode(np.frombuffer(base64.b64decode(got["jpg"]), np.uint8), cv2.IMREAD_COLOR)
            if bgr is None:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            t = time.monotonic() - self._t0
            for cb in self._frame_cbs:
                cb(rgb, t)

    def _on_console(self, msg: Any) -> None:
        if msg.type == "error":
            self._emit({"type": "console_error", "data": msg.text[:300]})

    def _emit(self, msg: dict[str, Any]) -> None:
        for cb in self._msg_cbs:
            cb(msg)
