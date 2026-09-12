#!/usr/bin/env bash
# Render the WorldGym demo video end to end -> demo/worldgym-demo.mp4 (+ demo/build/sheet.png to eyeball).
#   scripts/demo_video/make.sh                 SITE=https://<deploy>.pages.dev scripts/demo_video/make.sh
# Needs macOS `say`, ffmpeg, node and Google Chrome. Edit narration and visuals in scenes.json.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
cd "$root"

[ -d "$here/node_modules/playwright-core" ] || (cd "$here" && npm install --silent)
node "$here/render.mjs"
python3 "$here/build.py"

# contact sheet: one frame every 5 s
ffmpeg -v error -y -i demo/worldgym-demo.mp4 -vf "fps=1/5,scale=384:-1,tile=5x6:padding=4" -frames:v 1 demo/build/sheet.png
echo "sheet -> demo/build/sheet.png"
