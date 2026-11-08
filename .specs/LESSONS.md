# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Start a time-budget clock at the command the criterion names, including any build it implies
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: walking-skeleton
- evidence: C1 (e2e)
- last seen: 2026-11-03T11:30:14Z

### L-002 - Prove a timeout from both sides: a response just under the limit succeeds and the failure arrives at the limit, not merely before a loose ceiling
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `timeouts` · harmful: 0
- features: walking-skeleton
- evidence: C4 (timeouts) (+1 more)
- last seen: 2026-11-03T11:30:15Z

### L-003 - Prove a guard-rail through the root command that runs it, not only through the tool's API
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `guardrails` · harmful: 0
- features: walking-skeleton
- evidence: C23 (guardrails)
- last seen: 2026-11-03T11:30:15Z

### L-004 - Lint rules on class names must cover every syntax of the framework version in use and strings held in variables
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `lint` · harmful: 0
- features: walking-skeleton
- evidence: GUARD-10 (lint)
- last seen: 2026-11-03T11:30:15Z

### L-005 - Register request-id logging before body parsing so rejected requests still echo and log the id
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api-logging` · harmful: 0
- features: walking-skeleton
- evidence: LOG-02 (api-logging)
- last seen: 2026-11-03T11:30:15Z

### L-006 - Install git hooks from a root prepare script so CI environment variables cannot skip them
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `git-hooks` · harmful: 0
- features: walking-skeleton
- evidence: SEC-02 (git-hooks)
- last seen: 2026-11-03T11:30:15Z

### L-007 - Derive the list of required environment variables from every process.env read, not from one schema
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `env` · harmful: 0
- features: walking-skeleton
- evidence: C12 (env)
- last seen: 2026-11-03T11:30:15Z

### L-008 - A toggle criterion needs an assertion on each state it toggles between
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `ui` · harmful: 0
- features: walking-skeleton
- evidence: C35 (ui)
- last seen: 2026-11-03T11:30:15Z

### L-009 - Prove each half of a two-part rule with a test that fails when that half alone is mutated
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: identity
- evidence: verification.md finding 1 (LOCK-06) (api)
- last seen: 2026-11-07T18:08:07Z

### L-010 - Test a platform-dependent I/O path against the real implementation, not only an injected fake
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `cli` · harmful: 0
- features: identity
- evidence: verification.md finding 6 (CLI-06) (cli)
- last seen: 2026-11-07T18:08:07Z

### L-011 - Run accessibility scans on every state of a screen, including alerts, dialogs and error screens, not only the resting one
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `web` · harmful: 0
- features: identity
- evidence: verification.md finding 8 (UI-22) (web)
- last seen: 2026-11-07T18:08:07Z

### L-012 - Give every submit control a test that holds the pending state and blocks a double submit
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `web` · harmful: 0
- features: identity
- evidence: verification.md finding 11 (UI-23) (web)
- last seen: 2026-11-07T18:08:07Z

### L-013 - Keep per-commit gates under a minute and move whole-repo meta-tests into their own job, since a test that reruns the repo saturates the machine and times out the rest
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `repo` · harmful: 0
- features: identity
- evidence: proofs.md C68 and root-commands timeouts (repo)
- last seen: 2026-11-07T18:08:07Z

### L-014 - Refuse control characters such as U+0000 in every text the API stores in Postgres, at the contract schema, so the request gets 400 and not 500
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `contracts` · harmful: 0
- features: skills
- evidence: verification.md finding 1; packages/contracts/src/skills.ts:21 (contracts)
- last seen: 2026-11-08T18:24:42Z

### L-015 - In a concurrency test, race writes on different resources unless the spec fixes the outcome of every interleaving, so an idempotent winner cannot flake the status count
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `api-integration` · harmful: 0
- features: skills
- evidence: verification.md finding 2; apps/api/src/modules/skills/http/skills-invariants.int.test.ts (api-integration)
- last seen: 2026-11-08T18:24:42Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
