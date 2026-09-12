import asyncio, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv; load_dotenv()
from worldgym import WorldEnv
from worldgym.backends import make_backend
from worldgym.probes import controllability
from worldgym.recorder import save_gif, save_png
from worldgym.scorecard import build
async def main():
    run = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("results/lbw2-street")
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 288
    env = WorldEnv(make_backend("reactor", model="reactor/lingbot-world-2"), step_timeout=90)
    try:
        await env.reset(image=sys.argv[3] if len(sys.argv) > 3 else "assets/anchors/street.jpg", prompt=sys.argv[4] if len(sys.argv) > 4 else "a quiet residential street at golden hour, photoreal", seed=42)
        r = await controllability(env, n_frames=n, settle_frames=96)
        for a, v in r.details["per_action"].items(): print(a, v["ok"], v["flow"], "onset", v["onset_frame"])
        print("score", r.score, "mean onset", r.details["mean_onset_frames"])
        data = json.load(open(run / "results.json"))
        entry = r.to_json()
        save_gif(run / "controllability.gif", r.frames, every=4); entry["gif"] = "controllability.gif"
        save_png(run / "controllability_first.png", r.frames[0]); save_png(run / "controllability_last.png", r.frames[-1])
        entry["first_png"] = "controllability_first.png"; entry["last_png"] = "controllability_last.png"
        data["probes"] = [p for p in data["probes"] if p["name"] != "controllability"] + [entry]
        scores = [p["score"] for p in data["probes"] if "no_motion" not in p.get("flags", [])]
        data["overall"] = round(sum(scores) / len(scores), 4)
        json.dump(data, open(run / "results.json", "w"), indent=2)
        build("results", "dashboard/index.html"); print("merged; overall", data["overall"])
    finally:
        await env.close()
asyncio.run(main())
