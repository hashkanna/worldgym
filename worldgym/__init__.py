"""WorldGym: a Gym-style wrapper and physics-consistency probe suite for real-time world models.

Backends:
    worldgym.backends.reactor_backend.ReactorBackend  -- live Reactor models (needs REACTOR_API_KEY)
    worldgym.backends.fake_backend.FakeBackend        -- offline procedural world for tests/dev

Typical use:
    env = WorldEnv(backend)
    await env.reset(image="assets/anchors/street.jpg", prompt="a quiet street at dusk", seed=42)
    frames = await env.step("forward", n_frames=96)
    await env.close()
"""

from .actions import ACTIONS, Action
from .env import WorldEnv

__all__ = ["WorldEnv", "ACTIONS", "Action"]
__version__ = "0.1.0"
