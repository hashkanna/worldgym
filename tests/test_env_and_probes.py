"""Offline tests of WorldEnv + probes against the FakeBackend.

A clean fake world must score high on closure/stillness; a drifting, hallucinating
one must score lower. This is what tells us the probes measure what we claim."""

import asyncio
import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worldgym import WorldEnv  # noqa: E402
from worldgym.actions import commands_for, pose_out_and_back, pose_yaw  # noqa: E402
from worldgym.backends.fake_backend import FakeBackend  # noqa: E402
from worldgym.probes import (  # noqa: E402
    controllability,
    loop_closure,
    prompt_stability,
    rotation_closure,
    run_suite,
    stillness,
    turn_closure,
)
from worldgym.recorder import save_run  # noqa: E402
from worldgym.scorecard import build  # noqa: E402

FAST = dict(fps=48, speed=50.0, size=(320, 184), chunk_frames=8)


def run(coro):
    return asyncio.run(coro)


def _anchor_png() -> bytes:
    import cv2

    from worldgym.backends.fake_backend import _make_texture

    ok, buf = cv2.imencode(".png", _make_texture(512, seed=11)[..., ::-1])
    assert ok
    return buf.tobytes()


async def _env(**kw) -> WorldEnv:
    env = WorldEnv(FakeBackend(**{**FAST, **kw}), step_timeout=30.0)
    await env.reset(prompt="test world", image=_anchor_png(), seed=1)
    return env


class ActionsTest(unittest.TestCase):
    def test_commands_clear_all_axes_then_set_one(self):
        cmds = commands_for("strafe_left", "reactor/lingbot-world-2")
        names = [c.name for c in cmds]
        self.assertEqual(names[:4], ["set_move_longitudinal", "set_move_lateral", "set_look_horizontal", "set_look_vertical"])
        self.assertEqual(cmds[-1].params, {"move_lateral": "strafe_left"})

    def test_v1_mapping(self):
        cmds = commands_for("look_up", "reactor/lingbot")
        self.assertEqual(cmds[-1].name, "set_look_vertical")
        self.assertEqual(cmds[-1].params, {"look_vertical": "up"})

    def test_pose_builders(self):
        p = pose_out_and_back(10, 0.5)
        self.assertEqual(len(p), 120)
        self.assertAlmostEqual(sum(p[5::6]), 0.0)  # tz sums to zero
        y = pose_yaw(90, 360)
        self.assertEqual(len(y), 540)
        self.assertAlmostEqual(sum(y[1::6]), 2 * np.pi, places=6)

    def test_unknown_action(self):
        with self.assertRaises(ValueError):
            commands_for("fly", "reactor/lingbot-world-2")


class EnvTest(unittest.TestCase):
    def test_reset_requires_image_for_lingbot(self):
        async def go():
            env = WorldEnv(FakeBackend(**FAST), step_timeout=2.0)
            await env.connect()
            with self.assertRaises(TimeoutError):  # start rejected -> no frames ever arrive
                await env.reset(prompt="x", image=None, seed=1, warmup_frames=4)
            await env.close()

        run(go())

    def test_step_returns_requested_frames(self):
        async def go():
            env = await _env()
            try:
                res = await env.step("forward", 40)
                self.assertGreaterEqual(res.frame_count, 40)
                self.assertEqual(res.frames[0].shape, (184, 320, 3))
                self.assertEqual(res.frames[0].dtype, np.uint8)
                self.assertEqual(env.current_action, "forward")
                self.assertEqual(env.state["move_longitudinal"], "forward")
            finally:
                await env.close()

        run(go())

    def test_pose_plays_and_deactivates(self):
        async def go():
            env = await _env()
            try:
                res = await env.pose(pose_yaw(24, 45), extra_frames=8)
                self.assertGreaterEqual(res.frame_count, 32)
                self.assertFalse(env.state["camera_pose_active"])
                self.assertEqual(env.backend.sent[-1], ("set_camera_pose", {"camera_pose": []}))
            finally:
                await env.close()

        run(go())


class ProbeTest(unittest.TestCase):
    def test_clean_world_closes_loops(self):
        async def go():
            env = await _env()
            try:
                lc = await loop_closure(env, "strafe_left", n_frames=48)
                self.assertGreater(lc.details["moved"], 0.15, "excursion should change the view")
                self.assertGreater(lc.score, 0.85, lc.details)
                lp = await loop_closure(env, n_frames=48, use_pose=True, pose_tz=0.5)
                self.assertGreater(lp.score, 0.85, lp.details)
                rc = await rotation_closure(env, n_frames=96, use_pose=True)
                self.assertGreater(rc.score, 0.85, rc.details)
                tc = await turn_closure(env, n_frames=48, settle_frames=16)
                self.assertEqual(tc.name, "turn_closure")
                self.assertGreater(tc.details["moved"], 0.15, "turning should change the view")
                self.assertGreater(tc.score, 0.85, tc.details)
                st = await stillness(env, n_frames=48)
                self.assertGreater(st.score, 0.95)
            finally:
                await env.close()

        run(go())

    def test_no_motion_is_flagged_not_rewarded(self):
        async def go():
            env = await _env()
            try:
                # 'idle' has itself as inverse: the world never moves -> closure is trivially 1
                lc = await loop_closure(env, "idle", n_frames=24)
                self.assertIn("no_motion", lc.flags)
                self.assertEqual(lc.score, 0.0)
            finally:
                await env.close()

        run(go())

    def test_ignored_prompt_is_flagged_not_rewarded(self):
        async def go():
            env = await _env()
            try:
                # the fake world never restyles, so its layout would "survive" trivially
                ps = await prompt_stability(env, "the same place at night", n_frames=24)
                self.assertIn("no_restyle", ps.flags)
                self.assertEqual(ps.score, 0.0)
            finally:
                await env.close()

        run(go())

    def test_drifting_world_scores_lower(self):
        async def go():
            clean = await _env()
            drifty = await _env(drift=6.0, hallucination=0.08, seed=3)
            try:
                a = await stillness(clean, n_frames=48)
                b = await stillness(drifty, n_frames=48)
                self.assertGreater(a.score - b.score, 0.15, (a.score, b.score))
                la = await loop_closure(clean, "strafe_left", n_frames=48)
                lb = await loop_closure(drifty, "strafe_left", n_frames=48)
                self.assertGreater(la.score, lb.score)
            finally:
                await clean.close()
                await drifty.close()

        run(go())

    def test_controllability_matches_expected_flow(self):
        async def go():
            env = await _env()
            try:
                c = await controllability(env, n_frames=40, settle_frames=8)
                per = c.details["per_action"]
                for a in ("strafe_left", "strafe_right", "look_left", "look_right", "forward", "back"):
                    self.assertTrue(per[a]["ok"], (a, per[a]))
                self.assertEqual(c.score, 1.0)
                self.assertIsNotNone(c.details["mean_onset_frames"])
            finally:
                await env.close()

        run(go())

    def test_suite_save_and_scorecard(self):
        async def go():
            env = await _env()
            try:
                results = await run_suite(env, ("stillness", "loop_closure"),
                                          loop_closure={"n_frames": 24}, stillness={"n_frames": 24})
            finally:
                await env.close()
            with tempfile.TemporaryDirectory() as td:
                out = save_run(Path(td) / "results" / "fake-run", env.model, results, env.info, gif_every=8)
                data = json.loads((out / "results.json").read_text())
                self.assertEqual(len(data["probes"]), 2)
                self.assertTrue((out / "stillness.gif").exists())
                page = build(Path(td) / "results", Path(td) / "dashboard" / "index.html")
                html = page.read_text()
                self.assertIn("fake-run", html)
                self.assertIn("stillness.gif", html)

        run(go())


if __name__ == "__main__":
    unittest.main()
