"""Diagnose whether movement commands take effect: hold an action for a long window,
print every model message (chunk_complete / state / command_error) and measure flow.

    python scripts/diag_motion.py --action forward --frames 240
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
from worldgym.metrics import flow_stats, similarity  # noqa: E402
from worldgym.recorder import save_gif, save_png  # noqa: E402


async def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=os.environ.get("WORLDGYM_MODEL", "reactor/lingbot-world-2"))
    ap.add_argument("--image", default="assets/anchors/street.jpg")
    ap.add_argument("--prompt", default="a quiet residential street at golden hour, photoreal")
    ap.add_argument("--action", default="forward")
    ap.add_argument("--frames", type=int, default=240)
    ap.add_argument("--out", default="results/diag")
    args = ap.parse_args()

    backend = make_backend("reactor", model=args.model)
    env = WorldEnv(backend, step_timeout=60.0)
    seen: list[dict] = []
    t0 = time.monotonic()

    def on_msg(m):
        seen.append(m)
        kind = m.get("type")
        if kind in ("chunk_complete", "command_error", "generation_started", "image_accepted", "prompt_accepted"):
            print(f"  [{time.monotonic() - t0:6.2f}s] {kind}: {json.dumps(m.get('data'))[:160]}")

    backend.on_message(on_msg)
    out = Path(args.out)
    try:
        first = await env.reset(image=args.image, prompt=args.prompt, seed=42)
        print(f"first frame {env.info['time_to_first_frame_s']}s shape={first.shape}")
        print(f"state: {json.dumps(env.state)[:400]}")
        save_png(out / "anchor.png", first)
        res = await env.step(args.action, args.frames)
        await env.hold("idle")
        print(f"{args.action}: {res.frame_count} frames in {res.wall_seconds:.2f}s ({res.fps:.1f} fps)")
        print(f"state after: {json.dumps(env.state)[:400]}")
        fr = res.frames
        n = len(fr)
        for a, b in [(0, n // 4), (n // 4, n // 2), (n // 2, 3 * n // 4), (3 * n // 4, n - 1)]:
            fs = flow_stats(fr[a], fr[b])
            print(f"  flow frames {a:3d}->{b:3d}: " + " ".join(f"{k}={v:+.2f}" for k, v in fs.items()))
        print(f"  similarity anchor->last: {similarity(first, fr[-1])}")
        save_png(out / f"{args.action}_last.png", fr[-1])
        save_gif(out / f"{args.action}.gif", fr, every=6)
        kinds = {}
        for m in seen:
            kinds[m.get("type")] = kinds.get(m.get("type"), 0) + 1
        print(f"messages seen: {kinds}")
        return 0
    finally:
        await env.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
