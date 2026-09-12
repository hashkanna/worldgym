"""Dream Navigator (stretch goal): a VLM agent acting inside the world model.

Loop: look at the latest frame -> ask Claude for the next action given a text goal ->
env.step(action). Needs `pip install anthropic` and ANTHROPIC_API_KEY.

    python -m worldgym.agent --goal "walk to the red door" --steps 12
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
from typing import Any

import cv2
import numpy as np

from .actions import ACTIONS
from .backends import make_backend
from .env import WorldEnv

SYSTEM = (
    "You are controlling a first-person camera inside a generated world. Each turn you see the "
    "current view and must pick exactly one action to make progress toward the goal. "
    "Reply with JSON only: {\"action\": <one of %s>, \"why\": <short>} ." % list(ACTIONS)
)


def _jpeg_b64(frame: np.ndarray, max_w: int = 768) -> str:
    h = int(round(frame.shape[0] * max_w / frame.shape[1]))
    small = cv2.resize(frame, (max_w, h))
    ok, buf = cv2.imencode(".jpg", small[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buf.tobytes()).decode()


def choose_action(client: Any, goal: str, frame: np.ndarray, history: list[str]) -> tuple[str, str]:
    msg = client.messages.create(
        model=os.environ.get("WORLDGYM_AGENT_MODEL", "claude-sonnet-4-5"),
        max_tokens=100,
        system=SYSTEM,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": _jpeg_b64(frame)}},
                {"type": "text", "text": f"Goal: {goal}\nPrevious actions: {history[-6:]}\nPick the next action."},
            ],
        }],
    )
    text = "".join(getattr(b, "text", "") for b in msg.content).strip()
    try:
        data = json.loads(text[text.find("{") : text.rfind("}") + 1])
        action = data.get("action", "idle")
        why = str(data.get("why", ""))
    except Exception:
        action, why = "idle", f"unparseable: {text[:80]}"
    if action not in ACTIONS:
        action = "idle"
    return action, why


async def navigate(env: WorldEnv, goal: str, steps: int = 12, n_frames: int = 72) -> list[dict[str, Any]]:
    import anthropic  # lazy import: optional dependency

    client = anthropic.Anthropic()
    log: list[dict[str, Any]] = []
    history: list[str] = []
    for i in range(steps):
        frame = env.last_frame
        if frame is None:
            break
        # the Anthropic client is sync; keep the frame stream flowing while it thinks
        action, why = await asyncio.get_running_loop().run_in_executor(
            None, choose_action, client, goal, frame, list(history)
        )
        res = await env.step(action, n_frames)
        history.append(action)
        log.append({"step": i, "action": action, "why": why, "fps": round(res.fps, 1)})
        print(f"[{i:02d}] {action:13s} {why}")
    await env.hold("idle")
    return log


async def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--goal", required=True)
    ap.add_argument("--steps", type=int, default=12)
    ap.add_argument("--backend", default=os.environ.get("WORLDGYM_BACKEND", "reactor"))
    ap.add_argument("--model", default=os.environ.get("WORLDGYM_MODEL", "reactor/lingbot-world-2"))
    ap.add_argument("--image", default="assets/anchors/street.jpg")
    ap.add_argument("--prompt", default="a quiet residential street at golden hour, photoreal")
    args = ap.parse_args()
    backend = make_backend(args.backend, model=args.model)
    env = WorldEnv(backend)
    try:
        await env.reset(image=args.image, prompt=args.prompt, seed=42)
        log = await navigate(env, args.goal, steps=args.steps)
        print(json.dumps(log, indent=2))
    finally:
        await env.close()


if __name__ == "__main__":
    asyncio.run(_main())
