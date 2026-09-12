# WorldGym — pitch kit

Track to name: **Best Use of World Models**. (Real-Time Interactive also fits: judges drive the live
model from the laptop keyboard.)

**WorldGym in one sentence:** a crash-test rig for world models — it plugs a live Reactor model into
a Gym-style environment, drives it with scripted moves, and scores whether the world stays consistent.

## 90-second pitch

**Hook (15 s).** Hand them the keyboard. "That's a live world model on Reactor, started from a photo
of the prize slide in this room. Hold W and walk into it." (Two seconds of nothing, then they walk
through the screen into an office that isn't there.)

**Problem (15 s).** "World models look incredible for three seconds. If you want to use one as a
simulator — for robots, driving, RL — you need to know whether the world is still there when you act
in it. Nobody measures that live."

**What we built (20 s).** "WorldGym wraps any Reactor world model as a Gym environment: reset it from
a photo, step it with an action, get frames back. On top of that it runs probes — stand still, walk
forward and back, turn away and back, check every control moves the scene the right way — and scores
the frames with classical computer vision."

**What we found on LingBot World 2 (30 s).**
- "The controls are right every time — six out of six — but motion starts two to three seconds after you ask."
- "Stand still and the world holds: 0.84 similarity to where you started."
- "Walk four seconds forward and four back and you don't get home: 0.07 to 0.18 across two runs. You
  walked through that screen yourself — walking back never brings it back."
- "Turn away and back: 0.13 to 0.17. You come back to a room that looks similar, but it isn't the same view."
- "And once you move, the prompt beats the photo."

**Close (10 s).** "That's the gap between a beautiful video model and a simulator you can trust — and
now it's a number you can track across models and versions."

## Demo run sheet

**Before judging**
- Tab 1: the hosted viewer, https://worldgym-900.pages.dev/webxr/ (passcode: `DEMO_PASSCODE` in your
  `.env`) → Connect & start about a minute before the judges arrive;
  wait for "started". A 429 / "no available capacity" error means Reactor is full: wait ~10 s and click again.
- Tab 2: the findings page, https://worldgym-900.pages.dev/dashboard/findings.html (scorecard at `/dashboard/`).
- Fallback: `dashboard/exhibits/walk-into-the-slide.mp4` (walks through the screen) or
  `dashboard/exhibits/backup-drive.mp4` (street).

**Live (2–3 minutes)**
1. Keyboard to the judge: "Hold W for five seconds." Point out the lag, then the walk through the screen.
2. "Now arrow left, then arrow right the same amount. Same room?"
3. Switch to the findings page: "WorldGym does exactly that, scripted, and scores it." Show the scores,
   then one contact sheet.
4. If Reactor has no capacity: play the backup video and go straight to the findings page.

## Likely questions

- **What is WorldGym, concretely?** A Python package. `WorldEnv` gives any Reactor model `reset()` and
  `step(action)`; probes are async functions that drive the env and return a score, frames and details:
  ```python
  env = WorldEnv(make_backend("reactor", model="reactor/lingbot-world-2"))
  await env.reset(image="assets/anchors/room.jpg", prompt="...", seed=42)
  res = await env.step("forward", n_frames=192)   # frames come back as numpy arrays
  result = await loop_closure(env, "forward")      # score, details, frames for the GIF
  ```
- **Why a "gym"?** It's the interface RL uses, so an agent can act in the world, and the probe scores
  can become rewards or regression tests for a model.
- **Aren't SSIM + ORB too strict for generated video?** Strict on purpose, and we check the baseline:
  standing still scores 0.84 in both runs, so 0.07–0.18 isn't metric noise. `modal_app.py` adds DINOv2
  similarity, which forgives re-texturing, if you want the lenient version.
- **Isn't low closure just the lag?** Both legs are held for the same number of frames, we settle
  longer than the lag (192 frames, ~4 s) and take the best match over the whole return. Our first
  version didn't settle long enough — we threw those numbers out.
- **Why not a 360° turn?** `set_camera_pose` is a velocity bias, not a camera rig: our "360°" turn
  came nowhere near 360°. Turning left then right with the same command needs no calibration.
- **What next?** Run the suite across Reactor's other models and several seeds for error bars; use
  closure as a consistency reward for RL.

## Submission checklist

- Repo with `README.md` (see "What we learned from the live API").
- Site: https://worldgym-900.pages.dev (findings, scorecard, viewer).
- Videos: `demo/backup-venue.mp4`, `demo/backup-room.mp4`.
- Deadline and format: not in the organiser emails — check the event Discord (https://discord.gg/vBHYfwyt5V).
