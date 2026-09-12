"""WorldEnv: a Gym-flavoured async wrapper over a real-time world model.

    env = WorldEnv(backend)
    await env.reset(image="street.jpg", prompt="a quiet street at dusk", seed=42)
    frames = await env.step("forward", n_frames=96)      # hold an action for N frames
    frames = await env.pose(pose_yaw(96, 360))           # exact per-frame camera deltas
    frame  = env.last_frame                               # RGB uint8 (H, W, 3)
    await env.close()

Frames arrive asynchronously from the backend; `step` returns the frames that arrived
while the action was held. Timing (frames/sec, command->motion latency) is tracked in
`env.info`.
"""

from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from .actions import ACTIONS, Command, commands_for, pose_frames
from .backends import Backend


@dataclass
class StepResult:
    action: str
    frames: list[np.ndarray]
    t_start: float
    t_end: float
    wall_seconds: float
    frame_count: int
    messages: list[dict[str, Any]] = field(default_factory=list)

    @property
    def fps(self) -> float:
        return self.frame_count / self.wall_seconds if self.wall_seconds > 0 else 0.0


class WorldEnv:
    def __init__(
        self,
        backend: Backend,
        keep_frames: int = 600,
        step_timeout: float = 30.0,
        store_width: int = 512,
    ):
        """Frames are stored downscaled to `store_width` (metrics run at 320 px anyway);
        the last full-resolution frame is kept separately as `last_frame_full`.
        1664x960 RGB is 4.8 MB a frame, so 600 full-res frames would be ~3 GB."""
        self.backend = backend
        self.model = backend.model
        self.store_width = store_width
        self.last_frame_full: np.ndarray | None = None
        self._frames: deque[tuple[np.ndarray, float]] = deque(maxlen=keep_frames)
        self._n_received = 0
        self._new_frame = asyncio.Event()
        self._messages: deque[dict[str, Any]] = deque(maxlen=512)
        self.state: dict[str, Any] = {}
        self.info: dict[str, Any] = {"model": backend.model, "steps": 0}
        self.step_timeout = step_timeout
        self._connected = False
        self._current_action = "idle"
        backend.on_frame(self._on_frame)
        backend.on_message(self._on_message)

    # -- callbacks ------------------------------------------------------------------
    def _on_frame(self, frame: np.ndarray, t: float) -> None:
        self.last_frame_full = frame
        if self.store_width and frame.shape[1] > self.store_width:
            h = int(round(frame.shape[0] * self.store_width / frame.shape[1]))
            frame = cv2.resize(frame, (self.store_width, h), interpolation=cv2.INTER_AREA)
        else:
            frame = np.ascontiguousarray(frame)
        self._frames.append((frame, t))
        self._n_received += 1
        self._new_frame.set()

    def _on_message(self, msg: dict[str, Any]) -> None:
        self._messages.append(msg)
        if msg.get("type") == "state" and isinstance(msg.get("data"), dict):
            self.state = msg["data"]

    # -- properties -----------------------------------------------------------------
    @property
    def last_frame(self) -> np.ndarray | None:
        return self._frames[-1][0] if self._frames else None

    @property
    def frames_received(self) -> int:
        return self._n_received

    @property
    def current_action(self) -> str:
        return self._current_action

    def recent_messages(self, kind: str | None = None) -> list[dict[str, Any]]:
        return [m for m in self._messages if kind is None or m.get("type") == kind]

    # -- lifecycle ------------------------------------------------------------------
    async def connect(self) -> None:
        if not self._connected:
            await self.backend.connect()
            self._connected = True

    async def reset(
        self,
        image: str | bytes | None = None,
        prompt: str | None = None,
        seed: int | None = None,
        warmup_frames: int = 24,
    ) -> np.ndarray:
        """Stage conditions and start generation. Returns the first frame after warm-up."""
        await self.connect()
        if self.state.get("started"):
            await self.backend.send("reset", {})
        if seed is not None:
            await self.backend.send("set_seed", {"seed": int(seed)})
        if image is not None:
            ref = await self.backend.upload(image)
            await self.backend.send("set_image", {"image": ref})
        if prompt is not None:
            await self.backend.send("set_prompt", {"prompt": prompt})
        for cmd in commands_for("idle", self.model):
            await self._send(cmd)
        self._frames.clear()
        self._n_received = 0
        t0 = time.monotonic()
        await self.backend.send("start", {})
        await self._wait_frames(warmup_frames)
        self.info["time_to_first_frame_s"] = round(time.monotonic() - t0, 3)
        if getattr(self.backend, "info", None) is not None:
            self.info["backend"] = self.backend.info  # e.g. world build time, dropped frames (kept live)
        self.info["steps"] = 0
        self._current_action = "idle"
        return self.last_frame  # type: ignore[return-value]

    async def close(self) -> None:
        if self._connected:
            await self.backend.disconnect()
            self._connected = False

    # -- actions --------------------------------------------------------------------
    async def step(self, action: str, n_frames: int = 96) -> StepResult:
        """Hold `action` until n_frames new frames have arrived, then leave it held.

        Movement/look are persistent on LingBot models, so the action stays active
        after this call returns. Call step("idle") (or another action) to change it.
        """
        if action not in ACTIONS:
            raise ValueError(f"unknown action {action!r}")
        start_idx = self._n_received
        t_start = time.monotonic()
        for cmd in commands_for(action, self.model):
            await self._send(cmd)
        self._current_action = action
        await self._wait_frames(n_frames, since=start_idx)
        t_end = time.monotonic()
        frames = self._frames_since(start_idx)
        self.info["steps"] += 1
        return StepResult(action, frames, t_start, t_end, t_end - t_start, len(frames))

    async def hold(self, action: str) -> None:
        """Set an action without waiting."""
        for cmd in commands_for(action, self.model):
            await self._send(cmd)
        self._current_action = action

    async def idle(self, n_frames: int = 0) -> StepResult | None:
        if n_frames:
            return await self.step("idle", n_frames)
        await self.hold("idle")
        return None

    async def pose(self, camera_pose: list[float], extra_frames: int = 12) -> StepResult:
        """Play an exact per-frame camera trajectory (LingBot World 2 `set_camera_pose`).

        Waits for len(pose)/6 + extra_frames frames (the extra covers chunk latency),
        then deactivates the pose by sending an empty list.
        """
        n = pose_frames(camera_pose)
        start_idx = self._n_received
        t_start = time.monotonic()
        await self.backend.send("set_camera_pose", {"camera_pose": list(map(float, camera_pose))})
        await self._wait_frames(n + extra_frames, since=start_idx)
        await self.backend.send("set_camera_pose", {"camera_pose": []})
        t_end = time.monotonic()
        frames = self._frames_since(start_idx)
        self.info["steps"] += 1
        return StepResult("camera_pose", frames, t_start, t_end, t_end - t_start, len(frames))

    async def set_prompt(self, prompt: str) -> None:
        await self.backend.send("set_prompt", {"prompt": prompt})

    async def wait_frames(self, n_frames: int) -> list[np.ndarray]:
        start_idx = self._n_received
        await self._wait_frames(n_frames, since=start_idx)
        return self._frames_since(start_idx)

    # -- internals ------------------------------------------------------------------
    async def _send(self, cmd: Command) -> Any:
        return await self.backend.send(cmd.name, cmd.params)

    async def _wait_frames(self, n: int, since: int | None = None) -> None:
        since = self._n_received if since is None else since
        deadline = time.monotonic() + self.step_timeout
        while self._n_received - since < n:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError(
                    f"waited {self.step_timeout}s for {n} frames, got {self._n_received - since}"
                )
            self._new_frame.clear()
            try:
                await asyncio.wait_for(self._new_frame.wait(), timeout=min(remaining, 1.0))
            except asyncio.TimeoutError:
                continue

    def _frames_since(self, start_idx: int) -> list[np.ndarray]:
        k = self._n_received - start_idx
        if k <= 0:
            return []
        k = min(k, len(self._frames))
        return [f for f, _ in list(self._frames)[-k:]]
