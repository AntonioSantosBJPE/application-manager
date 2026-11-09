#!/usr/bin/env bash
# Points the Coolify resource at <tag> and starts a deploy:
#   1. writes IMAGE_TAG=<tag> as a variable of the resource (PATCH, falling back to POST when the
#      variable does not exist yet),
#   2. triggers the deploy of the resource (POST, or GET where the instance refuses POST).
# Needs COOLIFY_URL, COOLIFY_TOKEN and COOLIFY_RESOURCE_UUID. COOLIFY_RESOURCE_KIND is `applications`
# (default) or `services`: Coolify exposes a compose resource under one of the two route families
# (docs/runbooks/production-deploy.md says how to check which one the instance uses).
# <tag> must be an OCI tag (letters, digits, `_`, `.`, `-`, up to 128 characters, not starting with a
# dot or a dash); anything else is refused before any call, because the tag becomes JSON and a path.
# Exit 2: a required variable is missing (named, never its value) or the tag is invalid. Exit 1:
# Coolify refused a call.
set -euo pipefail

tag="${1:?usage: coolify.sh <tag>}"

if ! [[ "$tag" =~ ^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$ ]]; then
  echo "coolify: the tag is not a valid image tag" >&2
  exit 2
fi

for name in COOLIFY_URL COOLIFY_TOKEN COOLIFY_RESOURCE_UUID; do
  if [ -z "${!name:-}" ]; then
    echo "coolify: the secret $name is not set" >&2
    exit 2
  fi
done

kind="${COOLIFY_RESOURCE_KIND:-applications}"
api="${COOLIFY_URL%/}/api/v1"
resource="$api/$kind/$COOLIFY_RESOURCE_UUID"

# call <method> <url> [json body]: prints the HTTP status (000 when nothing answered); the response
# body is kept out of the log.
call() {
  local method="$1" url="$2" body="${3:-}" code
  local args=(-sS -o /dev/null -w '%{http_code}' --max-time 30 -X "$method" -H "Authorization: Bearer $COOLIFY_TOKEN" -H 'Accept: application/json')
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' --data "$body")
  fi
  code="$(curl "${args[@]}" "$url" 2>/dev/null || true)"
  echo "${code:-000}"
}

ok() { [[ "$1" =~ ^2[0-9][0-9]$ ]]; }

payload="$(jq -cn --arg tag "$tag" '{key: "IMAGE_TAG", value: $tag, is_preview: false}')"
status="$(call PATCH "$resource/envs" "$payload")"
if [ "$status" = "404" ]; then
  status="$(call POST "$resource/envs" "$payload")"
fi
if ! ok "$status"; then
  echo "coolify: writing IMAGE_TAG failed with HTTP $status; no deploy was started" >&2
  exit 1
fi
echo "coolify: IMAGE_TAG set to $tag"

# The deploy route is documented as GET and as POST; an instance accepts one and answers 405 to the
# other (v4.6.0 refuses GET), so POST is tried first and GET only when POST is refused with 405.
deploy_url="$api/deploy?uuid=$COOLIFY_RESOURCE_UUID&force=false"
status="$(call POST "$deploy_url")"
if [ "$status" = "405" ]; then
  status="$(call GET "$deploy_url")"
fi
if ! ok "$status"; then
  echo "coolify: starting the deploy failed with HTTP $status" >&2
  exit 1
fi
echo "coolify: deploy started"
