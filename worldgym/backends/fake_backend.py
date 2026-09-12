"""Offline procedural "world model" for developing and testing without GPU credits.

The world is a large textured plane seen through a virtual camera with state
(cx, cy, zoom). Actions move the camera; frames are affine crops of the texture, so a
perfect model has exact loop closure. `drift` injects a random walk into the camera
state and `hallucination` blends noise into frames, letting tests check that the probes
actually penalise inconsistency.

It also emulates Reactor's chunked command semantics: commands take effect at the next
chunk boundary, and `chunk_complete` / `state` messages are emitted.
"""

from __future__ import annotations

import asyncio
import io
import time
from typing import Any

import cv2
import numpy as np

from . import FrameCallback, MessageCallback


def _make_texture(size: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    tex = np.full((size, size, 3), 235, np.uint8)
    # coloured blobs
    for _ in range(400):
        c = tuple(int(v) for v in rng.integers(20, 235, 3))
        x, y = rng.integers(0, size, 2)
        r = int(rng.integers(10, 90))
        cv2.circle(tex, (int(x), int(y)), r, c, -1)
    # grid + text-like glyphs so ORB has corners
    for g in range(0, size, 96):
        cv2.line(tex, (g, 0), (g, size - 1), (60, 60, 60), 2)
        cv2.line(tex, (0, g), (size - 1, g), (60, 60, 60), 2)
    for _ in range(300):
        x, y = rng.integers(0, size - 60, 2)
        w, h = rng.integers(8, 50, 2)
        cv2.rectangle(tex, (int(x), int(y)), (int(x + w), int(y + h)), (0, 0, 0), 2)
    return tex


class FakeBackend:
    def __init__(
        self,
        model: str = "fake/lingbot-world-2",
        fps: int = 48,
        speed: float = 1.0,
        size: tuple[int, int] = (416, 240),
        chunk_frames: int = 12,
        drift: float = 0.0,
        hallucination: float = 0.0,
        seed: int = 0,
        texture_size: int = 2048,
    ):
        self.model = model
        self.fps = fps
        self.speed = speed
        self.size = size
        self.chunk_frames = chunk_frames
        self.drift = drift
        self.hallucination = hallucination
        self._rng = np.random.default_rng(seed)
        self._tex = _make_texture(texture_size, seed)
        self._frame_cbs: list[FrameCallback] = []
        self._msg_cbs: list[MessageCallback] = []
        self._task: asyncio.Task | None = None
        self._running = False
        self._paused = False
        self.connected = False
        self.sent: list[tuple[str, dict[str, Any]]] = []  # command log, handy in tests
        self._reset_state()

    # -- state ---------------------------------------------------------------------
    def _reset_state(self) -> None:
        n = self._tex.shape[0]
        self.cx, self.cy, self.zoom = n / 2.0, n / 2.0, 1.0
        self.prompt: str | None = None
        self.has_image = False
        self.seed = 42
        self.rotation_speed_deg = 5.0
        self._active = {"lon": "idle", "lat": "idle", "yaw": "idle", "pitch": "idle"}
        self._pending = dict(self._active)
        self._pose: list[float] = []
        self._pose_pending: list[float] | None = None
        self._pose_i = 0
        self.frame_num = 0
        self.chunk_num = 0

    # -- lifecycle ------------------------------------------------------------------
    async def connect(self) -> None:
        self.connected = True
        self._emit({"type": "state", "data": self.state()})

    async def disconnect(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        self.connected = False

    # -- I/O -----------------------------------------------------------------------
    async def upload(self, source: str | bytes) -> Any:
        if isinstance(source, (bytes, bytearray)):
            arr = cv2.imdecode(np.frombuffer(source, np.uint8), cv2.IMREAD_COLOR)
        else:
            arr = cv2.imread(str(source), cv2.IMREAD_COLOR)
        if arr is None:
            raise ValueError("could not decode image")
        return {"kind": "fake_file_ref", "image_bgr": arr}

    async def send(self, name: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        self.sent.append((name, params))
        if name == "set_prompt":
            self.prompt = str(params.get("prompt", ""))
            self._emit({"type": "prompt_accepted", "data": {"prompt": self.prompt}})
        elif name == "set_image":
            ref = params.get("image")
            if isinstance(ref, dict) and "image_bgr" in ref:
                img = ref["image_bgr"]
                n = self._tex.shape[0]
                tile = cv2.resize(img, (n // 2, n // 2))
                self._tex = np.tile(tile, (2, 2, 1))[..., ::-1].copy()  # BGR -> RGB
            self.has_image = True
            self._emit({"type": "image_accepted", "data": {"width": self.size[0], "height": self.size[1]}})
        elif name == "set_seed":
            self.seed = int(params.get("seed", 42))
        elif name == "start":
            if not (self.prompt and self.has_image) and "lingbot" in self.model:
                self._emit({"type": "command_error", "data": {"command": "start", "reason": "prompt and image required"}})
                return {"type": "command_error"}
            self._running, self._paused = True, False
            if self._task is None:
                self._task = asyncio.create_task(self._loop())
            self._emit({"type": "generation_started", "data": {"prompt": self.prompt, "chunk_num": 0, "frame_num": 0}})
        elif name == "pause":
            self._paused = True
        elif name == "resume":
            self._paused = False
        elif name == "reset":
            self._running = False
            self._reset_state()
            self._emit({"type": "generation_reset", "data": {"reason": "client"}})
        elif name == "set_move_longitudinal":
            self._pending["lon"] = params.get("move_longitudinal", "idle")
        elif name == "set_move_lateral":
            self._pending["lat"] = params.get("move_lateral", "idle")
        elif name == "set_movement":  # LingBot v1 single axis
            m = params.get("movement", "idle")
            self._pending["lon"] = m if m in ("forward", "back") else "idle"
            self._pending["lat"] = m if m in ("strafe_left", "strafe_right") else "idle"
        elif name == "set_look_horizontal":
            self._pending["yaw"] = params.get("look_horizontal", "idle")
        elif name == "set_look_vertical":
            self._pending["pitch"] = params.get("look_vertical", "idle")
        elif name == "set_rotation_speed_deg":
            self.rotation_speed_deg = float(params.get("rotation_speed_deg", 5.0))
        elif name == "set_camera_pose":
            pose = list(params.get("camera_pose", []) or [])
            if len(pose) % 6:
                self._emit({"type": "command_error", "data": {"command": name, "reason": "length % 6 != 0"}})
                return {"type": "command_error"}
            self._pose_pending = pose
        self._emit({"type": "state", "data": self.state()})
        return {"type": "ok", "data": {}}

    def on_frame(self, cb: FrameCallback) -> None:
        self._frame_cbs.append(cb)

    def on_message(self, cb: MessageCallback) -> None:
        self._msg_cbs.append(cb)

    def _emit(self, msg: dict[str, Any]) -> None:
        for cb in self._msg_cbs:
            cb(msg)

    def state(self) -> dict[str, Any]:
        return {
            "running": self._running and not self._paused,
            "started": self._running,
            "paused": self._paused,
            "has_image": self.has_image,
            "has_prompt": bool(self.prompt),
            "current_prompt": self.prompt,
            "current_chunk": self.chunk_num,
            # the snapshot reports the *commanded* values; they take effect at the next chunk
            "move_longitudinal": self._pending["lon"],
            "move_lateral": self._pending["lat"],
            "look_horizontal": self._pending["yaw"],
            "look_vertical": self._pending["pitch"],
            "rotation_speed_deg": self.rotation_speed_deg,
            "camera_pose_active": (
                bool(self._pose_pending) if self._pose_pending is not None
                else bool(self._pose) and self._pose_i < len(self._pose)
            ),
            "seed": self.seed,
        }

    # -- simulation -----------------------------------------------------------------
    def _apply_boundary(self) -> None:
        self._active = dict(self._pending)
        if self._pose_pending is not None:
            self._pose, self._pose_i = self._pose_pending, 0
            self._pose_pending = None

    def _advance(self) -> None:
        v_move, v_look, v_zoom = 4.0, 4.0 * (self.rotation_speed_deg / 5.0), 1.01
        n = self._tex.shape[0]
        px_per_rad = n / (2.0 * np.pi)  # a full 360 deg yaw pans exactly one texture width
        # camera pose has priority: rotation overrides look, translation adds to WASD
        if self._pose and self._pose_i < len(self._pose):
            rx, ry, rz, tx, ty, tz = self._pose[self._pose_i : self._pose_i + 6]
            self._pose_i += 6
            self.cx += ry * px_per_rad  # yaw -> horizontal pan (wraps: the world is a cylinder)
            self.cy += rx * px_per_rad  # pitch -> vertical pan
            self.cx += tx * 40.0
            self.cy += ty * 40.0
            self.zoom *= float(np.exp(tz * 0.02))
        else:
            if self._active["yaw"] == "left":
                self.cx -= v_look
            elif self._active["yaw"] == "right":
                self.cx += v_look
            if self._active["pitch"] == "up":
                self.cy -= v_look
            elif self._active["pitch"] == "down":
                self.cy += v_look
        if self._active["lon"] == "forward":
            self.zoom *= v_zoom
        elif self._active["lon"] == "back":
            self.zoom /= v_zoom
        if self._active["lat"] == "strafe_left":
            self.cx -= v_move
        elif self._active["lat"] == "strafe_right":
            self.cx += v_move
        if self.drift > 0:
            self.cx += float(self._rng.normal(0, self.drift))
            self.cy += float(self._rng.normal(0, self.drift))
            self.zoom *= float(np.exp(self._rng.normal(0, self.drift / 200.0)))
        self.cx = float(self.cx % n)  # horizontal wrap (BORDER_WRAP in render makes this seamless)
        self.cy = float(np.clip(self.cy, 200, n - 200))
        self.zoom = float(np.clip(self.zoom, 0.3, 6.0))

    def render(self) -> np.ndarray:
        w, h = self.size
        s = self.zoom
        m = np.array([[s, 0, w / 2 - s * self.cx], [0, s, h / 2 - s * self.cy]], np.float32)
        frame = cv2.warpAffine(self._tex, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
        if self.hallucination > 0:
            noise = self._rng.normal(0, 255 * self.hallucination, frame.shape)
            frame = np.clip(frame.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        return frame

    async def _loop(self) -> None:
        t0 = time.monotonic()
        dt = 1.0 / (self.fps * self.speed)
        while self.connected:
            if self._running and not self._paused:
                if self.frame_num % self.chunk_frames == 0:
                    self._apply_boundary()
                self._advance()
                frame = self.render()
                t = self.frame_num / self.fps
                for cb in self._frame_cbs:
                    cb(frame, t)
                self.frame_num += 1
                if self.frame_num % self.chunk_frames == 0:
                    self.chunk_num += 1
                    self._emit({
                        "type": "chunk_complete",
                        "data": {
                            "chunk_index": self.chunk_num - 1,
                            "active_action": ",".join(v for v in self._active.values() if v != "idle") or "still",
                            "active_prompt": self.prompt,
                            "frames_emitted": self.chunk_frames,
                        },
                    })
            await asyncio.sleep(dt)
        _ = t0


def encode_jpeg(frame_rgb: np.ndarray, quality: int = 85) -> bytes:
    ok, buf = cv2.imencode(".jpg", frame_rgb[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("jpeg encode failed")
    return io.BytesIO(buf.tobytes()).getvalue()
