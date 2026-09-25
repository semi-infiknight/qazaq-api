#!/usr/bin/env bash
# Verify local API matches current KZ catalogue (723 APIs after foreign rebadge filter).
set -euo pipefail

API="${1:-http://127.0.0.1:8787}"

if ! curl -sf "$API/health" >/dev/null; then
  echo "FAIL: API not reachable at $API (run npm run dev:reset)"
  exit 1
fi

python3 - "$API" <<'PY'
import json, sys, urllib.request

api = sys.argv[1]
search = json.loads(urllib.request.urlopen(f"{api}/api/search?limit=3", timeout=10).read())
health = json.loads(urllib.request.urlopen(f"{api}/health", timeout=10).read())

total = search.get("catalogueTotal", search.get("total", 0))
health_count = health.get("apis", 0)
first = (search.get("apis") or [{}])[0].get("title", "")

fail = False
if total != 723:
    print(f"FAIL: search total={total} (expected 723 — stale catalogue or filter drift?)")
    fail = True
if health_count != 723:
    print(f"FAIL: /health apis={health_count} (expected 723)")
    fail = True
if first.startswith("Kaspi") or first.startswith("2GIS"):
    print(f"OK: first API is {first}")
elif first.lower().startswith("prices") or "price" in first.lower()[:12]:
    print(f"FAIL: first API is {first!r} (Prices-first = stale catalogue sort)")
    fail = True
else:
    print(f"WARN: first API is {first!r} (expected Kaspi or 2GIS)")

if fail:
    print("Run: npm run dev:reset")
    sys.exit(1)
print(f"OK: local dev API at {api} matches current KZ catalogue")
PY

if curl -sf "http://127.0.0.1:5173/api/search?limit=1" >/dev/null 2>&1 || curl -sf "http://localhost:5173/api/search?limit=1" >/dev/null 2>&1; then
  echo "OK: Vite proxy on :5173 is wired to the API"
else
  echo "WARN: Vite on :5173 not proxying yet — wait a few seconds or run npm run dev:reset"
fi
