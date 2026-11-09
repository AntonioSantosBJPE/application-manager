#!/usr/bin/env bash
# Restores a backup made by backup.sh into TARGET_DATABASE_URL.
#   restore.sh <key|--latest> [--force]
# <key> is the object key (<prefix>/<timestamp>.dump); --latest picks the newest of BACKUP_PREFIX.
# The target database must be empty (no tables, views or sequences outside the system schemas): the
# command refuses otherwise, changing nothing, unless --force, which drops what the backup replaces.
# Prints `migrations=<n>`, the rows of drizzle.__drizzle_migrations found in the target afterwards.
# Needs the same S3 variables as backup.sh. Exit 2: usage or a missing variable. Exit 3: the target is
# not empty. Exit 1: the download or the restore failed.
set -euo pipefail

key=""
force=0
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    --latest) key="--latest" ;;
    -*) echo "restore: unknown option $arg" >&2; exit 2 ;;
    *) key="$arg" ;;
  esac
done
if [ -z "$key" ]; then
  echo "usage: restore.sh <key|--latest> [--force]" >&2
  exit 2
fi

for name in TARGET_DATABASE_URL BACKUP_S3_ENDPOINT BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY BACKUP_BUCKET; do
  if [ -z "${!name:-}" ]; then
    echo "restore: the variable $name is not set" >&2
    exit 2
  fi
done
prefix="${BACKUP_PREFIX:-postgres}"

export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
export AWS_EC2_METADATA_DISABLED=true
s3() { aws --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [ "$key" = "--latest" ]; then
  key="$(s3 s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix "$prefix/" --query 'Contents[].Key' --output json 2>"$work/err" \
    | jq -r '(. // []) | map(select(test("/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\\.dump$"))) | sort | last // empty')" || true
  if [ -z "$key" ]; then
    echo "restore: no backup found under $prefix/ in bucket $BACKUP_BUCKET" >&2
    exit 1
  fi
fi

# The target must be empty before anything is touched: no table, view, sequence, enum, domain, range,
# composite type or function outside the system schemas (and none an extension owns), and no schema of
# its own besides `public`.
objects="$(psql "$TARGET_DATABASE_URL" -tA -v ON_ERROR_STOP=1 -c "
  with user_schemas as (
    select oid, nspname from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema'
  )
  select
    (select count(*) from pg_class c join user_schemas n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f', 'c')
         and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'))
  + (select count(*) from pg_type t join user_schemas n on n.oid = t.typnamespace
       where t.typtype in ('e', 'd', 'r', 'm')
         and not exists (select 1 from pg_depend d where d.classid = 'pg_type'::regclass and d.objid = t.oid and d.deptype = 'e'))
  + (select count(*) from pg_proc p join user_schemas n on n.oid = p.pronamespace
       where not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'))
  + (select count(*) from user_schemas where nspname <> 'public')" 2>"$work/err")" \
  || { echo "restore: cannot read the target database" >&2; exit 1; }
if [ "$objects" != "0" ] && [ "$force" -ne 1 ]; then
  echo "restore: the target database is not empty ($objects objects); nothing was changed. Use --force to replace them." >&2
  exit 3
fi

s3 s3 cp "s3://$BACKUP_BUCKET/$key" "$work/dump" --only-show-errors 2>"$work/err" \
  || { echo "restore: downloading $key failed" >&2; exit 1; }

# One transaction: a restore that fails halfway leaves the target as it was.
flags=(--no-owner --single-transaction --dbname "$TARGET_DATABASE_URL")
if [ "$force" -eq 1 ]; then
  flags+=(--clean --if-exists)
else
  flags+=(--exit-on-error)
fi
pg_restore "${flags[@]}" "$work/dump" 2>"$work/err" || { echo "restore: pg_restore failed: $(head -n 1 "$work/err")" >&2; exit 1; }

migrations="$(psql "$TARGET_DATABASE_URL" -tA -c 'select count(*) from drizzle.__drizzle_migrations' 2>/dev/null || echo 0)"
echo "restored $key"
echo "migrations=$migrations"
