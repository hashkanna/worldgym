#!/usr/bin/env bash
# Assemble site/ for Cloudflare Pages: landing page, scorecard, findings, exhibits, probe runs, viewer.
#   scripts/build_site.sh && npx wrangler pages deploy site --project-name worldgym
# functions/token.js (the viewer's /token endpoint) is picked up from the repo root by wrangler.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf site
mkdir -p site/results
cp -R dashboard site/dashboard
cp dashboard/findings.html site/index.html   # the findings page is the front door
rm -rf site/dashboard/findings
cp -R webxr site/webxr
rm -f site/webxr/serve.py
for run in results/*/; do
  # no trailing slash: BSD cp would copy the folder's contents instead of the folder
  [ "$run" = "results/_archive/" ] || cp -R "${run%/}" site/results/
done

# Pages rejects files over 25 MiB
big=$(find site -type f -size +25M)
if [ -n "$big" ]; then echo "too large for Pages:"; echo "$big"; exit 1; fi
echo "site/ ready: $(du -sh site | cut -f1), $(find site -type f | wc -l | tr -d ' ') files"
