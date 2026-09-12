"""Live backend over the Reactor Python SDK (`pip install reactor-sdk`).

Mirrors the documented API (https://docs.reactor.inc/sdk-reference/python/reactor):

    reactor = Reactor(model_name="reactor/lingbot-world-2", api_key="rk_...")
    await reactor.connect()
    out = reactor.tracks.with_direction("recvonly").with_kind("video").one()
    @out.on_frame
    def cb(frame, frame_id, timestamp_us, user_data): ...   # frame: RGB uint8 (H, W, 3)
    ref = await reactor.upload_file("photo.jpg")
    await reactor.send_command("set_image", {"image": ref})

NOTE: this module has only been checked against the docs, not against a live session.
Run scripts/smoke_test.py first thing and fix any signature drift here, in one place.
"""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import numpy as np

from . import FrameCallback, MessageCallback

try:  # keep import optional so tests and the fake backend work without the SDK
    from reactor_sdk import Reactor  # type: ignore
except Exception:  # pragma: no cover - exercised only without the SDK installed
    Reactor = None  # type: ignore


class ReactorBackend:
    def __init__(
        self,
        model: str = "reactor/lingbot-world-2",
        api_key: str | None = None,
        max_session_duration_seconds: int | None = 3600,
    ):
        if Reactor is None:
            raise RuntimeError("reactor-sdk is not installed: pip install reactor-sdk")
        self.model = model
        self._api_key = api_key or os.environ.get("REACTOR_API_KEY")
        if not self._api_key:
            raise RuntimeError("REACTOR_API_KEY not set (see .env.example)")
        kwargs: dict[str, Any] = {"model_name": model, "api_key": self._api_key}
        if max_session_duration_seconds:
            kwargs["max_session_duration_seconds"] = max_session_duration_seconds
        self._kwargs = kwargs
        self._reactor = Reactor(**kwargs)
        self._frame_cbs: list[FrameCallback] = []
        self._msg_cbs: list[MessageCallback] = []
        self._t0 = time.monotonic()
        self.session_id: str | None = None

    # -- lifecycle ------------------------------------------------------------------
    async def connect(self, max_attempts: int = 30) -> None:
        for attempt in range(1, max_attempts + 1):
            self._reactor.on("message", self._dispatch_message)
            try:
                await self._reactor.connect()  # resolves when the session is ready
                break
            except Exception as e:  # noqa: BLE001
                # 429 "no available capacity" is routine when the platform is busy
                if (getattr(e, "status", None) != 429 and "429" not in str(e)) or attempt == max_attempts:
                    raise
                delay = max(10.0, (getattr(e, "retry_after_ms", None) or 0) / 1000)
                print(f"  Reactor at capacity (attempt {attempt}/{max_attempts}); retrying in {delay:.0f}s")
                await asyncio.sleep(delay)
                self._reactor = Reactor(**self._kwargs)  # fresh client rather than reusing a failed one
        self.session_id = getattr(self._reactor, "session_id", None)
        out = self._reactor.tracks.with_direction("recvonly").with_kind("video").one()

        @out.on_frame
        def _on_frame(frame, frame_id=None, timestamp_us=None, user_data=None):  # noqa: ANN001
            t = (timestamp_us / 1e6) if timestamp_us else (time.monotonic() - self._t0)
            arr = np.asarray(frame)
            for cb in self._frame_cbs:
                cb(arr, t)

    async def disconnect(self) -> None:
        try:
            await self._reactor.disconnect()
        except Exception:
            pass

    # -- I/O -----------------------------------------------------------------------
    async def send(self, name: str, params: dict[str, Any] | None = None) -> Any:
        return await self._reactor.send_command(name, params or {})

    async def upload(self, source: str | bytes) -> Any:
        return await self._reactor.upload_file(source)

    def on_frame(self, cb: FrameCallback) -> None:
        self._frame_cbs.append(cb)

    def on_message(self, cb: MessageCallback) -> None:
        self._msg_cbs.append(cb)

    def _dispatch_message(self, msg: Any) -> None:
        if not isinstance(msg, dict):
            msg = {"type": "raw", "data": msg}
        for cb in self._msg_cbs:
            cb(msg)

    # -- extras --------------------------------------------------------------------
    async def stats(self) -> dict[str, Any]:
        s = await self._reactor.get_stats()
        return {
            "rtt_ms": getattr(s, "rtt_ms", None),
            "incoming_bitrate_bps": getattr(s, "incoming_bitrate_bps", None),
        }

    async def download_clip(self, seconds: int = 10) -> bytes:
        return await self._reactor.download_clip(seconds)
