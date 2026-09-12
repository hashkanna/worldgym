"""Save frames as GIF/MP4/PNG and write probe results to results/<run>/."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import cv2
import imageio.v2 as imageio
import numpy as np

from .probes import ProbeResult


def _thumb(frame: np.ndarray, width: int = 320) -> np.ndarray:
    h = int(round(frame.shape[0] * width / frame.shape[1]))
    return cv2.resize(frame, (width, h), interpolation=cv2.INTER_AREA)


def save_gif(path: str | Path, frames: list[np.ndarray], fps: int = 12, every: int = 4, width: int = 320) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    sel = [_thumb(f, width) for f in frames[::every]] or [_thumb(frames[0], width)]
    imageio.mimsave(path, sel, duration=1.0 / fps, loop=0)
    return path


def save_mp4(path: str | Path, frames: list[np.ndarray], fps: int = 24) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with imageio.get_writer(path, fps=fps, codec="libx264", quality=7) as w:
        for f in frames:
            w.append_data(f)
    return path


def save_png(path: str | Path, frame: np.ndarray) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    imageio.imwrite(path, frame)
    return path


def save_run(
    out_dir: str | Path,
    model: str,
    results: list[ProbeResult],
    env_info: dict[str, Any] | None = None,
    gif_every: int = 4,
) -> Path:
    """Write results.json plus one GIF per probe; returns the run directory."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "model": model,
        "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "env": env_info or {},
        "probes": [],
    }
    for r in results:
        entry = r.to_json()
        if r.frames:
            gif = save_gif(out / f"{_slug(r.name)}.gif", r.frames, every=gif_every)
            entry["gif"] = gif.name
            save_png(out / f"{_slug(r.name)}_first.png", r.frames[0])
            save_png(out / f"{_slug(r.name)}_last.png", r.frames[-1])
            entry["first_png"] = f"{_slug(r.name)}_first.png"
            entry["last_png"] = f"{_slug(r.name)}_last.png"
        payload["probes"].append(entry)
    void = {"no_motion", "no_restyle"}  # probes whose premise didn't happen don't count
    scores = [p["score"] for p in payload["probes"] if not void & set(p.get("flags", []))]
    payload["overall"] = round(float(np.mean(scores)), 4) if scores else 0.0
    (out / "results.json").write_text(json.dumps(payload, indent=2))
    return out


def _slug(s: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in s).strip("_")
