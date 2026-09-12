"""Discrete action vocabulary and camera-pose trajectory builders.

Command names/enums follow the Reactor docs for LingBot World 2
(https://docs.reactor.inc/model-api-reference/lingbot-world-2/schema) and LingBot
(https://docs.reactor.inc/model-api-reference/lingbot/schema).

LingBot World 2 movement/look are *persistent state*: a value stays active until you
send "idle". Commands take effect at chunk boundaries, so hold every action for at
least ~1-2 s (48-96 frames at 48 fps) if you want to see it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

Action = Literal[
    "idle",
    "forward",
    "back",
    "strafe_left",
    "strafe_right",
    "look_left",
    "look_right",
    "look_up",
    "look_down",
]

ACTIONS: tuple[Action, ...] = (
    "idle",
    "forward",
    "back",
    "strafe_left",
    "strafe_right",
    "look_left",
    "look_right",
    "look_up",
    "look_down",
)

# Expected optical-flow signature of each action, used by the controllability probe.
#   "dx"/"dy": sign of mean scene flow (scene moves opposite to camera).
#   "div":     sign of flow divergence (forward -> expansion, back -> contraction).
EXPECTED_FLOW: dict[str, dict[str, int]] = {
    "forward": {"div": +1},
    "back": {"div": -1},
    "strafe_left": {"dx": +1},
    "strafe_right": {"dx": -1},
    "look_left": {"dx": +1},
    "look_right": {"dx": -1},
    "look_up": {"dy": +1},
    "look_down": {"dy": -1},
}

# Inverse actions, for loop-closure probes.
INVERSE: dict[str, str] = {
    "forward": "back",
    "back": "forward",
    "strafe_left": "strafe_right",
    "strafe_right": "strafe_left",
    "look_left": "look_right",
    "look_right": "look_left",
    "look_up": "look_down",
    "look_down": "look_up",
    "idle": "idle",
}


@dataclass(frozen=True)
class Command:
    name: str
    params: dict


def _idle_all_v2() -> list[Command]:
    return [
        Command("set_move_longitudinal", {"move_longitudinal": "idle"}),
        Command("set_move_lateral", {"move_lateral": "idle"}),
        Command("set_look_horizontal", {"look_horizontal": "idle"}),
        Command("set_look_vertical", {"look_vertical": "idle"}),
    ]


def commands_for(action: str, model: str = "reactor/lingbot-world-2") -> list[Command]:
    """Translate a discrete action into the model's persistent-state commands.

    Every call first clears all axes, then sets the one axis the action needs, so the
    env never has two axes accidentally held at once.
    """
    if action not in ACTIONS:
        raise ValueError(f"unknown action {action!r}; choose from {ACTIONS}")

    if model.endswith("lingbot-world-2"):
        cmds = _idle_all_v2()
        if action == "forward":
            cmds.append(Command("set_move_longitudinal", {"move_longitudinal": "forward"}))
        elif action == "back":
            cmds.append(Command("set_move_longitudinal", {"move_longitudinal": "back"}))
        elif action == "strafe_left":
            cmds.append(Command("set_move_lateral", {"move_lateral": "strafe_left"}))
        elif action == "strafe_right":
            cmds.append(Command("set_move_lateral", {"move_lateral": "strafe_right"}))
        elif action == "look_left":
            cmds.append(Command("set_look_horizontal", {"look_horizontal": "left"}))
        elif action == "look_right":
            cmds.append(Command("set_look_horizontal", {"look_horizontal": "right"}))
        elif action == "look_up":
            cmds.append(Command("set_look_vertical", {"look_vertical": "up"}))
        elif action == "look_down":
            cmds.append(Command("set_look_vertical", {"look_vertical": "down"}))
        return cmds

    if model.endswith("lingbot"):
        # LingBot v1 has a single set_movement axis.
        cmds = [
            Command("set_movement", {"movement": "idle"}),
            Command("set_look_horizontal", {"look_horizontal": "idle"}),
            Command("set_look_vertical", {"look_vertical": "idle"}),
        ]
        if action in ("forward", "back", "strafe_left", "strafe_right"):
            cmds.append(Command("set_movement", {"movement": action}))
        elif action in ("look_left", "look_right"):
            cmds.append(Command("set_look_horizontal", {"look_horizontal": action.split("_")[1]}))
        elif action in ("look_up", "look_down"):
            cmds.append(Command("set_look_vertical", {"look_vertical": action.split("_")[1]}))
        return cmds

    raise ValueError(f"no action mapping for model {model!r}")


# --------------------------------------------------------------------------------------
# Camera-pose trajectories (LingBot World 2 only)
#
# set_camera_pose takes a flat list of per-frame deltas [rx, ry, rz, tx, ty, tz] * N,
# N <= 256 (max length 1536). Rotations are small Euler angles in radians, translation is
# in the camera-local frame, y-axis is DOWN (negative ty = up). Rotation overrides look
# commands; translation adds to WASD movement. An empty list deactivates the pose.
# --------------------------------------------------------------------------------------

MAX_POSE_FRAMES = 256


def pose_translate(n_frames: int, tz: float = 0.0, tx: float = 0.0, ty: float = 0.0) -> list[float]:
    """Constant per-frame translation for n_frames (e.g. tz>0 drives forward)."""
    n_frames = max(1, min(int(n_frames), MAX_POSE_FRAMES))
    return [0.0, 0.0, 0.0, float(tx), float(ty), float(tz)] * n_frames


def pose_yaw(n_frames: int, total_deg: float) -> list[float]:
    """Rotate about the camera's vertical axis by total_deg spread evenly over n_frames."""
    n_frames = max(1, min(int(n_frames), MAX_POSE_FRAMES))
    per = math.radians(total_deg) / n_frames
    return [0.0, per, 0.0, 0.0, 0.0, 0.0] * n_frames


def pose_out_and_back(n_frames: int, tz: float) -> list[float]:
    """Drive forward for n_frames then back for n_frames (2*n_frames <= 256)."""
    n_frames = max(1, min(int(n_frames), MAX_POSE_FRAMES // 2))
    return pose_translate(n_frames, tz=tz) + pose_translate(n_frames, tz=-tz)


def pose_frames(pose: list[float]) -> int:
    if len(pose) % 6:
        raise ValueError("camera_pose length must be a multiple of 6")
    return len(pose) // 6
