"""Connect to Reactor models and print the commands each one accepts (from its OpenAPI schema).

    python scripts/list_model_commands.py reactor/happy-oyster-adventure reactor/hy-world
    python scripts/list_model_commands.py --out results/model_schemas.json reactor/lingbot-world-2

Use it to see whether a model takes movement / look controls before writing its action
mapping in worldgym/actions.py. Each model costs one short session.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from typing import Any

from dotenv import load_dotenv
from reactor_sdk import Reactor


def _resolve(node: Any, doc: dict[str, Any]) -> Any:
    while isinstance(node, dict) and "$ref" in node:
        cur: Any = doc
        for part in node["$ref"].lstrip("#/").split("/"):
            cur = cur.get(part, {})
        node = cur
    return node


def summarize(doc: dict[str, Any]) -> list[str]:
    """One line per command: name(param: enum-or-type, ...)."""
    lines = []
    for path, ops in (doc.get("paths") or {}).items():
        for method, op in (ops or {}).items():
            if not isinstance(op, dict):
                continue
            name = op.get("operationId") or f"{method.upper()} {path}"
            params = []
            content = ((op.get("requestBody") or {}).get("content") or {})
            schema = _resolve(next(iter(content.values()), {}).get("schema", {}), doc) if content else {}
            for key, prop in ((schema or {}).get("properties") or {}).items():
                prop = _resolve(prop, doc)
                kind = prop.get("enum") or prop.get("type") or ("oneOf" if "oneOf" in prop else "?")
                params.append(f"{key}: {kind}")
            lines.append(f"{name}({', '.join(params)})")
    return lines


async def fetch(model: str, key: str, gate: asyncio.Semaphore) -> tuple[str, dict[str, Any]]:
    async with gate:
        for attempt in range(1, 13):
            client = Reactor(model_name=model, api_key=key)
            try:
                await asyncio.wait_for(client.connect(), 120)
                return model, await asyncio.wait_for(client.request_schema(), 60)
            except Exception as e:  # noqa: BLE001
                if "429" in str(e) and attempt < 12:
                    await asyncio.sleep(10)
                    continue
                return model, {"error": f"{type(e).__name__}: {str(e)[:300]}"}
            finally:
                try:
                    await client.disconnect()
                except Exception:  # noqa: BLE001
                    pass
    return model, {"error": "gave up"}


async def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("models", nargs="+")
    ap.add_argument("--out", default=None, help="write the full schemas to this JSON file")
    ap.add_argument("--parallel", type=int, default=3, help="sessions at once (account limit is 5)")
    args = ap.parse_args()
    key = os.environ["REACTOR_API_KEY"]
    gate = asyncio.Semaphore(args.parallel)
    results = dict(await asyncio.gather(*(fetch(m, key, gate) for m in args.models)))
    for model, doc in results.items():
        print(f"\n== {model}")
        if "error" in doc:
            print("  error:", doc["error"])
            continue
        for line in summarize(doc) or ["(no paths in schema; top-level keys: " + ", ".join(doc) + ")"]:
            print("  " + line)
    if args.out:
        with open(args.out, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nfull schemas -> {args.out}")


if __name__ == "__main__":
    asyncio.run(main())
