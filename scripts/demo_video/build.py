"""Turn scenes.json + the stills from render.mjs into demo/worldgym-demo.mp4.

Each beat gets its narration from macOS `say`; the beat lasts as long as its narration plus a
short lead-in and tail. Visuals: a still card, footage with a caption overlay, or a tall
screenshot scrolled with ease-in-out. Beats that share a visual cut straight through; others
dip to black. Stdlib only.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BUILD = ROOT / "demo" / "build"
OUT = ROOT / "demo" / "worldgym-demo.mp4"
W, H, FPS = 1920, 1080, 30
LEAD, TAIL, FADE = 0.45, 0.7, 0.3


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def probe(path: Path, entries: str) -> list[str]:
    res = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", entries,
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return res.stdout.strip().split(",")


def duration(path: Path) -> float:
    res = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True)
    return float(res.stdout.strip())


def visual_key(v: dict | None) -> tuple | None:
    # beats that share a visual (or a "group") cut straight through instead of dipping to black
    return None if v is None else (v["type"], v.get("group") or v.get("shot") or v.get("card") or v.get("src"))


def main() -> None:
    scenes = json.loads((HERE / "scenes.json").read_text())
    shots = json.loads((BUILD / "shots.json").read_text())
    beats = scenes["beats"]
    segments, timeline, clock = [], [], 0.0

    for i, beat in enumerate(beats):
        v = beat["visual"]
        aiff = BUILD / f"{beat['id']}.aiff"
        run(["say", "-v", scenes["voice"], "-r", str(scenes["rate"]), "-o", str(aiff), beat["say"]])
        d = round(duration(aiff) + LEAD + TAIL, 3)

        prev_key = visual_key(beats[i - 1]["visual"]) if i else None
        next_key = visual_key(beats[i + 1]["visual"]) if i + 1 < len(beats) else None
        fades = []
        if visual_key(v) != prev_key:
            fades.append(f"fade=t=in:st=0:d={FADE}")
        if visual_key(v) != next_key:
            fades.append(f"fade=t=out:st={d - FADE:.3f}:d={FADE}")
        tail = "," + ",".join(fades) if fades else ""

        inputs: list[str] = []
        if v["type"] == "footage":
            inputs = ["-ss", str(v.get("start", 0)), "-i", str(ROOT / v["src"]),
                      "-loop", "1", "-framerate", str(FPS), "-i", str(BUILD / f"caption-{beat['id']}.png")]
            vf = (f"[0:v]fps={FPS},scale={W}:-2,crop={W}:{H},setsar=1,tpad=stop_mode=clone:stop_duration=10[b];"
                  f"[b][1:v]overlay=0:0,format=yuv420p{tail}[v]")
            audio_index = 2
        elif v["type"] in ("card", "page"):
            card = f"card-{v['card']}-{v['step']}.png" if v.get("step") else f"card-{v.get('card')}.png"
            still = BUILD / (card if v["type"] == "card" else f"table-{v['highlight']}.png")
            inputs = ["-loop", "1", "-framerate", str(FPS), "-i", str(still)]
            vf = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
                  f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=#111325,setsar=1,format=yuv420p{tail}[v]")
            audio_index = 1
        elif v["type"] == "scroll":
            spec = shots[v["shot"]]
            still = BUILD / f"{v['shot']}.png"
            iw, ih = (int(x) for x in probe(still, "stream=width,height"))
            scale = min(1.0, W / iw)
            sh = int(ih * scale)
            y0 = spec.get("from", 0)
            y1 = max(0, sh - H) if spec.get("to") == "end" else min(int(spec["to"]), max(0, sh - H))
            hold_in, hold_out = 1.0, 1.2
            span = max(0.1, d - hold_in - hold_out)
            p = f"clip((t-{hold_in})/{span},0,1)"
            y = f"{y0}+({y1 - y0})*({p}*{p}*(3-2*{p}))"
            inputs = ["-loop", "1", "-framerate", str(FPS), "-i", str(still)]
            vf = (f"[0:v]scale=iw*{scale:.5f}:-2,pad={W}:max(ih\\,{H}):(ow-iw)/2:0:color={spec['bg']},"
                  f"crop={W}:{H}:0:'{y}',setsar=1,format=yuv420p{tail}[v]")
            audio_index = 1
        else:
            raise ValueError(f"unknown visual type {v['type']!r}")

        seg = BUILD / f"seg-{beat['id']}.mp4"
        af = f"[{audio_index}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(LEAD * 1000)}|{int(LEAD * 1000)},apad[a]"
        run(["ffmpeg", "-v", "error", "-y", *inputs, "-i", str(aiff),
             "-filter_complex", f"{vf};{af}", "-map", "[v]", "-map", "[a]", "-t", f"{d}",
             "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", str(seg)])
        segments.append(seg)
        timeline.append(f"{clock:6.1f}s  {d:5.1f}s  {beat['id']}")
        clock += d

    # concat needs identical sample aspect ratios; scaling can leave some segments at 3601:3600
    norm = "".join(f"[{i}:v]setsar=1[v{i}];" for i in range(len(segments)))
    streams = "".join(f"[v{i}][{i}:a]" for i in range(len(segments)))
    run(["ffmpeg", "-v", "error", "-y", *sum((["-i", str(s)] for s in segments), []),
         "-filter_complex", f"{norm}{streams}concat=n={len(segments)}:v=1:a=1[v][a];[a]loudnorm=I=-16:TP=-1.5:LRA=11[an]",
         "-map", "[v]", "-map", "[an]", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(OUT)])
    (BUILD / "timeline.txt").write_text("\n".join(timeline) + f"\n{clock:6.1f}s  total\n")
    print("\n".join(timeline))
    print(f"{clock:.1f}s -> {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
