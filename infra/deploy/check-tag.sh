#!/usr/bin/env bash
# Confirms that <tag> exists in the registry for the three images (api, web, backup) before a
# rollback touches Coolify. The images are public, so the check is anonymous: it asks the registry for
# a pull token and then for the manifest of each image.
# IMAGE_REPOSITORY is the image path without the suffix, e.g. ghcr.io/<owner>/<repo>; the images are
# <IMAGE_REPOSITORY>-api, -web and -backup. REGISTRY_URL overrides https://<registry host>.
# Exit 1 lists the images that do not have the tag.
set -euo pipefail

tag="${1:?usage: check-tag.sh <tag>}"
repository="${IMAGE_REPOSITORY:?set IMAGE_REPOSITORY}"
host="${repository%%/*}"
path="${repository#*/}"
registry="${REGISTRY_URL:-https://$host}"

accept='application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json'
missing=()
for name in api web backup; do
  image="$path-$name"
  token="$(curl -sS --max-time 20 "$registry/token?service=$host&scope=repository:$image:pull" 2>/dev/null | jq -r '.token // empty' 2>/dev/null || true)"
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -I \
    -H "Authorization: Bearer $token" -H "Accept: $accept" \
    "$registry/v2/$image/manifests/$tag" 2>/dev/null || echo 000)"
  if [ "$status" != "200" ]; then
    missing+=("$image (HTTP $status)")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "check-tag: tag $tag is missing for: ${missing[*]}" >&2
  exit 1
fi
echo "check-tag: tag $tag exists for api, web and backup"
