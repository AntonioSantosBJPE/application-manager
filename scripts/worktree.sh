#!/usr/bin/env bash
# Manage one git worktree per feature, each with its own branch, .env and ports,
# so several features can be specified, built and run at the same time.
#
#   scripts/worktree.sh new <feature> [base]   create ../<repo>.worktrees/<feature> on feat/<feature>
#   scripts/worktree.sh init                   configure the current worktree (.env, ports, deps)
#   scripts/worktree.sh list                   list worktrees and their port slots
#   scripts/worktree.sh remove <feature>       stop its containers, remove the worktree, delete the branch if merged
set -euo pipefail

main_root="$(git rev-parse --path-format=absolute --git-common-dir | xargs dirname)"
repo_name="$(basename "$main_root")"
worktrees_dir="$(dirname "$main_root")/${repo_name}.worktrees"

die() { echo "error: $*" >&2; exit 1; }

valid_name() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "feature name must be kebab-case: '$1'"
}

# Slot 0 is the main checkout; worktrees take the smallest free slot from 1 up.
used_slots() {
  git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r dir; do
    [[ -f "$dir/.env" ]] && grep -E '^WORKTREE_SLOT=' "$dir/.env" | cut -d= -f2
  done
}

next_slot() {
  local used n=1
  used="$(used_slots)"
  while grep -qx "$n" <<<"$used"; do n=$((n + 1)); done
  echo "$n"
}

set_env() {
  local file="$1" key="$2" value="$3"
  if grep -qE "^${key}=" "$file"; then
    sed -i.bak -E "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "$file.bak"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

cmd_init() {
  local root slot name
  root="$(git rev-parse --show-toplevel)"
  [[ "$root" != "$main_root" ]] || die "init runs inside a worktree, not in the main checkout"
  name="$(basename "$root")"

  if [[ ! -f "$root/.env" ]]; then
    if [[ -f "$root/.env.example" ]]; then cp "$root/.env.example" "$root/.env"; else touch "$root/.env"; fi
  fi

  slot="$(grep -E '^WORKTREE_SLOT=' "$root/.env" | cut -d= -f2 || true)"
  [[ -n "$slot" ]] || slot="$(next_slot)"

  set_env "$root/.env" WORKTREE_SLOT "$slot"
  set_env "$root/.env" COMPOSE_PROJECT_NAME "am-${name}"
  set_env "$root/.env" WEB_PORT "$((3000 + slot * 10))"
  set_env "$root/.env" API_PORT "$((3333 + slot * 10))"
  set_env "$root/.env" POSTGRES_PORT "$((5432 + slot * 10))"

  if [[ -f "$root/package.json" ]]; then
    (cd "$root" && pnpm install)
  fi

  echo "worktree '$name' ready on slot $slot: web $((3000 + slot * 10)), api $((3333 + slot * 10)), postgres $((5432 + slot * 10))"
}

cmd_new() {
  local feature="${1:-}" base="${2:-main}" path branch
  [[ -n "$feature" ]] || die "usage: worktree.sh new <feature> [base]"
  valid_name "$feature"
  path="$worktrees_dir/$feature"
  branch="feat/$feature"
  [[ ! -e "$path" ]] || die "$path already exists"

  mkdir -p "$worktrees_dir"
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$path" "$branch"
  else
    git worktree add -b "$branch" "$path" "$base"
  fi
  (cd "$path" && "$main_root/scripts/worktree.sh" init)

  echo
  echo "next: open your coding agent in $path and run the tlc-spec-driven skill for '$feature'"
}

cmd_list() {
  git worktree list --porcelain | awk '/^worktree /{dir=$2} /^branch /{print dir, $2}' | while read -r dir ref; do
    local slot=""
    [[ -f "$dir/.env" ]] && slot="$(grep -E '^WORKTREE_SLOT=' "$dir/.env" | cut -d= -f2 || true)"
    [[ "$dir" == "$main_root" ]] && slot="0"
    printf '%-60s %-35s slot %s\n' "$dir" "${ref#refs/heads/}" "${slot:--}"
  done
}

cmd_remove() {
  local feature="${1:-}" path branch
  [[ -n "$feature" ]] || die "usage: worktree.sh remove <feature>"
  valid_name "$feature"
  path="$worktrees_dir/$feature"
  branch="feat/$feature"
  [[ -d "$path" ]] || die "no worktree at $path"

  if [[ -f "$path/compose.yaml" || -f "$path/docker-compose.yml" ]]; then
    (cd "$path" && docker compose down --volumes --remove-orphans) || true
  fi
  git worktree remove "$path"
  if git branch -d "$branch" 2>/dev/null; then
    echo "removed $path and merged branch $branch"
  else
    echo "removed $path; branch $branch kept (not merged into the current branch)"
  fi
}

case "${1:-}" in
  new) shift; cmd_new "$@" ;;
  init) shift; cmd_init "$@" ;;
  list) shift; cmd_list "$@" ;;
  remove) shift; cmd_remove "$@" ;;
  *) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
