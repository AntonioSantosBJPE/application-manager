---
name: feature-worktree
description: Creates, configures, lists or removes the git worktree of a feature in this repository (branch feat/<feature>, own .env and ports) so it can be specified and built with tlc-spec-driven in isolation. Use when the user says "nova feature em worktree", "abrir worktree", "feature-worktree", "trabalhar em paralelo", "remover worktree" or "listar worktrees". Do NOT use to write the spec or implement - that is tlc-spec-driven, run inside the worktree.
---

# Feature Worktree

The workflow lives in [docs/workflow.md](../../../docs/workflow.md); read it before acting. Everything goes through `scripts/worktree.sh` — never call `git worktree` directly, or the worktree misses its `.env` and port slot.

| User wants | Run (from the main checkout) |
|---|---|
| Start a feature | `scripts/worktree.sh new <feature>` |
| Configure a worktree created elsewhere | `scripts/worktree.sh init` (inside it) |
| See what is open | `scripts/worktree.sh list` |
| Clean up after merge | `scripts/worktree.sh remove <feature>` |

Rules:
- `<feature>` is kebab-case and matches `.specs/features/<feature>` when a spec exists.
- Before `new`, check `list`: if an open feature touches the same files, say so and ask before creating a parallel one.
- After `new`, the spec and implementation happen in a session opened in the worktree folder, not in this one. Tell the user the path and that `/tlc-spec-driven` runs there.
- `remove` deletes the worktree's containers and volumes. Confirm with the user first when the branch is not merged.
- Pushing the branch and opening the PR need the user's go-ahead.
