import sys
import unittest
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worldgym import metrics  # noqa: E402
from worldgym.backends.fake_backend import _make_texture  # noqa: E402


def _view(tex: np.ndarray, cx: float, cy: float, zoom: float, size=(416, 240)) -> np.ndarray:
    w, h = size
    m = np.array([[zoom, 0, w / 2 - zoom * cx], [0, zoom, h / 2 - zoom * cy]], np.float32)
    return cv2.warpAffine(tex, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)


class MetricsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tex = _make_texture(1024, seed=1)
        cls.a = _view(cls.tex, 512, 512, 1.0)

    def test_identical_frames_score_one(self):
        s = metrics.similarity(self.a, self.a.copy())
        self.assertGreater(s["ssim"], 0.99)
        self.assertGreater(s["orb"], 0.5)
        self.assertGreater(s["score"], 0.8)

    def test_shifted_frames_score_lower_than_identical(self):
        b = _view(self.tex, 512 + 120, 512, 1.0)
        s_same = metrics.similarity(self.a, self.a)["score"]
        s_shift = metrics.similarity(self.a, b)["score"]
        self.assertLess(s_shift, s_same)
        self.assertLess(metrics.ssim(self.a, b), 0.6)

    def test_flow_direction_pan(self):
        # camera pans left (cx decreases) -> scene content moves RIGHT -> dx > 0
        b = _view(self.tex, 512 - 6, 512, 1.0)
        fs = metrics.flow_stats(self.a, b)
        self.assertGreater(fs["dx"], 1.0)
        self.assertLess(abs(fs["dy"]), 1.0)

    def test_flow_divergence_forward(self):
        b = _view(self.tex, 512, 512, 1.04)  # zoom in == move forward -> expansion
        self.assertGreater(metrics.flow_stats(self.a, b)["div"], 0.2)
        c = _view(self.tex, 512, 512, 0.96)
        self.assertLess(metrics.flow_stats(self.a, c)["div"], -0.2)

    def test_motion_onset(self):
        still = [self.a] * 10
        moving = [_view(self.tex, 512 + 5 * i, 512, 1.0) for i in range(1, 11)]
        self.assertIsNone(metrics.motion_onset(still))
        onset = metrics.motion_onset(still + moving)
        self.assertIsNotNone(onset)
        self.assertGreaterEqual(onset, 10)
        self.assertLessEqual(onset, 14)

    def test_orb_ratio_is_low_for_unrelated_frames(self):
        other = _view(_make_texture(1024, seed=7), 300, 700, 1.0)
        self.assertLess(metrics.orb_match_ratio(self.a, other), 0.2)


if __name__ == "__main__":
    unittest.main()
