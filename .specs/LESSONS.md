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

### L-016 - Store each searchable field apart (or joined by a separator the query normalization cannot produce) so a search never matches text that spans two fields
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api-search` · harmful: 0
- features: application
- evidence: verification.md finding 1 (APP-13) (api-search)
- last seen: 2026-11-09T00:10:51Z

### L-017 - Refuse an empty value in a comma-separated query list instead of turning it into an empty IN that filters everything out
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api-query` · harmful: 0
- features: application
- evidence: verification.md finding 2 (APP-12, APP-17) (api-query)
- last seen: 2026-11-09T00:10:51Z

### L-018 - Trim optional free text and store a blank as absent, so the UI never renders a separator before nothing
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api-validation` · harmful: 0
- features: application
- evidence: verification.md finding 3 (APP-23) (api-validation)
- last seen: 2026-11-09T00:10:51Z

### L-019 - Test each screen's error message with a 4xx refusal as well as a 5xx, since a shared mapper may collapse every refusal into 'unavailable'
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `web-errors` · harmful: 0
- features: application
- evidence: verification.md finding 4 (APP-55, APP-64, APP-78) (web-errors)
- last seen: 2026-11-09T00:10:51Z

### L-020 - A web test asserts what the web sends to the API, never matching rules implemented inside the fake API
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `web-tests` · harmful: 0
- features: application
- evidence: verification.md finding 5 (APP-46) (web-tests)
- last seen: 2026-11-09T00:10:51Z

### L-021 - Prove a narrow-width criterion by asserting which elements are visible and where blocks sit, not only the absence of horizontal overflow
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: application
- evidence: verification.md findings 6-7 (APP-56, APP-79) (e2e)
- last seen: 2026-11-09T00:10:51Z

### L-022 - When an action on one screen must change another, test the second screen after the action, not only the screen where it happened
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `web-routes` · harmful: 0
- features: application
- evidence: verification.md finding 8 (APP-82) (web-routes)
- last seen: 2026-11-09T00:10:51Z

### L-023 - Assert the intent (danger, warning) a criterion names on the component, since a role like status matches every intent
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `web-tests` · harmful: 0
- features: application
- evidence: verification.md finding 9 (APP-75, APP-80) (web-tests)
- last seen: 2026-11-09T00:10:51Z

### L-024 - Tests write generated artifacts to their output folder by default and overwrite versioned files only behind an explicit flag
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: application
- evidence: verification.md finding 10 (e2e captures) (e2e)
- last seen: 2026-11-09T00:10:51Z

### L-025 - A keyboard-only journey reaches every control with Tab or shortcuts and asserts focus, never locator.focus()
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: application
- evidence: verification.md finding 11 (keyboard journey) (e2e)
- last seen: 2026-11-09T00:10:51Z

### L-026 - Fix a layout gap in the shared archetype with a ui test, never with a page-level class override
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `ui-layout` · harmful: 0
- features: application
- evidence: verification.md finding 12 (ListPage width) (ui-layout)
- last seen: 2026-11-09T00:10:51Z

### L-027 - When a criterion adds a control a binding capture does not draw, record it in Differences from the source before the spec is approved
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `spec-captures` · harmful: 0
- features: application
- evidence: verification.md finding 13 (APP-59, APP-73) (spec-captures)
- last seen: 2026-11-09T00:10:51Z

### L-028 - Run the closing gate with pnpm test --force so a cached green cannot hide a guardrail that a new env read breaks
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `gates` · harmful: 0
- features: application
- evidence: orchestrator: CAPTURE missing from .env.example passed the worker gate through the turbo cache (gates)
- last seen: 2026-11-09T00:10:51Z

### L-029 - A post-deploy health check must also prove the new version answers, not only that something healthy answers, or the old release passes it while the deploy fails
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `deploy` · harmful: 0
- features: production-deploy
- evidence: smoke.sh:23 (deploy)
- last seen: 2026-11-09T11:11:37Z

### L-030 - Test a workflow or CI condition by evaluating it for each situation (green, red, manual, rollback), not by matching substrings of its expression
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `ci` · harmful: 0
- features: production-deploy
- evidence: deploy-workflow.test.ts:69 (ci)
- last seen: 2026-11-09T11:11:37Z

### L-031 - In bash with set -e, a function called on the left of && or inside an if runs with errexit off, so report success through a variable and call it as a plain statement
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `scripts` · harmful: 0
- features: production-deploy
- evidence: harden.sh:120 (scripts)
- last seen: 2026-11-09T11:11:37Z

### L-032 - Validate numeric and credential settings before use and fail with a structured message, since a value such as a password with a slash otherwise surfaces as a tool error that echoes pieces of the secret
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `scripts` · harmful: 0
- features: production-deploy
- evidence: backup.sh:62 (scripts)
- last seen: 2026-11-09T11:11:37Z

### L-033 - When a binding capture draws a control only in some states, the criterion names each state it shows in, at rest and on hover, so the spec never contradicts the capture.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec` · harmful: 0
- features: master-resume
- evidence: RES-69 (spec)
- last seen: 2026-11-10T22:16:28Z

### L-034 - Never surface the api Problem Details detail on a pt-BR screen; field errors are web-owned pt-BR messages and an api refusal shows a fixed pt-BR sentence.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `apps/web` · harmful: 0
- features: master-resume
- evidence: spec Assumptions: Falha ao salvar (apps/web)
- last seen: 2026-11-10T22:16:28Z

### L-035 - Workers run each gate as its own command and check its exit code, and never redirect gate output into a file inside the repo.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `workflow` · harmful: 0
- features: master-resume
- evidence: a319349 gate.out; T28 amend (workflow)
- last seen: 2026-11-10T22:16:28Z

### L-036 - A criterion that names several sections, bounds or a variant gets an assertion for each one, not a representative case.
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: master-resume
- evidence: C2, C13, C19, C38 (tests)
- last seen: 2026-11-10T22:16:29Z

### L-037 - A length limit on the web covers every free-text field including inline edits, and maxLength must not silently cut a paste.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `apps/web` · harmful: 0
- features: master-resume
- evidence: RES-85 (apps/web)
- last seen: 2026-11-10T22:16:29Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
