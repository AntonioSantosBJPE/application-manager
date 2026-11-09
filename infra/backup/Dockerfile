# syntax=docker/dockerfile:1
# The backup service: pg_dump from the same Postgres image the stack runs, plus the AWS CLI (any
# S3-compatible store) and jq. Build context is this folder: docker build -f infra/backup/Dockerfile infra/backup

# Pinned by tag and digest, the same as compose.yaml.
FROM postgres:18.6-alpine@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5

# Package versions are pinned; when Alpine drops one, bump it here (the infra test builds this image).
RUN apk add --no-cache aws-cli=2.34.63-r0 jq=1.8.2-r0 bash

COPY backup.sh restore.sh /usr/local/bin/

# The postgres user (no root) runs everything.
USER postgres
ENTRYPOINT ["/usr/local/bin/backup.sh"]
