"""Futures tree: same anchor image + seed, N parallel sessions, different action scripts.
Produces a tiled GIF showing branching futures from one moment. Reactor allows 5
concurrent sessions per account; keep --branches <= 4 to leave one for the demo UI.

    python scripts/futures_tree.py --branches 4
    python scripts/futures_tree.py --backend fake --branches 4
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402

from worldgym import WorldEnv  # noqa: E402
from worldgym.backends import make_backend  # noqa: E402
from worldgym.recorder import save_gif  # noqa: E402

SCRIPTS = [
    ["forward", "forward", "look_left"],
    ["forward", "strafe_left", "forward"],
    ["look_right", "forward", "forward"],
    ["back", "look_left", "forward"],
]


async def branch(i: int, script: list[str], args: argparse.Namespace) -> list[np.ndarray]:
    kw = {"speed": 4.0, "seed": 0} if args.backend == "fake" else {}
    env = WorldEnv(make_backend(args.backend, model=args.model, **kw), step_timeout=90.0)
    try:
        await env.reset(image=args.image, prompt=args.prompt, seed=args.seed)
        frames: list[np.ndarray] = []
        for a in script:
            res = await env.step(a, args.frames)
            frames += res.frames
        await env.hold("idle")
        print(f"  branch {i}: {script} -> {len(frames)} frames")
        return frames
    finally:
        await env.close()


def tile(branches: list[list[np.ndarray]], width: int = 320, label: bool = True) -> list[np.ndarray]:
    n = min(len(b) for b in branches)
    cols = 2 if len(branches) > 1 else 1
    out = []
    for t in range(0, n, 4):
        tiles = []
        for i, b in enumerate(branches):
            f = b[t]
            h = int(round(f.shape[0] * width / f.shape[1]))
            f = cv2.resize(f, (width, h))
            if label:
                f = f.copy()
                cv2.putText(f, " > ".join(SCRIPTS[i]), (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
            tiles.append(f)
        while len(tiles) % cols:
            tiles.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(tiles[r : r + cols]) for r in range(0, len(tiles), cols)]
        out.append(np.vstack(rows))
    return out


async def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", default=os.environ.get("WORLDGYM_BACKEND", "reactor"))
    ap.add_argument("--model", default=os.environ.get("WORLDGYM_MODEL", "reactor/lingbot-world-2"))
    ap.add_argument("--image", default="assets/anchors/street.jpg")
    ap.add_argument("--prompt", default="a quiet residential street at golden hour, photoreal")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--branches", type=int, default=4)
    ap.add_argument("--frames", type=int, default=72, help="frames per action")
    ap.add_argument("--out", default="results/futures_tree.gif")
    args = ap.parse_args()
    scripts = SCRIPTS[: max(1, min(args.branches, len(SCRIPTS)))]
    print(f"spawning {len(scripts)} branches on {args.model} ...")
    branches = await asyncio.gather(*(branch(i, s, args) for i, s in enumerate(scripts)))
    frames = tile(list(branches))
    save_gif(args.out, frames, every=1, width=frames[0].shape[1])
    print(f"saved {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
