"""Run one probe live and merge it into an existing run dir.
    python scripts/run_one.py <run_dir> <image> "<prompt>" <probe> key=val ...
"""
import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv; load_dotenv()
from worldgym import WorldEnv
from worldgym.backends import make_backend
from worldgym import probes as P
from worldgym.recorder import save_gif, save_png, _slug
from worldgym.scorecard import build
def _val(v):
    if v in ("true","false"): return v == "true"
    try: return int(v)
    except ValueError:
        try: return float(v)
        except ValueError: return v
async def main():
    run, image, prompt, name = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    kw = {k: _val(v) for k, v in (a.split("=", 1) for a in sys.argv[5:])}
    label = kw.pop("label", None)
    env = WorldEnv(make_backend("reactor", model="reactor/lingbot-world-2"), step_timeout=90)
    try:
        await env.reset(image=image, prompt=prompt, seed=42)
        await env.step("idle", 48)
        r = await getattr(P, name)(env, **kw)
        if label: r.name = f"{r.name}@{label}"
        print(r.name, round(r.score, 3), r.flags, {k: v for k, v in r.details.items() if k not in ("curve", "per_action")})
        run.mkdir(parents=True, exist_ok=True)
        f = run / "results.json"
        data = json.load(open(f)) if f.exists() else {"model": env.model, "created": "", "env": env.info, "probes": []}
        entry = r.to_json(); s = _slug(r.name)
        save_gif(run / f"{s}.gif", r.frames, every=4); entry["gif"] = f"{s}.gif"
        save_png(run / f"{s}_first.png", r.frames[0]); save_png(run / f"{s}_last.png", r.frames[-1])
        entry["first_png"] = f"{s}_first.png"; entry["last_png"] = f"{s}_last.png"
        data["probes"] = [p for p in data["probes"] if p["name"] != r.name] + [entry]
        scores = [p["score"] for p in data["probes"] if "no_motion" not in p.get("flags", [])]
        data["overall"] = round(sum(scores) / len(scores), 4)
        json.dump(data, open(f, "w"), indent=2)
        build("results", "dashboard/index.html"); print("merged; overall", data["overall"])
    finally:
        await env.close()
asyncio.run(main())
