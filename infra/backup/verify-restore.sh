#!/usr/bin/env bash
# Proves that the newest backup restores: restores it into a scratch database next to the source one,
# compares the applied migrations it carries with the migrations of the repository, and drops the
# scratch database. Exit 0 only when the two counts are equal.
# Needs DATABASE_URL (a role that may CREATE DATABASE, on the same server), the S3 variables of
# backup.sh, and MIGRATIONS_JOURNAL: the path of apps/api/drizzle/meta/_journal.json of the checkout
# whose migrations the backup must contain.
set -euo pipefail

for name in DATABASE_URL MIGRATIONS_JOURNAL; do
  if [ -z "${!name:-}" ]; then
    echo "verify-restore: the variable $name is not set" >&2
    exit 2
  fi
done
if [ ! -r "$MIGRATIONS_JOURNAL" ]; then
  echo "verify-restore: cannot read $MIGRATIONS_JOURNAL" >&2
  exit 2
fi

expected="$(jq '.entries | length' "$MIGRATIONS_JOURNAL")"
scratch="verify_restore_$(date -u +%Y%m%d%H%M%S)_$$"
scratch_url="${DATABASE_URL%/*}/$scratch"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create database $scratch" >/dev/null
drop_scratch() { psql "$DATABASE_URL" -c "drop database if exists $scratch with (force)" >/dev/null 2>&1 || true; }
trap drop_scratch EXIT

here="$(dirname "$0")"
output="$(TARGET_DATABASE_URL="$scratch_url" "$here/restore.sh" --latest)" || {
  echo "verify-restore: the restore failed" >&2
  exit 1
}
actual="$(printf '%s\n' "$output" | sed -n 's/^migrations=//p')"

if [ "$actual" != "$expected" ]; then
  echo "verify-restore: the backup carries $actual migrations, the repository has $expected" >&2
  exit 1
fi
echo "verify-restore: ok, the latest backup restores with all $expected migrations"
