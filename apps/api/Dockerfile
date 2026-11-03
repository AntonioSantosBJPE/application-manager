# syntax=docker/dockerfile:1
# Production image of the api (AD-001). Build context is the repository root:
#   docker build -f apps/api/Dockerfile .
# The same image runs the `migrate` service with `node dist/migrate.js`.

# Pinned by tag and digest (refresh with `docker buildx imagetools inspect node:24-alpine`).
ARG NODE_IMAGE=node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

FROM ${NODE_IMAGE} AS base
RUN corepack enable
WORKDIR /repo

# Keep only the api and the workspace packages it depends on.
FROM base AS prune
RUN npm install --global turbo@2.11.10
COPY . .
RUN turbo prune @am/api --docker

FROM base AS build
# There is no .git here: the root `prepare` installs no git hooks, and CI=true makes the lefthook postinstall skip too.
ENV CI=true
COPY --from=prune /repo/out/json/ ./
COPY --from=prune /repo/out/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ ./
RUN pnpm exec turbo run build --filter @am/api
# Production dependencies only, with workspace packages copied in (injectWorkspacePackages).
RUN pnpm --filter @am/api deploy --prod /out

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/ ./
USER node
EXPOSE 3333
CMD ["node", "dist/main.js"]
