"""First thing to run against a live Reactor session (costs a few seconds of credits).

    python scripts/smoke_test.py --image assets/anchors/street.jpg
    python scripts/smoke_test.py --backend fake            # offline sanity check

Checks: connect -> upload image -> set_prompt -> start -> receive frames -> hold
`forward` for 2s -> measure fps and command->motion latency -> save PNGs + a GIF.
Fix any SDK signature drift in worldgym/backends/reactor_backend.py.
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
from worldgym.backends import make_backend  # noqa: E402
from worldgym.metrics import flow_stats, motion_onset  # noqa: E402
from worldgym.recorder import save_gif, save_png  # noqa: E402


async def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", default=os.environ.get("WORLDGYM_BACKEND", "reactor"))
    ap.add_argument("--model", default=os.environ.get("WORLDGYM_MODEL", "reactor/lingbot-world-2"))
    ap.add_argument("--image", default="assets/anchors/street.jpg")
    ap.add_argument("--prompt", default="a quiet residential street at golden hour, photoreal")
    ap.add_argument("--out", default="results/smoke")
    args = ap.parse_args()

    kw = {"speed": 4.0} if args.backend == "fake" else {}
    backend = make_backend(args.backend, model=args.model, **kw)
    env = WorldEnv(backend, step_timeout=60.0)
    out = Path(args.out)
    t0 = time.monotonic()
    try:
        print(f"connecting to {args.model} via {args.backend} backend ...")
        first = await env.reset(image=args.image, prompt=args.prompt, seed=42)
        print(f"  first frame after {env.info['time_to_first_frame_s']}s, shape={first.shape}, dtype={first.dtype}")
        save_png(out / "first.png", first)

        idle = await env.step("idle", 48)
        print(f"  idle: {idle.frame_count} frames in {idle.wall_seconds:.2f}s ({idle.fps:.1f} fps)")

        fwd = await env.step("forward", 96)
        await env.hold("idle")
        onset = motion_onset(fwd.frames)
        fs = flow_stats(fwd.frames[len(fwd.frames) // 2], fwd.frames[-1]) if len(fwd.frames) > 2 else {}
        print(f"  forward: {fwd.frame_count} frames in {fwd.wall_seconds:.2f}s ({fwd.fps:.1f} fps); "
              f"motion onset at frame {onset}; flow={ {k: round(v, 2) for k, v in fs.items()} }")
        save_png(out / "after_forward.png", fwd.frames[-1])
        save_gif(out / "forward.gif", fwd.frames)
        print(f"  state: {json.dumps(env.state)[:300]}")
        report = {
            "model": args.model, "backend": args.backend, "frame_shape": list(first.shape),
            "time_to_first_frame_s": env.info["time_to_first_frame_s"],
            "idle_fps": round(idle.fps, 1), "forward_fps": round(fwd.fps, 1), "motion_onset_frame": onset,
            "flow_forward": fs, "wall_total_s": round(time.monotonic() - t0, 1),
        }
        out.mkdir(parents=True, exist_ok=True)
        (out / "smoke.json").write_text(json.dumps(report, indent=2))
        print(f"OK  -> {out}/ (first.png, after_forward.png, forward.gif, smoke.json)")
        return 0
    finally:
        await env.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
