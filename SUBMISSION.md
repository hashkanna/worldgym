# Devpost submission — WorldGym

Copy each field into https://devpost.com/submit-to/31330-worlds-london/manage/submissions.

**Project name:** WorldGym

**Elevator pitch** (under 200 characters):
A test rig for real-time world models: it drives Reactor's models like a player and scores whether the world is still there when you come back. It isn't.

**Try it out:** https://worldgym-900.pages.dev · https://github.com/hashkanna/worldgym

**Video demo:** https://worldgym-900.pages.dev/dashboard/exhibits/worldgym-demo.mp4 (or the YouTube link, once uploaded)

YouTube upload (https://www.youtube.com/upload), visibility **Unlisted**:

- Title: `WorldGym: does a world model's world come back?`
- Description:

  > WorldGym is a test rig for real-time world models on Reactor. It drives the model like a player — walk away, turn around, come back — and scores whether the world is still there.
  >
  > Controls work (6 of 6, but 2–3 s late) and standing still holds, but walk or turn away and back and you don't return to the same place.
  >
  > Live site: https://worldgym-900.pages.dev
  > Built at WORLDS | LONDON, 12 Sept 2026.

**Tracks:** Best Use of World Models · Real-Time Interactive (Reactor)

**Built with:** python, reactor, reactor-sdk, opencv, scikit-image, numpy, three.js, webrtc, playwright, cloudflare-pages, ffmpeg

**Notes for judges:** The live viewer at /webxr/ asks for a passcode (`DEMO_PASSCODE` in `.env`). If Reactor is busy it shows "no available capacity"; wait about 10 seconds and click Connect again.

---

## Inspiration

World models went real-time: you can walk around a world generated from a single photo. People judge them by eye, for a few seconds. If you want to use one as a simulator — for robots, driving or reinforcement learning — the question that matters is different: when you act in the world and come back, is it the same world?

## What it does

WorldGym wraps any Reactor world model as a Gym-style environment — `reset(photo, prompt, seed)`, `step(action)` — and runs probes that have a known right answer:

- **Controls respond:** does each of six actions move the scene the right way, and how late?
- **Standing still:** how much does the world drift when you do nothing?
- **Walk forward and back / Turn away and back:** does the view return to where you started?
- **Prompt swap:** does a new prompt restyle the scene while keeping its layout?

Every score runs from 0 to 1 and ships with the frames behind it: a findings page, a scorecard across runs and models, and a live viewer where you drive the model yourself.

## What we found

Same photo (the prize slide at the venue), same prompt, seed 42. Scores are averages over runs, with the range where there was more than one.

| Model | Controls respond | Standing still | Turn away and back | Walk forward and back | New prompt, standing still | Runs |
|---|---|---|---|---|---|---|
| LingBot World 2 | 1.00 | 0.84 | 0.15 (0.13–0.17) | 0.13 (0.07–0.18) | ignored | 3 |
| LingBot v1 | 1.00 | 0.80 | 0.12 (0.11–0.14) | 0.16 (0.12–0.20) | not run | 2 |
| HappyOyster Adventure | 0.67 (4 of 6; the wall blocks forward) | 0.95 | 0.22 | 0.30 | no prompt control | 2 |

- LingBot's controls are right every time but land 2–3 seconds late; HappyOyster's work wherever nothing blocks them.
- HappyOyster, which promises permanent worlds, holds best and stops at the wall where LingBot walks through the screen — but turning away and back still lands somewhere new. It streams 11–20 fps to our harness (LingBot about 45), so its holds last longer in real time; one run per test.
- Standing still holds. Walk away and back, or turn away and back, and you land in a re-imagined room: walking into the wall TV takes you through the screen into another office, and walking back never brings the slide back.
- A new prompt does nothing while you stand still; once you move, the prompt beats the photo.

## How we built it

- A Python harness on the Reactor Python SDK: `WorldEnv` (async reset / step / pose), per-model action mappings, the probes, and classical computer-vision metrics — SSIM, RANSAC-verified ORB feature matches, Farneback optical flow.
- 19 offline tests against a procedural fake world with drift and hallucination knobs, so each probe is shown to catch a broken world before it touches a live model.
- A findings page, scorecard and browser viewer (three.js + Reactor JS SDK) on Cloudflare Pages, with a Pages Function that mints short-lived session tokens behind a passcode.
- Headless Chrome (Playwright) to record drives and capture frames and stream stats.

## Challenges we ran into

- **Command lag.** Actions show up 2–3 seconds late, so our first walk test stopped measuring before the return finished. Every hold and settle is now 192 frames (about 4 seconds).
- **`set_camera_pose` is a bias, not a rig.** Our "360° turn" turned a fraction of a circle, so we replaced it with turning away and back using the same command, which needs no calibration.
- **A test that passed because nothing happened.** The first prompt swap scored well because the picture never changed. The probe now measures idle drift first and flags the swap when it changes the picture no more than drift does.
- **Capacity.** At a busy hackathon, sessions often come back "no available capacity"; the harness and the viewer retry.

## Accomplishments that we're proud of

- Every number is backed by frames you can look at, and each probe flags when its premise didn't happen instead of scoring it.
- One command runs the same suite on a different Reactor world model.

## What we learned

- Today's real-time world models are controllable but not persistent: the world you return to is re-imagined.
- Standing still is the baseline to read every other score against.

## What's next

- More seeds and photos for error bars, and new Reactor world models as they ship.
- Closure scores as an RL reward and as a regression test for model releases.
- DINOv2 similarity (already wired in `modal_app.py`) as a lenient companion to SSIM and ORB.
