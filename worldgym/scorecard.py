"""Build a single static HTML scorecard from results/*/results.json (no server needed)."""

from __future__ import annotations

import html
import json
from pathlib import Path

CSS = """
:root{--bg:#0e0f12;--card:#17191f;--ink:#e8e8ea;--mut:#9a9ca6;--good:#3fb950;--mid:#d29922;--bad:#f85149;--line:#2a2d36}
*{box-sizing:border-box}body{margin:0;padding:24px;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px}p.sub{color:var(--mut);margin:0 0 20px}
table{border-collapse:collapse;width:100%;max-width:1100px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.score{font-variant-numeric:tabular-nums;font-weight:700}.g{color:var(--good)}.m{color:var(--mid)}.b{color:var(--bad)}
.bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden;width:120px}.bar i{display:block;height:100%}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;max-width:1100px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.card img,.card video{width:100%;border-radius:6px;background:#000}.card .row{display:flex;gap:8px;margin-top:8px}.card .row img{width:50%}
.k{color:var(--mut);font-size:12px}code{background:#22252d;padding:1px 5px;border-radius:4px;font-size:12px}
.flag{display:inline-block;background:#3a2a10;color:#f0b64a;padding:1px 6px;border-radius:4px;font-size:11px;margin-left:6px}
"""


def _cls(v: float) -> str:
    return "g" if v >= 0.7 else ("m" if v >= 0.4 else "b")


def _bar(v: float) -> str:
    color = {"g": "var(--good)", "m": "var(--mid)", "b": "var(--bad)"}[_cls(v)]
    return f'<div class="bar"><i style="width:{int(v*100)}%;background:{color}"></i></div>'


def build(results_root: str | Path = "results", out_path: str | Path = "dashboard/index.html") -> Path:
    root = Path(results_root)
    runs = []
    for rj in sorted(root.glob("*/results.json")):
        data = json.loads(rj.read_text())
        data["_dir"] = rj.parent
        runs.append(data)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    probe_names: list[str] = []
    for r in runs:
        for p in r["probes"]:
            if p["name"] not in probe_names:
                probe_names.append(p["name"])

    parts = [f"<!doctype html><meta charset=utf-8><title>WorldGym scorecard</title><style>{CSS}</style>",
             "<h1>WorldGym scorecard</h1><p class=sub>Physics-consistency probes for real-time world models. "
             "Scores in [0,1]; higher is more consistent/controllable.</p>"]
    notes = root / "notes.html"  # optional hand-written findings, inserted verbatim
    if notes.exists():
        parts.append(notes.read_text())
    # summary table
    parts.append("<table><tr><th>Run</th><th>Model</th><th>Overall</th>" +
                 "".join(f"<th>{html.escape(n)}</th>" for n in probe_names) + "</tr>")
    for r in runs:
        by = {p["name"]: p for p in r["probes"]}
        cells = []
        for n in probe_names:
            p = by.get(n)
            if not p:
                cells.append("<td class=k>—</td>")
                continue
            flags = "".join(f'<span class=flag>{html.escape(f)}</span>' for f in p.get("flags", []))
            cells.append(f'<td><span class="score {_cls(p["score"])}">{p["score"]:.2f}</span>{flags}{_bar(p["score"])}</td>')
        parts.append(f"<tr><td><code>{html.escape(r['_dir'].name)}</code><br><span class=k>{html.escape(r.get('created',''))}</span></td>"
                     f"<td>{html.escape(r['model'])}</td><td><span class='score {_cls(r['overall'])}'>{r['overall']:.2f}</span></td>"
                     + "".join(cells) + "</tr>")
    parts.append("</table>")

    # per-run cards with gifs
    for r in runs:
        rel = r["_dir"].relative_to(out.parent) if r["_dir"].is_relative_to(out.parent) else Path("..") / r["_dir"]
        env = r.get("env", {})
        parts.append(f"<h2>{html.escape(r['_dir'].name)} · {html.escape(r['model'])}</h2>"
                     f"<p class=k>time to first frame: {env.get('time_to_first_frame_s','?')} s · steps: {env.get('steps','?')}</p><div class=grid>")
        for p in r["probes"]:
            d = p.get("details", {})
            extra = ""
            if "closure" in d:
                moved = d["moved"] if "moved" in d else 1.0 - (d.get("min_similarity_during_turn") or 1.0)
                extra = (f"closure {d['closure']['score']:.2f} (ssim {d['closure']['ssim']:.2f}, orb {d['closure']['orb']:.2f}) · "
                         f"moved {moved:.2f}")
            elif "per_action" in d:
                oks = [f"{a}{'✓' if v.get('ok') else '✗'}" for a, v in d["per_action"].items()]
                extra = " ".join(oks) + (f" · onset ≈ {d['mean_onset_frames']:.0f} frames" if d.get("mean_onset_frames") else "")
            elif "mean_similarity" in d:
                extra = f"mean {d['mean_similarity']:.2f} · end {d['end_similarity']:.2f}"
            gif = f'<img src="{rel}/{p["gif"]}" loading=lazy>' if p.get("gif") else ""
            fl = f'<div class=row><img src="{rel}/{p["first_png"]}"><img src="{rel}/{p["last_png"]}"></div>' if p.get("first_png") else ""
            flags = "".join(f'<span class=flag>{html.escape(f)}</span>' for f in p.get("flags", []))
            parts.append(f"<div class=card><b>{html.escape(p['name'])}</b> <span class='score {_cls(p['score'])}'>{p['score']:.2f}</span>{flags}"
                         f"<div class=k>{html.escape(extra)} · {p['wall_seconds']}s · {p['n_frames']} frames</div>{gif}{fl}</div>")
        parts.append("</div>")
    out.write_text("\n".join(parts))
    return out
