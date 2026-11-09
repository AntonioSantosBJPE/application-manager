#!/usr/bin/env bash
# Waits for the stack behind <url> to answer: GET <url>/status must return HTTP 200 and a page whose
# "API" row says "Operacional" (the web answers 200 with "Indisponivel" when the api is down, so the
# status code alone proves nothing).
# With SMOKE_EXPECTED_VERSION set, the response must also carry `x-app-version: <that value>`, the
# build the web image was made from. Without it, a deploy that failed halfway (a migration that
# exits 1 leaves the previous api and web running) would look healthy.
# Polls every SMOKE_INTERVAL seconds (default 10) for at most SMOKE_TIMEOUT seconds (default 300).
# On failure it prints the last HTTP status and the version it saw, and exits 1.
set -euo pipefail

url="${1:?usage: smoke.sh <url>}"
interval="${SMOKE_INTERVAL:-10}"
timeout="${SMOKE_TIMEOUT:-300}"
expected_version="${SMOKE_EXPECTED_VERSION:-}"
target="${url%/}/status"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

deadline=$((SECONDS + timeout))
last_status="000"
seen_version=""
while :; do
  last_status="$(curl -sS -o "$work/body" -D "$work/headers" -w '%{http_code}' --max-time 10 "$target" 2>/dev/null || true)"
  last_status="${last_status:-000}"
  seen_version="$(sed -n 's/^[Xx]-[Aa]pp-[Vv]ersion:[[:space:]]*//p' "$work/headers" 2>/dev/null | tr -d '\r' | tail -n 1 || true)"
  if [ "$last_status" = "200" ]; then
    # Strip the markup, then look for the API row followed by its state.
    text="$(sed -e 's/<[^>]*>/ /g' "$work/body" | tr -s '[:space:]' ' ')"
    if printf '%s' "$text" | grep -q 'API Operacional'; then
      if [ -z "$expected_version" ] || [ "$seen_version" = "$expected_version" ]; then
        echo "smoke: ok, the api is operational at $target${expected_version:+ (version $seen_version)}"
        exit 0
      fi
    fi
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "smoke: failed, no operational api at $target within ${timeout}s (last HTTP status: $last_status${expected_version:+, version seen: ${seen_version:-none}, expected: $expected_version})" >&2
    exit 1
  fi
  sleep "$interval"
done
