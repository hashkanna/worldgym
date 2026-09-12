"""Backends turn a world model (live or fake) into a uniform async interface.

    backend.connect()                  -> session ready
    backend.send(name, params)         -> model command (set_prompt, start, ...)
    backend.upload(path_or_bytes)      -> file ref usable in set_image
    backend.on_frame(cb)               -> cb(frame_rgb_uint8_hwc, t_seconds)
    backend.on_message(cb)             -> cb({"type": ..., "data": ...})
    backend.disconnect()
"""

from __future__ import annotations

from typing import Any, Callable, Protocol

import numpy as np

FrameCallback = Callable[[np.ndarray, float], None]
MessageCallback = Callable[[dict[str, Any]], None]


class Backend(Protocol):
    model: str

    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...
    async def send(self, name: str, params: dict[str, Any] | None = None) -> Any: ...
    async def upload(self, source: str | bytes) -> Any: ...
    def on_frame(self, cb: FrameCallback) -> None: ...
    def on_message(self, cb: MessageCallback) -> None: ...


def make_backend(kind: str = "reactor", model: str | None = None, **kw: Any) -> Backend:
    if kind == "fake":
        from .fake_backend import FakeBackend

        return FakeBackend(model=model or "fake/lingbot-world-2", **kw)
    if kind == "reactor":
        if model and "happy-oyster" in model:  # controls + video go through the HappyOyster Web SDK
            from .happy_oyster_backend import HappyOysterBackend

            return HappyOysterBackend(model=model, **kw)
        from .reactor_backend import ReactorBackend

        return ReactorBackend(model=model or "reactor/lingbot-world-2", **kw)
    raise ValueError(f"unknown backend kind {kind!r}")
