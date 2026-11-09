#!/usr/bin/env bash
# Waits for the stack behind <url> to answer: GET <url>/status must return HTTP 200 and a page whose
# "API" row says "Operacional" (the web answers 200 with "Indisponivel" when the api is down, so the
# status code alone proves nothing). Polls every SMOKE_INTERVAL seconds (default 10) for at most
# SMOKE_TIMEOUT seconds (default 300). On failure it prints the last HTTP status and exits 1.
set -euo pipefail

url="${1:?usage: smoke.sh <url>}"
interval="${SMOKE_INTERVAL:-10}"
timeout="${SMOKE_TIMEOUT:-300}"
target="${url%/}/status"
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

deadline=$((SECONDS + timeout))
last_status="000"
while :; do
  last_status="$(curl -sS -o "$body" -w '%{http_code}' --max-time 10 "$target" 2>/dev/null || true)"
  last_status="${last_status:-000}"
  if [ "$last_status" = "200" ]; then
    # Strip the markup, then look for the API row followed by its state.
    text="$(sed -e 's/<[^>]*>/ /g' "$body" | tr -s '[:space:]' ' ')"
    if printf '%s' "$text" | grep -q 'API Operacional'; then
      echo "smoke: ok, the api is operational at $target"
      exit 0
    fi
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "smoke: failed, no operational api at $target within ${timeout}s (last HTTP status: $last_status)" >&2
    exit 1
  fi
  sleep "$interval"
done
