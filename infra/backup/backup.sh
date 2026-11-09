#!/usr/bin/env bash
# Daily Postgres backup to an S3-compatible bucket (R2 in production, MinIO in tests).
#   backup.sh --once               one cycle now, exit code = the cycle's
#   backup.sh                      one cycle a day, at BACKUP_SCHEDULE_UTC_HOUR (UTC, default 3)
#   backup.sh --seconds-until <h> [now-epoch]   prints the seconds until the next <h>:00 UTC and exits
# A cycle is: pg_dump (custom format) -> upload to <bucket>/<prefix>/<UTC ISO 8601>.dump -> delete the
# backups of the prefix older than BACKUP_RETENTION_DAYS. The retention runs only after an upload
# succeeded, so a failing backup never shortens the history. The age of a backup is the timestamp in
# its key. Logs are one JSON object per line; no credential is ever written.
set -euo pipefail

# Seconds from now-epoch until the next occurrence of <hour>:00:00 UTC (a full day when it is that
# instant now).
seconds_until() {
  local hour="$((10#$1))" now="$2"
  local midnight=$((now - now % 86400))
  local target=$((midnight + hour * 3600))
  if [ "$target" -le "$now" ]; then
    target=$((target + 86400))
  fi
  echo $((target - now))
}

if [ "${1:-}" = "--seconds-until" ]; then
  seconds_until "${2:?usage: backup.sh --seconds-until <hour> [now-epoch]}" "${3:-$(date -u +%s)}"
  exit 0
fi

mode="${1:-}"
case "$mode" in
  "" | --once) ;;
  *) echo "usage: backup.sh [--once]" >&2; exit 2 ;;
esac

log() { # log <level> <message>
  printf '{"level":"%s","time":"%s","msg":"%s"}\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$2"
}

for name in DATABASE_URL BACKUP_S3_ENDPOINT BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY BACKUP_BUCKET; do
  if [ -z "${!name:-}" ]; then
    log error "the variable $name is not set"
    exit 2
  fi
done

prefix="${BACKUP_PREFIX:-postgres}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
schedule_hour="${BACKUP_SCHEDULE_UTC_HOUR:-3}"

# Settings are checked before anything runs: a retention of 0 would delete the backup just uploaded, and
# a bad number would otherwise surface as a shell error outside the JSON log.
if ! [[ "$retention_days" =~ ^[1-9][0-9]{0,3}$ ]]; then
  log error "BACKUP_RETENTION_DAYS must be a whole number of days, at least 1"
  exit 2
fi
if ! [[ "$schedule_hour" =~ ^(0?[0-9]|1[0-9]|2[0-3])$ ]]; then
  log error "BACKUP_SCHEDULE_UTC_HOUR must be an hour from 0 to 23"
  exit 2
fi
# The password sits in a URL, so a character that URLs reserve breaks it and makes the tools echo pieces
# of it in their errors. Only what needs no encoding is accepted (openssl rand -hex 32 makes one).
db_password=""
if [[ "$DATABASE_URL" == *@* ]]; then
  db_userinfo="${DATABASE_URL#*://}"
  db_userinfo="${db_userinfo%@*}"
  db_password="${db_userinfo#*:}"
  if ! [[ "$db_password" =~ ^[A-Za-z0-9._~%-]*$ ]]; then
    log error "the database password in DATABASE_URL has characters a URL reserves; use only letters and digits (openssl rand -hex 32)"
    exit 2
  fi
fi

# The aws client reads its credentials from the environment, never from the command line.
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
export AWS_EC2_METADATA_DISABLED=true

s3() { aws --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"; }

# First line of a tool's error output with every secret blanked out.
first_error_line() {
  local line
  line="$(head -n 1 "$1" | tr -d '"\\')"
  for secret in "$BACKUP_S3_SECRET_ACCESS_KEY" "$BACKUP_S3_ACCESS_KEY_ID" "$DATABASE_URL" "$db_password"; do
    [ -n "$secret" ] && line="${line//"$secret"/***}"
  done
  printf '%s' "$line"
}

fail() { # fail <what> <error-file>
  log error "$1 failed: $(first_error_line "$2")"
  return 1
}

# Deletes the backups of the prefix whose key timestamp is older than the retention.
apply_retention() {
  local cutoff keys key stamp errors="$1"
  cutoff=$(($(date -u +%s) - retention_days * 86400))
  keys="$(s3 s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix "$prefix/" --query 'Contents[].Key' --output json 2>"$errors")" \
    || { fail "listing the backups" "$errors"; return 1; }
  keys="$(printf '%s' "$keys" | jq -r --argjson cutoff "$cutoff" --arg prefix "$prefix/" '
    (. // [])[]
    | select(startswith($prefix))
    | select(ltrimstr($prefix) | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\\.dump$"))
    | select(((ltrimstr($prefix) | rtrimstr(".dump") | try fromdateiso8601 catch null) // empty) < $cutoff)')" \
    || { log error "reading the list of backups failed"; return 1; }
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    s3 s3 rm "s3://$BACKUP_BUCKET/$key" >/dev/null 2>"$errors" || { fail "deleting $key" "$errors"; return 1; }
    log info "deleted $key (older than $retention_days days)"
  done <<<"$keys"
}

cycle() {
  local work key
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' RETURN
  key="$prefix/$(date -u +%Y-%m-%dT%H:%M:%SZ).dump"

  pg_dump --format=custom --no-owner --dbname "$DATABASE_URL" --file "$work/dump" 2>"$work/err" || { fail "pg_dump" "$work/err"; return 1; }
  s3 s3 cp "$work/dump" "s3://$BACKUP_BUCKET/$key" --only-show-errors 2>"$work/err" || { fail "the upload" "$work/err"; return 1; }
  log info "backup uploaded to $key"
  apply_retention "$work/err"
}

if [ "$mode" = "--once" ]; then
  cycle
  exit $?
fi

log info "backup service started, one cycle a day at ${schedule_hour}:00 UTC"
while :; do
  sleep "$(seconds_until "$schedule_hour" "$(date -u +%s)")"
  cycle || log error "the backup cycle failed; trying again at the next scheduled time"
done
