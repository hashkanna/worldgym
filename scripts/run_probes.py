"""Run the probe suite against one model and write results/<run>/ + dashboard.

    python scripts/run_probes.py --model reactor/lingbot-world-2 --image assets/anchors/street.jpg
    python scripts/run_probes.py --backend fake --run fake-clean
    python scripts/run_probes.py --backend fake --drift 3 --hallucination 0.05 --run fake-drifty
    python scripts/run_probes.py --probes stillness,controllability      # subset

Then open dashboard/index.html.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402

from worldgym import WorldEnv  # noqa: E402
from worldgym.backends import make_backend  # noqa: E402
from worldgym.probes import DEFAULT_SUITE, run_suite  # noqa: E402
from worldgym.recorder import save_run  # noqa: E402
from worldgym.scorecard import build  # noqa: E402


async def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", default=os.environ.get("WORLDGYM_BACKEND", "reactor"))
    ap.add_argument("--model", default=os.environ.get("WORLDGYM_MODEL", "reactor/lingbot-world-2"))
    ap.add_argument("--image", default="assets/anchors/street.jpg")
    ap.add_argument("--prompt", default="a quiet residential street at golden hour, photoreal")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--probes", default=",".join(DEFAULT_SUITE))
    ap.add_argument("--run", default=None, help="run name (default: <model>-<timestamp>)")
    ap.add_argument("--no-pose", action="store_true", help="use held look/move instead of set_camera_pose")
    ap.add_argument("--short", action="store_true", help="halve frame counts (quicker, noisier)")
    # fake-backend knobs
    ap.add_argument("--drift", type=float, default=0.0)
    ap.add_argument("--hallucination", type=float, default=0.0)
    ap.add_argument("--speed", type=float, default=4.0)
    args = ap.parse_args()

    kw = {"drift": args.drift, "hallucination": args.hallucination, "speed": args.speed} if args.backend == "fake" else {}
    backend = make_backend(args.backend, model=args.model, **kw)
    env = WorldEnv(backend, step_timeout=90.0)
    names = tuple(p.strip() for p in args.probes.split(",") if p.strip())
    scale = 0.5 if args.short else 1.0
    live = args.backend != "fake"
    # Live LingBot World 2: ~1.5-3 s command latency, 24-frame chunks -> long holds.
    overrides = {
        "loop_closure": {"n_frames": int((192 if live else 48) * scale), "use_pose": False,
                         "settle_frames": int((192 if live else 16) * scale)},
        "turn_closure": {"n_frames": int((192 if live else 48) * scale),
                         "settle_frames": int((192 if live else 16) * scale)},
        "rotation_closure": {"n_frames": int((192 if live else 96) * scale),
                             "use_pose": not args.no_pose and "lingbot-world-2" in args.model,
                             "settle_frames": int((192 if live else 24) * scale)},
        "stillness": {"n_frames": int(144 * scale)},
        "controllability": {"n_frames": int((240 if live else 40) * scale), "settle_frames": int((96 if live else 8) * scale)},
        "prompt_stability": {"new_prompt": "the same street at night in heavy rain, neon reflections", "n_frames": int(144 * scale)},
    }
    run_name = args.run or f"{args.model.split('/')[-1]}-{time.strftime('%H%M%S')}"
    try:
        print(f"[{run_name}] reset {args.model} ...")
        await env.reset(image=args.image, prompt=args.prompt, seed=args.seed)
        print(f"  first frame in {env.info['time_to_first_frame_s']}s")
        results = await run_suite(env, names, **overrides)
        for r in results:
            print(f"  {r.name:28s} {r.score:.2f}  {' '.join(r.flags)}  ({r.wall_seconds:.1f}s, {len(r.frames)} frames)")
        out = save_run(Path("results") / run_name, args.model, results, env.info)
        page = build("results", "dashboard/index.html")
        print(f"saved {out}/results.json ; scorecard -> {page}")
        return 0
    finally:
        await env.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
