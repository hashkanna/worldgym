"""Physics-consistency probes. Each probe drives the env through a scripted action
sequence and returns a ProbeResult with a score in [0, 1], details and the frames to
render as a GIF.

Probes
------
loop_closure      forward N, back N. Did we get home? (also reports how far we went, so a
                  model that never moves can't score by standing still)
turn_closure      look left N, look right N. Does the view come back? Same command both
                  ways, so the lag and the unknown degrees-per-frame cancel out.
rotation_closure  yaw 360 deg via camera pose. Uncalibrated on live LingBot World 2: the
                  pose is a per-latent-frame velocity bias, so the turn isn't really 360 deg.
stillness         hold idle. How much does the scene drift with no input?
controllability   for each action: does the optical flow match the commanded direction,
                  and how many frames until motion starts?
prompt_stability  hot-swap the prompt. Does the scene layout survive a restyle?
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from . import metrics
from .actions import EXPECTED_FLOW, INVERSE, pose_out_and_back, pose_yaw
from .env import WorldEnv


@dataclass
class ProbeResult:
    name: str
    score: float
    details: dict[str, Any] = field(default_factory=dict)
    frames: list[np.ndarray] = field(default_factory=list)
    wall_seconds: float = 0.0
    flags: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "score": round(float(self.score), 4),
            "details": self.details,
            "flags": self.flags,
            "wall_seconds": round(self.wall_seconds, 2),
            "n_frames": len(self.frames),
        }


def _combine(closure: float, moved: float, min_move: float = 0.15) -> tuple[float, list[str]]:
    """Closure only counts if the excursion actually changed the view."""
    flags: list[str] = []
    if moved < min_move:
        flags.append("no_motion")  # model ignored the action; closure is meaningless
        return 0.0, flags
    return closure, flags


def _peak_closure(anchor: np.ndarray, tail: list[np.ndarray], every: int = 4) -> tuple[dict[str, float], int]:
    """Best similarity to the anchor over the tail frames, and the index it occurred at.

    Live models act on commands with a 1-3 s lag and keep moving a little after a
    trajectory ends, so 'the last frame' is a noisy place to measure. 'Did the world
    ever come back?' is the question, and this answers it."""
    best, best_i = {"score": 0.0, "ssim": 0.0, "orb": 0.0}, 0
    for i in range(0, len(tail), every):
        s = metrics.similarity(anchor, tail[i])
        if s["score"] > best["score"]:
            best, best_i = s, i
    return best, best_i


async def loop_closure(
    env: WorldEnv,
    action: str = "forward",
    n_frames: int = 192,
    use_pose: bool = False,
    pose_tz: float = 0.5,
    settle_frames: int = 192,
) -> ProbeResult:
    """Out N frames, back N frames, then settle. Live latency on LingBot World 2 is
    ~1.5-3 s (72-144 frames) per command, so n_frames < 144 mostly measures lag, and the
    settle has to outlast the lag or the return leg gets cut off."""
    t0 = time.monotonic()
    anchor = env.last_frame
    if anchor is None:
        raise RuntimeError("env has no frame yet; call reset() first")
    frames: list[np.ndarray] = []
    if use_pose:
        res = await env.pose(pose_out_and_back(n_frames, pose_tz), extra_frames=settle_frames)
        frames = res.frames
    else:
        out = await env.step(action, n_frames)
        back = await env.step(INVERSE[action], n_frames)
        settle = await env.step("idle", settle_frames)
        frames = out.frames + back.frames + settle.frames
    end = frames[-1] if frames else anchor
    # excursion = the furthest the view got from the anchor (min similarity over the
    # outbound half); robust to command lag on live models
    curve = metrics.drift_curve(anchor, frames[: max(1, len(frames) // 2)], every=max(1, len(frames) // 24))
    excursion = min(curve, key=lambda v: v) if curve else 1.0
    excursion = {"score": round(float(excursion), 4)}
    closure_end = metrics.similarity(anchor, end)
    tail = frames[len(frames) // 2 :]
    closure_peak, peak_i = _peak_closure(anchor, tail)
    moved = 1.0 - excursion["score"]
    score, flags = _combine(closure_peak["score"], moved)
    return ProbeResult(
        name=f"loop_closure[{'pose' if use_pose else action}]",
        score=score,
        details={"closure": closure_peak, "closure_end": closure_end, "peak_frame": len(frames) // 2 + peak_i,
                 "excursion": excursion, "moved": round(moved, 4), "n_frames": n_frames},
        frames=[anchor] + frames,
        wall_seconds=time.monotonic() - t0,
        flags=flags,
    )


async def turn_closure(env: WorldEnv, n_frames: int = 192, settle_frames: int = 192) -> ProbeResult:
    """Look left N frames, look right N frames, settle: a head turn and back. Unlike a
    360 deg turn this needs no calibration, because both legs use the same command."""
    res = await loop_closure(env, "look_left", n_frames=n_frames, settle_frames=settle_frames)
    res.name = "turn_closure"
    return res


async def rotation_closure(
    env: WorldEnv,
    n_frames: int = 192,
    use_pose: bool = True,
    total_deg: float = 360.0,
    settle_frames: int = 192,
) -> ProbeResult:
    """Full turn. Exact on the fake backend, but on live LingBot World 2 `set_camera_pose`
    is a per-latent-frame velocity bias (Reactor schema docs), so the achieved yaw is not
    360 deg and closure is not meaningful there -- use turn_closure. Without use_pose we
    hold look_left for n_frames, which only closes if rotation_speed_deg * latent frames == 360.
    Closure is the best match to the anchor over the second half of the window."""
    t0 = time.monotonic()
    anchor = env.last_frame
    if anchor is None:
        raise RuntimeError("env has no frame yet; call reset() first")
    if use_pose:
        res = await env.pose(pose_yaw(n_frames, total_deg), extra_frames=settle_frames)
        frames = res.frames
    else:
        res = await env.step("look_left", n_frames)
        settle = await env.step("idle", settle_frames)
        frames = res.frames + settle.frames
    end = frames[-1] if frames else anchor
    curve = metrics.drift_curve(anchor, frames, every=max(1, len(frames) // 24))
    closure_end = metrics.similarity(anchor, end)
    tail = frames[len(frames) // 2 :]
    closure_peak, peak_i = _peak_closure(anchor, tail)
    moved = 1.0 - (min(curve) if curve else 1.0)
    score, flags = _combine(closure_peak["score"], moved)
    return ProbeResult(
        name="rotation_closure",
        score=score,
        details={"closure": closure_peak, "closure_end": closure_end, "peak_frame": len(frames) // 2 + peak_i,
                 "min_similarity_during_turn": round(min(curve), 4) if curve else None,
                 "curve": curve, "n_frames": n_frames, "total_deg": total_deg},
        frames=[anchor] + frames,
        wall_seconds=time.monotonic() - t0,
        flags=flags,
    )


async def stillness(env: WorldEnv, n_frames: int = 144) -> ProbeResult:
    t0 = time.monotonic()
    anchor = env.last_frame
    if anchor is None:
        raise RuntimeError("env has no frame yet; call reset() first")
    res = await env.step("idle", n_frames)
    curve = metrics.drift_curve(anchor, res.frames, every=max(1, len(res.frames) // 24))
    score = float(np.mean(curve)) if curve else 0.0
    end_sim = curve[-1] if curve else 0.0
    return ProbeResult(
        name="stillness",
        score=score,
        details={"mean_similarity": round(score, 4), "end_similarity": round(end_sim, 4), "curve": curve,
                 "n_frames": n_frames},
        frames=[anchor] + res.frames,
        wall_seconds=time.monotonic() - t0,
    )


async def controllability(
    env: WorldEnv,
    actions: tuple[str, ...] = ("forward", "back", "strafe_left", "strafe_right", "look_left", "look_right"),
    n_frames: int = 240,
    settle_frames: int = 96,
) -> ProbeResult:
    """For each action: hold it, measure mean flow over the held window, compare sign
    against EXPECTED_FLOW, and record command->motion latency in frames.
    Live LingBot World 2 needs ~72-144 frames before an action shows, so the flow is
    aggregated over the last third of the window."""
    t0 = time.monotonic()
    per: dict[str, Any] = {}
    frames_all: list[np.ndarray] = []
    correct = 0
    for a in actions:
        await env.step("idle", settle_frames)
        res = await env.step(a, n_frames)
        await env.hold("idle")
        fr = res.frames
        frames_all += fr
        if len(fr) < 4:
            per[a] = {"ok": False, "reason": "too_few_frames"}
            continue
        # aggregate flow over the last third of the window (after command latency)
        half = fr[(2 * len(fr)) // 3 :]
        stats = [metrics.flow_stats(half[i], half[i + 2]) for i in range(0, len(half) - 2, 2)]
        agg = {k: float(np.mean([s[k] for s in stats])) for k in ("dx", "dy", "mag", "div")}
        exp = EXPECTED_FLOW[a]
        ok = True
        for key, sign in exp.items():
            val = agg[key]
            if abs(val) < (0.05 if key == "div" else 0.2):  # no clear motion on this axis
                ok = False
            elif np.sign(val) != sign:
                ok = False
        onset = metrics.motion_onset(fr)
        correct += int(ok)
        per[a] = {"ok": ok, "flow": {k: round(v, 3) for k, v in agg.items()}, "expected": exp,
                  "onset_frame": onset, "fps": round(res.fps, 1)}
    score = correct / len(actions) if actions else 0.0
    onsets = [v["onset_frame"] for v in per.values() if isinstance(v, dict) and v.get("onset_frame")]
    return ProbeResult(
        name="controllability",
        score=score,
        details={"per_action": per, "mean_onset_frames": (float(np.mean(onsets)) if onsets else None),
                 "n_frames": n_frames},
        frames=frames_all,
        wall_seconds=time.monotonic() - t0,
    )


async def prompt_stability(
    env: WorldEnv, new_prompt: str, n_frames: int = 96, margin: float = 0.05
) -> ProbeResult:
    """Hot-swap the prompt while idle; structure (edges) should survive, texture may not.

    A still world drifts on its own, so first hold idle for n_frames to measure that drift,
    then swap and hold for n_frames more. If the swap changed the picture no more than idle
    drift did (SSIM within `margin`), the restyle never happened: score 0 with flag
    `no_restyle` instead of rewarding a model that ignored the prompt."""
    t0 = time.monotonic()
    anchor = env.last_frame
    if anchor is None:
        raise RuntimeError("env has no frame yet; call reset() first")
    base = await env.step("idle", n_frames)
    ref = base.frames[-1] if base.frames else anchor
    drift = metrics.similarity(anchor, ref)
    await env.set_prompt(new_prompt)
    res = await env.step("idle", n_frames)
    end = res.frames[-1] if res.frames else ref
    sim = metrics.similarity(ref, end)
    flags = ["no_restyle"] if sim["ssim"] >= drift["ssim"] - margin else []
    return ProbeResult(
        name="prompt_stability",
        score=0.0 if flags else sim["orb"],  # feature-level layout survival, not pixel similarity
        details={"similarity": sim, "idle_drift": drift, "new_prompt": new_prompt, "n_frames": n_frames},
        frames=[anchor] + base.frames + res.frames,
        wall_seconds=time.monotonic() - t0,
        flags=flags,
    )


DEFAULT_SUITE = ("stillness", "controllability", "loop_closure", "turn_closure")


async def run_suite(env: WorldEnv, names: tuple[str, ...] = DEFAULT_SUITE, **overrides: Any) -> list[ProbeResult]:
    """Run probes in order. `overrides` can pass per-probe kwargs, e.g.
    run_suite(env, loop_closure={"n_frames": 48})."""
    table = {
        "stillness": stillness,
        "controllability": controllability,
        "loop_closure": loop_closure,
        "turn_closure": turn_closure,
        "rotation_closure": rotation_closure,
        "prompt_stability": prompt_stability,
    }
    results = []
    for n in names:
        fn = table[n]
        kw = overrides.get(n, {})
        results.append(await fn(env, **kw))
        await env.hold("idle")
    return results
