#!/usr/bin/env bash
# Decides which slow CI suites a pull request needs, from the paths it changes (one per line on stdin).
# Prints `repo_rules=`, `e2e=` and `infra=` lines with `true` or `false`, ready for $GITHUB_OUTPUT.
#
# A suite runs when the PR touches what it proves; a push to main, and so every deploy, runs them all
# without asking this script (see .github/workflows/ci.yml). Keep the lists wide: a false `true` costs
# minutes, a false `false` lets a break reach main.
set -euo pipefail

repo_rules=false
e2e=false
infra=false

while IFS= read -r path || [ -n "$path" ]; do
  [ -n "$path" ] || continue

  # The CI itself and this script decide what runs, so a change to them runs everything.
  case "$path" in
    .github/workflows/* | .github/actions/* | scripts/ci-scopes.sh)
      repo_rules=true e2e=true infra=true
      continue
      ;;
  esac

  # Root commands and their configuration (tooling/guardrails/src/root-commands.test.ts).
  case "$path" in
    package.json | */package.json | pnpm-workspace.yaml | pnpm-lock.yaml | turbo.json | .nvmrc | \
      tsconfig*.json | */tsconfig*.json | eslint.config.* | */eslint.config.* | \
      vitest.config.* | */vitest.config.* | .dependency-cruiser.cjs | \
      packages/config/* | packages/ui/.storybook/* | tooling/guardrails/*)
      repo_rules=true
      ;;
  esac

  # Whatever ends up in the images or the browser: the apps, the packages, the stack and the specs.
  case "$path" in
    apps/* | packages/* | tests/e2e/* | compose.yaml | .dockerignore | .env.example | \
      package.json | pnpm-workspace.yaml | pnpm-lock.yaml | .nvmrc)
      e2e=true
      ;;
  esac

  # The production compose, backup, restore and hardening, and what they build or replay.
  case "$path" in
    infra/* | apps/*/Dockerfile | apps/api/drizzle/* | .dockerignore | tooling/guardrails/src/deploy/*)
      infra=true
      ;;
  esac
done

printf 'repo_rules=%s\ne2e=%s\ninfra=%s\n' "$repo_rules" "$e2e" "$infra"
