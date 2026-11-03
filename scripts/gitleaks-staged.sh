#!/usr/bin/env bash
# Pre-commit secret scan (SEC-01). Exports the staged version of every added or changed
# file to a temporary directory and runs `gitleaks dir` on it, so the scan sees exactly
# what is about to be committed and never mounts .git (a file inside a worktree).
# Uses a local `gitleaks` binary when present, otherwise the pinned container image.
set -euo pipefail

GITLEAKS_IMAGE="ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f"

staged="$(git diff --cached --name-only --diff-filter=ACMR -z | tr '\0' '\n')"
[[ -n "$staged" ]] || exit 0

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git diff --cached --name-only --diff-filter=ACMR -z | git checkout-index --prefix="$tmp/" -z --stdin

if command -v gitleaks >/dev/null 2>&1; then
  scan=(gitleaks dir "$tmp")
  prefix="$tmp/"
elif command -v docker >/dev/null 2>&1; then
  scan=(docker run --rm -v "$tmp:/scan:ro" "$GITLEAKS_IMAGE" dir /scan)
  prefix="/scan/"
else
  echo "gitleaks-staged: neither gitleaks nor docker is available; cannot scan for secrets" >&2
  exit 1
fi

set +e
"${scan[@]}" --no-banner --no-color --redact --verbose 2>&1 | sed "s#${prefix}##g"
status="${PIPESTATUS[0]}"
set -e

if [[ "$status" -ne 0 ]]; then
  echo "gitleaks-staged: secret found in staged files; commit blocked" >&2
fi
exit "$status"
