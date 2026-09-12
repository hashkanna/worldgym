# WorldGym

**A test rig for real-time world models.** WorldGym drives a world model on
[Reactor](https://reactor.inc) the way a player would — walk away, turn around, come back — and
scores whether the world is still there.

Live site (findings, scorecard, drive the model yourself): **https://worldgym-900.pages.dev**

## Results

Same photo (the prize slide at the WORLDS | LONDON venue), same prompt, seed 42. Scores run from
0 to 1; each cell is the average over runs, with the range where there was more than one.

| Model | Controls respond | Standing still | Turn away and back | Walk forward and back | New prompt, standing still | Runs |
|---|---|---|---|---|---|---|
| LingBot World 2 | 1.00 | 0.84 | 0.15 (0.13–0.17) | 0.13 (0.07–0.18) | ignored | 3 |
| LingBot v1 | 1.00 | 0.80 | 0.12 (0.11–0.14) | 0.16 (0.12–0.20) | not run | 2 |

- Every control moves the scene the right way, but motion starts 2–3 seconds after the command.
- Standing still holds. Walk away and back, or turn away and back, and you land in a re-imagined
  room: walking into the wall TV takes you through the screen into another office, and walking
  back never brings the slide back.
- A new prompt does nothing while you stand still; once you move, the prompt beats the photo.

## How it works

`WorldEnv` wraps a Reactor model as a Gym-style environment: `reset(photo, prompt, seed)` starts a
world, `step(action, n_frames)` holds an action and returns the frames. Probes drive the env
through moves with a known right answer and score the frames:

| Probe | What it does | Score |
|---|---|---|
| `controllability` | hold each of 6 actions and measure optical flow | share of actions whose flow matches (strafe left → scene slides right, forward → expansion), plus onset in frames |
| `stillness` | hold idle for 144 frames | mean similarity to the first frame |
| `loop_closure` | forward 192 frames, back 192, idle 192 (longer than the lag) | best similarity to the start over the return half; **0 + flag `no_motion`** if the view never changed |
| `turn_closure` | look left 192 frames, look right 192, idle 192 | same as `loop_closure`; both legs use the same command, so no calibration is needed |
| `prompt_stability` | idle to measure drift, swap the prompt, idle again (480 frames each live) | share of layout features that survive; **0 + flag `no_restyle`** if the swap changed the picture no more than drift |
| `rotation_closure` | 360° turn via `set_camera_pose` | offline only — on the live models the pose is a velocity bias, so the turn isn't really 360° |

Similarity is ½ SSIM + ½ the share of ORB features that match after RANSAC, on 320-px greyscale
frames. Setting `WORLDGYM_EMBED_URL` to a deployed `modal_app.py` blends in DINOv2 similarity,
which is more forgiving of re-texturing.

The offline tests run every probe against a procedural fake world: a clean world scores near 1.00
on closure and stillness, and a drifting, hallucinating one scores clearly lower while its
controls still pass. That separation is what shows the probes measure what they claim.

## Run it

```bash
uv venv --python 3.13 .venv && source .venv/bin/activate   # avoid Anaconda: its scipy breaks on recent macOS
uv pip install -e ".[dev]"
cp .env.example .env                                        # add REACTOR_API_KEY; never committed
python -m pytest -q                                         # 19 offline tests, no credits used
```

Run the suite on a model; each run writes `results/<run>/` and rebuilds `dashboard/index.html`,
whose **By model** table averages runs per model:

```bash
P="a large wall-mounted TV showing a hackathon prize slide in a modern office event space, cool daylight, photoreal"
python scripts/run_probes.py --model reactor/lingbot-world-2 --image assets/anchors/room.jpg --prompt "$P" --run lbw2-venue-slide
python scripts/run_probes.py --model reactor/lingbot         --image assets/anchors/room.jpg --prompt "$P" --run lb1-venue-slide
open dashboard/index.html
```

`python scripts/list_model_commands.py <model>` prints any Reactor model's command schema, which is
the starting point for mapping a new model's controls in `worldgym/actions.py`.

Drive the model yourself locally — W A S D to move, arrow keys to look:

```bash
python webxr/serve.py                              # http://localhost:8000
cloudflared tunnel --url http://localhost:8000     # optional public https link
```

## Publish the site

```bash
python dashboard/findings/build.py                           # findings page from dashboard/findings/template.html
scripts/build_site.sh                                        # assembles site/
npx wrangler pages deploy site --project-name worldgym       # functions/token.js serves POST /token
npx wrangler pages secret put REACTOR_API_KEY --project-name worldgym
npx wrangler pages secret put DEMO_PASSCODE --project-name worldgym
```

## What we learned from the live API

- **Lag:** command → visible motion takes ~2–3 s, so closure probes hold each leg for 192 frames
  and settle for 192 before measuring the return.
- **`set_camera_pose` is a bias, not a rig:** values are per-latent-frame velocities that stay
  active until cleared, and translation is normalised per chunk.
- **The prompt only takes over when you move:** a slide photo with a "residential street" prompt
  becomes a street within seconds of walking, while a new prompt changes nothing while you stand still.
- **Capacity:** session creation often fails with 429 "no available capacity" when the platform is
  busy; the Python backend and the viewer both retry.
- **JS SDK:** the video track is `main_video`; pass `{ name }` to `uploadFile` — an unnamed upload
  didn't take. The stream is 1664×960 VP9 at ~2.6 Mbps, and fps drops from ~42 to ~20 while moving.

## Layout

```
worldgym/
  env.py                 WorldEnv: reset / step / pose / hold, frame buffer and timing
  actions.py             action vocabulary -> each model's commands
  probes.py              the probes above
  metrics.py             SSIM, ORB + RANSAC matching, Farneback optical flow, optional DINOv2
  recorder.py            results.json, GIFs and first/last frames per run
  scorecard.py           results/*/results.json -> dashboard/index.html
  backends/              live Reactor backend and the offline fake world
scripts/
  run_probes.py          run the suite on a model
  list_model_commands.py print a model's command schema
  build_site.sh          assemble the Cloudflare Pages site
  browser/               headless-Chrome helpers: record a drive, capture frames and stream stats
dashboard/
  findings/              findings page source (template + frames) -> dashboard/findings.html
  exhibits/              demo videos
webxr/                   the browser viewer (three.js + Reactor JS SDK) and its local server
functions/token.js       Pages Function that mints Reactor session tokens behind a passcode
results/                 every probe run, plus notes shown on the scorecard
tests/                   offline tests against the fake world
```
