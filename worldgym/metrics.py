"""Frame-to-frame metrics used by the probes. All inputs are RGB uint8 (H, W, 3).

Everything here is classical CV (SSIM, ORB matching, Farneback flow) so it runs on a
laptop in real time. If WORLDGYM_EMBED_URL is set (see modal_app.py), `similarity`
also blends in DINOv2 embedding cosine similarity, which is far more robust to the
texture "re-imagining" world models do when you return to a place.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import cv2
import numpy as np
from skimage.metrics import structural_similarity

WORK_W = 320  # metrics run on downscaled greyscale frames


def _gray(frame: np.ndarray, width: int = WORK_W) -> np.ndarray:
    if frame.ndim == 3:
        g = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
    else:
        g = frame
    h = int(round(g.shape[0] * width / g.shape[1]))
    return cv2.resize(g, (width, max(h, 8)), interpolation=cv2.INTER_AREA)


def ssim(a: np.ndarray, b: np.ndarray) -> float:
    """Structural similarity in [0, 1] (clamped)."""
    ga, gb = _gray(a), _gray(b)
    if ga.shape != gb.shape:
        gb = cv2.resize(gb, (ga.shape[1], ga.shape[0]))
    v = structural_similarity(ga, gb, data_range=255)
    return float(np.clip(v, 0.0, 1.0))


@lru_cache(maxsize=1)
def _orb() -> Any:
    return cv2.ORB_create(nfeatures=1500, fastThreshold=10)


def orb_match_ratio(a: np.ndarray, b: np.ndarray, ratio: float = 0.75) -> float:
    """Fraction of ORB keypoints in `a` with a good (Lowe-ratio) match in `b`, in [0, 1].

    Geometric verification with RANSAC homography rejects coincidental matches, which
    matters for the repetitive textures world models like to produce.
    """
    ga, gb = _gray(a), _gray(b)
    orb = _orb()
    ka, da = orb.detectAndCompute(ga, None)
    kb, db = orb.detectAndCompute(gb, None)
    if da is None or db is None or len(ka) < 8 or len(kb) < 8:
        return 0.0
    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    knn = bf.knnMatch(da, db, k=2)
    good = [m for m, n in (p for p in knn if len(p) == 2) if m.distance < ratio * n.distance]
    if len(good) < 8:
        return 0.0
    pa = np.float32([ka[m.queryIdx].pt for m in good])
    pb = np.float32([kb[m.trainIdx].pt for m in good])
    _, mask = cv2.findHomography(pa, pb, cv2.RANSAC, 5.0)
    inliers = int(mask.sum()) if mask is not None else 0
    return float(np.clip(inliers / min(len(ka), len(kb)), 0.0, 1.0))


def flow_stats(a: np.ndarray, b: np.ndarray) -> dict[str, float]:
    """Dense optical flow a->b: mean dx, dy (px), mean magnitude and divergence sign.

    dx>0 means the scene moved right (camera panned/strafed left). div>0 means expansion
    (camera moving forward), div<0 contraction (camera moving back).
    """
    ga, gb = _gray(a), _gray(b)
    flow = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 3, 21, 3, 5, 1.2, 0)
    fx, fy = flow[..., 0], flow[..., 1]
    h, w = fx.shape
    ys, xs = np.mgrid[0:h, 0:w]
    rx, ry = xs - w / 2.0, ys - h / 2.0
    r = np.sqrt(rx**2 + ry**2) + 1e-6
    radial = (fx * rx + fy * ry) / r  # positive = moving away from centre
    return {
        "dx": float(fx.mean()),
        "dy": float(fy.mean()),
        "mag": float(np.sqrt(fx**2 + fy**2).mean()),
        "div": float(radial.mean()),
    }


def embed_similarity(a: np.ndarray, b: np.ndarray) -> float | None:
    """Cosine similarity of DINOv2 embeddings via an HTTP endpoint, or None if unset."""
    url = os.environ.get("WORLDGYM_EMBED_URL")
    if not url:
        return None
    try:
        import httpx  # lazy: optional at runtime

        def enc(f: np.ndarray) -> bytes:
            ok, buf = cv2.imencode(".jpg", f[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 90])
            return buf.tobytes()

        r = httpx.post(url, files={"a": enc(a), "b": enc(b)}, timeout=20.0)
        r.raise_for_status()
        return float(r.json()["cosine"])
    except Exception:
        return None


def similarity(a: np.ndarray, b: np.ndarray) -> dict[str, float]:
    """Composite similarity in [0, 1] plus its components."""
    s, o = ssim(a, b), orb_match_ratio(a, b)
    e = embed_similarity(a, b)
    if e is None:
        score = 0.5 * s + 0.5 * o
        out = {"score": score, "ssim": s, "orb": o}
    else:
        score = 0.3 * s + 0.3 * o + 0.4 * max(0.0, e)
        out = {"score": score, "ssim": s, "orb": o, "embed": e}
    return {k: round(float(v), 4) for k, v in out.items()}


def drift_curve(anchor: np.ndarray, frames: list[np.ndarray], every: int = 4) -> list[float]:
    """Composite similarity of every `every`-th frame to the anchor."""
    return [similarity(anchor, f)["score"] for f in frames[::every]]


def motion_onset(frames: list[np.ndarray], threshold: float = 0.35, stride: int = 2) -> int | None:
    """Index of the first frame whose flow magnitude vs the previous sampled frame exceeds
    threshold px, or None if motion never starts. Used for command->motion latency."""
    for i in range(stride, len(frames), stride):
        if flow_stats(frames[i - stride], frames[i])["mag"] > threshold:
            return i
    return None
