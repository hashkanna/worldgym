# WorldGym

**A Gym for world models — and the first environment is you.**

WorldGym wraps any real-time world model on [Reactor](https://reactor.inc) as a
`reset()/step(action)` environment, then does three things with it:

1. **Probes** — scripted action sequences that score *physical consistency*:
   walk forward-then-back (did you get home?), turn away and back (does the view return?),
   stand still (does it drift?), and controllability (does "strafe left" move the scene
   left, and how many frames until it does?). Results land in a static scorecard.
2. **WorldXR** — a WebXR page for Apple Vision Pro: the video is head-locked and your
   head drives the model's camera (turn your head → the world turns; pinch → walk).
3. **Dream Navigator** (stretch) — a VLM agent given a text goal, acting inside the world.

Built for the WORLDS | LONDON hackathon (12 Sept 2026). Target model:
`reactor/lingbot-world-2` (WASD + look + `set_camera_pose` velocity bias, seedable).

```
worldgym/
  env.py              WorldEnv: reset / step / pose / hold, frame buffer + timing
  actions.py          action vocab -> model commands; camera_pose trajectory builders
  probes.py           loop_closure, turn_closure, rotation_closure, stillness, controllability, prompt_stability
  metrics.py          SSIM, ORB+RANSAC match ratio, Farneback flow (dx/dy/divergence), optional DINOv2
  recorder.py         GIF/PNG/MP4 + results.json per run
  scorecard.py        results/*/results.json -> dashboard/index.html
  agent.py            Dream Navigator (needs `anthropic`)
  backends/
    reactor_backend.py  live Reactor Python SDK (verified live; retries 429 "no available capacity")
    fake_backend.py     offline procedural world with drift/hallucination knobs (tests, dev)
scripts/
  smoke_test.py       connect -> frames -> fps + command->motion latency (run this FIRST)
  run_probes.py       run the suite, write results/<run>/ and the scorecard
  futures_tree.py     same anchor+seed, 4 parallel sessions, different action scripts -> tiled GIF
webxr/
  index.html          WorldXR viewer (three.js + Reactor JS SDK via esm.sh)
  serve.py            static server + /token endpoint (stdlib)
modal_app.py          optional DINOv2 embedding endpoint on Modal
tests/                18 offline tests (unittest/pytest) against the fake backend
```

## Setup

```bash
uv venv --python 3.13 .venv && source .venv/bin/activate   # or python -m venv; avoid Anaconda (its scipy breaks on recent macOS)
uv pip install -e ".[dev]"         # reactor-sdk, opencv, scikit-image, imageio, pytest
cp .env.example .env               # add REACTOR_API_KEY (dashboard at reactor.inc/dashboard)
python -m pytest -q                 # 18 offline tests, ~15 s, no credits used
```

Everything below works offline first (`--backend fake`), so you can develop the
harness without spending credits, then flip to the live model.

## Tonight (before the hackathon)

1. **Get a Reactor key + credits**, then the one thing that matters most:
   ```bash
   python scripts/smoke_test.py --image assets/anchors/street.jpg
   ```
   It prints time-to-first-frame, fps, command→motion latency, and saves `results/smoke/`.
   If the SDK's signatures differ from the docs, every fix goes in
   `worldgym/backends/reactor_backend.py` (one file). Things to confirm:
   `Reactor(model_name=, api_key=)`, `tracks.with_direction("recvonly").with_kind("video").one()`,
   `on_frame` callback args, `upload_file()` → ref accepted by `set_image`.
2. **Replace `assets/anchors/street.jpg`** with real landscape photos (see `assets/anchors/README.md`).
3. **Run one live probe** to calibrate frame counts (`--short` halves them):
   ```bash
   python scripts/run_probes.py --probes stillness,controllability --short
   open dashboard/index.html
   ```
   Check: does `set_camera_pose` play once and stop, or hold? Does `chunk_complete` arrive
   every ~N frames? Adjust `extra_frames` in `WorldEnv.pose` and `n_frames` defaults.
4. **Try WorldXR on the Vision Pro** with the fake-free path (it only needs the key):
   ```bash
   python webxr/serve.py                                # http://localhost:8000
   cloudflared tunnel --url http://localhost:8000       # or: ngrok http 8000  (WebXR needs https)
   ```
   Open the tunnel URL in Safari on the headset → pick an image → Connect → Enter VR.
   If "Enter VR" stays disabled: Settings ▸ Apps ▸ Safari ▸ Advanced ▸ Feature Flags ▸ WebXR.
   Test the same page on your Mac first (keyboard: W/S/A/D, arrows) to separate Reactor
   problems from XR problems. If `esm.sh` can't bundle the SDK, scaffold
   `npx create-reactor-app worldxr --model=lingbot-world-2` and port the page into it.

## On the day

```bash
python scripts/run_probes.py --model reactor/lingbot-world-2 --image assets/anchors/room.jpg \
  --prompt "a large wall-mounted TV showing a hackathon prize slide in a modern office event space, cool daylight, photoreal" \
  --run lbw2-venue-slide
python scripts/run_probes.py --model reactor/lingbot --image assets/anchors/street.jpg --run lb1-street --no-pose
python scripts/run_probes.py --image assets/anchors/driving.jpg --run lbw2-driving
python scripts/futures_tree.py --branches 4                      # 4 concurrent sessions (limit is 5)
python -m worldgym.agent --goal "walk to the red door" --steps 10  # stretch, needs ANTHROPIC_API_KEY
```

Each run writes `results/<run>/results.json` + GIFs and rebuilds `dashboard/index.html`.

## How the probes score

| probe | what it does | score |
|---|---|---|
| `loop_closure` | hold `forward` N frames, then `back` N, then settle longer than the 2–3 s lag | best similarity to the anchor over the return half; **0 + flag `no_motion`** if the excursion didn't change the view |
| `turn_closure` | hold `look_left` N frames, then `look_right` N, then settle | same as `loop_closure`; both legs use the same command, so no calibration is needed |
| `rotation_closure` | yaw 360° via `camera_pose` (fake backend only) | not in the live suite: on LingBot World 2 `camera_pose` is a velocity bias, so the turn isn't really 360° |
| `stillness` | hold `idle` N frames | mean similarity to the anchor over the window |
| `controllability` | hold each action; measure optical flow | fraction of actions whose flow sign matches (`strafe_left` → scene moves right, `forward` → expansion), plus onset latency in frames |
| `prompt_stability` | hot-swap the prompt while idle | ORB feature survival (layout, not pixels) |

Similarity = ½·SSIM + ½·ORB-inlier-ratio (RANSAC-verified). Set `WORLDGYM_EMBED_URL`
to a deployed `modal_app.py` to blend in DINOv2 cosine, which is far more forgiving of
the texture "re-imagining" world models do when you come back to a place.

On the fake backend a clean world scores 1.00 everywhere and a drifting/hallucinating
one drops to ~0.15–0.25 on closure/stillness while keeping controllability at 1.00 —
that separation is the point.

## What we learned from the live API

- **Lag:** command → visible motion takes ~2–3 s (onset ≈ 110–145 frames at ~47 fps), so the
  closure probes hold actions for 192 frames and settle for 192 before measuring the return.
- **`set_camera_pose` is a bias, not a rig:** values are per-latent-frame velocities that stay
  active until cleared, and translation is normalised per chunk. A "360° pose turn" doesn't turn
  360°, which is why `turn_closure` replaced `rotation_closure` in the live suite.
- **The prompt beats the photo once you move:** a TV-slide photo with a "residential street"
  prompt becomes a street within seconds of walking. Match the prompt to the anchor.
- **Capacity:** session creation often fails with 429 "no available capacity" at busy times; the
  Python backend and the viewer both retry.
- **JS SDK:** the video track is `main_video`; `uploadFile` takes a `Blob`, but pass `{ name }` —
  an unnamed upload didn't take in our test. The stream is 1664×960 VP9 at ~2.6 Mbps, and fps
  drops from ~42 to ~20 while moving.
- LingBot v1 vs World 2 command names differ (`set_movement` vs two axes) — handled in `actions.py`.
