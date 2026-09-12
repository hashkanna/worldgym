"""Rebuild dashboard/findings.html from template.html, inlining frames/*.jpg as data URIs.

    python dashboard/findings/build.py
"""
import base64
import re
import sys
from pathlib import Path

here = Path(__file__).parent
frames = here / "frames"
src = (here / "template.html").read_text()


def inline(m: re.Match) -> str:
    path = frames / f"{m.group(1)}.jpg"
    return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode()


out = re.sub(r"\{\{([\w.]+)\}\}", inline, src)
if "{{" in out:
    sys.exit("unreplaced token left in page")
dest = here.parent / "findings.html"
dest.write_text(out)
print(dest, f"{len(out) / 1024:.0f} KB")
