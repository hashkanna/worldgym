"""Check set_camera_pose semantics on the live model: does an exact yaw play, when does
it start, and does it stop on its own?

    python scripts/diag_pose.py --deg 90 --frames 96
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402

from worldgym import WorldEnv  # noqa: E402
from worldgym.actions import pose_yaw  # noqa: E402
from worldgym.backends import make_backend  # noqa: E402
from worldgym.metrics import flow_stats, similarity  # noqa: E402
from worldgym.recorder import save_gif, save_png  # noqa: E402


async def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.environ.get("WORLDGYM_MODEL", "reactor/lingbot-world-2"))
    ap.add_argument("--image", default="assets/anchors/street.jpg")
    ap.add_argument("--prompt", default="a quiet residential street at golden hour, photoreal")
    ap.add_argument("--deg", type=float, default=90.0)
    ap.add_argument("--frames", type=int, default=96)
    ap.add_argument("--extra", type=int, default=192, help="extra frames to wait after the pose length")
    ap.add_argument("--out", default="results/diag")
    args = ap.parse_args()

    backend = make_backend("reactor", model=args.model)
    env = WorldEnv(backend, step_timeout=60.0)
    t0 = time.monotonic()

    def on_msg(m):
        kind = m.get("type")
        if kind == "chunk_complete":
            d = m.get("data", {})
            print(f"  [{time.monotonic() - t0:6.2f}s] chunk {int(d.get('chunk_index', -1))} action={d.get('active_action')}")
        elif kind == "command_error":
            print(f"  [{time.monotonic() - t0:6.2f}s] command_error: {json.dumps(m.get('data'))}")
        elif kind == "state":
            d = m.get("data", {})
            print(f"  [{time.monotonic() - t0:6.2f}s] state: pose_active={d.get('camera_pose_active')} action={d.get('current_action')}")

    backend.on_message(on_msg)
    out = Path(args.out)
    try:
        first = await env.reset(image=args.image, prompt=args.prompt, seed=42)
        await env.step("idle", 48)
        anchor = env.last_frame
        pose = pose_yaw(args.frames, args.deg)
        print(f"sending pose: {len(pose)//6} frames, {args.deg} deg total; waiting {len(pose)//6 + args.extra} frames")
        res = await env.pose(pose, extra_frames=args.extra)
        fr = res.frames
        n = len(fr)
        print(f"got {n} frames in {res.wall_seconds:.2f}s")
        step = max(1, n // 8)
        for a in range(0, n - step, step):
            fs = flow_stats(fr[a], fr[a + step])
            print(f"  flow {a:3d}->{a + step:3d}: dx={fs['dx']:+.2f} dy={fs['dy']:+.2f} mag={fs['mag']:.2f}")
        print(f"  similarity anchor->last: {similarity(anchor, fr[-1])}")
        save_png(out / "pose_anchor.png", anchor)
        save_png(out / "pose_last.png", fr[-1])
        save_gif(out / "pose.gif", fr, every=6)
        return 0
    finally:
        await env.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
