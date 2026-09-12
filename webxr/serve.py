"""Tiny static + token server for the WorldXR viewer (stdlib only).

    python webxr/serve.py                # http://localhost:8000
    cloudflared tunnel --url http://localhost:8000   # public https URL for the Vision Pro
    (or: ngrok http 8000)

WebXR needs a secure context, and the Vision Pro is a different device, so `localhost`
on your Mac doesn't count there -- hence the tunnel. Only run it while demoing: the
/token endpoint mints short-lived session JWTs from your REACTOR_API_KEY.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent
API = "https://api.reactor.inc/tokens"


def mint_token(model: str, api_key: str, ttl_s: int = 3600) -> dict:
    body = json.dumps({
        "authorization_details": [{"type": "session", "resources": {"models": {"match": [model]}}}],
        "expires_after": ttl_s,
    }).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Reactor-API-Key": api_key, "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def _json(self, code: int, obj: dict) -> None:
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:  # noqa: N802
        if self.path.split("?")[0] != "/token":
            return self._json(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            payload = {}
        model = payload.get("model") or os.environ.get("WORLDGYM_MODEL", "reactor/lingbot-world-2")
        key = os.environ.get("REACTOR_API_KEY")
        if not key:
            return self._json(500, {"error": "REACTOR_API_KEY not set"})
        try:
            tok = mint_token(model, key)
        except urllib.error.HTTPError as e:
            return self._json(e.code, {"error": e.read().decode(errors="replace")[:500]})
        except Exception as e:  # noqa: BLE001
            return self._json(502, {"error": str(e)})
        return self._json(200, {"jwt": tok.get("jwt"), "model": model})

    def end_headers(self) -> None:
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # quieter
        if self.command == "POST" or "/token" in str(args[0] if args else "") or fmt.startswith("code "):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"WorldXR viewer on http://localhost:{port}  (model: {os.environ.get('WORLDGYM_MODEL', 'reactor/lingbot-world-2')})")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
