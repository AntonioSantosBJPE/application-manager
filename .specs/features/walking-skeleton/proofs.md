# walking-skeleton proofs

**HEAD**: 6a04465
**Tree**: clean
**Shell**: /bin/sh
**Result**: 45 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ compose › starts web, api, migrate and postgres and answers 200 within 120 seconds` | pass |
| C2 | `run e2e / ✓ compose › runs postgres 18` | pass |
| C3 | `run api-integration / ✓ GET /health > returns 200 ok/up when the database answers` | pass |
| C4 | `run api-integration / ✓ GET /health > returns 503 degraded/down within 2 seconds when the database does not an` | pass |
| C5 | `run e2e / ✓ status page › server html shows API and Banco de dados with their state` | pass |
| C6 | `run e2e / ✓ outages › shows both rows Indisponível with 200 when the api is down` | pass |
| C7 | `run e2e / ✓ status page › follows the system color scheme with dark and light tokens` | pass |
| C8 | `run e2e / ✓ compose › migrate exits 0 before api starts` | pass |
| C9 | `run e2e / ✓ failures › a failing migration exits non-zero and api never starts` | pass |
| C10 | `run e2e / ✓ compose › second compose up applies no migration` | pass |
| C11 | `run e2e / ✓ failures › web and api exit non-zero naming the missing variable` | pass |
| C12 | `run guardrails / ✓ .env.example > lists every variable read by web, api and migrate with placeholders only` | pass |
| C13 | `run e2e / ✓ compose › publishes ports from WEB_PORT, API_PORT and POSTGRES_PORT` | pass |
| C14 | `run e2e / ✓ images › web image has no @nestjs package` | pass |
| C15 | `run e2e / ✓ images › api image has no @tanstack package` | pass |
| C16 | `run e2e / ✓ images › web and api run as a non-root user` | pass |
| C17 | `run e2e / ✓ images › web and api contain no .env file` | pass |
| C18 | `run guardrails / ✓ root commands > pnpm lint runs eslint in every workspace and fails on a violation` | pass |
| C19 | `run guardrails / ✓ root commands > pnpm typecheck fails on a type error in any workspace` | pass |
| C20 | `run guardrails / ✓ root commands > pnpm test runs vitest in every workspace` | pass |
| C21 | `run api-integration / ✓ test database > runs postgresql 18 from testcontainers` | pass |
| C22 | `run e2e / ✓ compose › e2e runs against the compose project of this checkout` | pass |
| C23 | `run guardrails / ✓ dependency boundaries > fails an app importing another app naming file and import` | pass |
| C24 | `run guardrails / ✓ dependency boundaries > fails a feature importing another feature internals naming file and` | pass |
| C25 | `run guardrails / ✓ dependency boundaries > fails a module importing another module internals naming file and i` | pass |
| C26 | `run guardrails / ✓ design system lint > fails a radix import outside packages/ui naming the file` | pass |
| C27 | `run guardrails / ✓ design system lint > fails raw colors and arbitrary values naming file and class` | pass |
| C28 | `run guardrails / ✓ pre-commit secrets > blocks a staged aws key naming the file` | pass |
| C29 | `run guardrails / ✓ pre-commit secrets > hooks are installed by pnpm install` | pass |
| C30 | `run guardrails / ✓ ci workflow > runs every required step on pull_request and push to main` | pass |
| C31 | `run guardrails / ✓ ci workflow > declares contents read permissions at the top level` | pass |
| C32 | `run guardrails / ✓ ci workflow > pins every third-party action to a full commit sha` | pass |
| C33 | `run guardrails / ✓ ci workflow > never uses pull_request_target` | pass |
| C34 | `pnpm storybook:build && node -e "const i=require('./packages/ui/storybook-static/index.json');const n=Object.v` | pass |
| C35 | `run ui / ✓ StatusBadge > Tema escuro` | pass |
| C36 | `run guardrails / ✓ root commands > pnpm test fails when a packages/ui story throws` | pass |
| C37 | `run api-unit / ✓ request logging > writes json lines with level, time, msg and requestId` | pass |
| C38 | `run api-unit / ✓ request logging > reuses x-request-id and returns it` | pass |
| C39 | `run api-unit / ✓ request logging > generates an id and returns it when the header is absent` | pass |
| C40 | `run e2e / ✓ status page › web and api log the same requestId for one visit` | pass |
| C41 | `run api-integration / ✓ runMigrations > retries for 30 seconds before failing when the database is down` | pass |
| C42 | `run e2e / ✓ outages › treats an api slower than 3 seconds as Indisponível` | pass |
| Build | `pnpm build` | pass |
| Build | `pnpm typecheck` | pass |
| Build | `pnpm lint` | pass |

## Output

`Run e2e` - exit 0

```
  ✓  11 [stack] › specs/stack/compose.spec.ts:68:3 › compose › e2e runs against the compose project of this checkout (125ms)
  ✓  12 [stack] › specs/stack/failures.spec.ts:6:3 › failures › a failing migration exits non-zero and api never starts (3.8s)
  ✓  13 [stack] › specs/stack/failures.spec.ts:37:3 › failures › web and api exit non-zero naming the missing variable (1.6s)
  ✓  14 [browser] › specs/browser/status-page.spec.ts:35:3 › status page › server html shows API and Banco de dados with their state (18ms)
  ✓  15 [browser] › specs/browser/status-page.spec.ts:44:3 › status page › follows the system color scheme with dark and light tokens (271ms)
  ✓  16 [browser] › specs/browser/status-page.spec.ts:64:3 › status page › has no accessibility violations in light and dark (484ms)
  ✓  17 [browser] › specs/browser/status-page.spec.ts:74:3 › status page › web and api log the same requestId for one visit (402ms)
  ✓  18 [disruption] › specs/disruption/outages.spec.ts:19:3 › outages › shows both rows Indisponível with 200 when the api is down (6.9s)
  ✓  19 [disruption] › specs/disruption/outages.spec.ts:33:3 › outages › treats an api slower than 3 seconds as Indisponível (5.6s)
  ✓  20 [disruption] › specs/disruption/outages.spec.ts:51:3 › outages › shows API Operacional and Banco de dados Indisponível when the database is down (2.8s)
  ✓  21 [teardown] › specs/setup/compose.teardown.ts:5:3 › compose › is removed with its volumes after the run (4.6s)

  21 passed (43.0s)
$ pnpm --filter @am/e2e e2e
$ playwright test
```

`Run api-integration` - exit 0

```
 ✓ |integration| src/infra/database/migrations.int.test.ts > runMigrations > applies nothing on a second run 77ms
 ✓ |integration| src/infra/database/migrations.int.test.ts > runMigrations > rejects an invalid migration and leaves nothing applied 67ms
 ✓ |integration| src/modules/health/health.int.test.ts > GET /health > returns 200 ok/up when the database answers 161ms
 ✓ |integration| src/infra/database/migrations.int.test.ts > runMigrations > succeeds when the database comes up within the retry window 2164ms
 ✓ |integration| src/modules/health/database-probe.int.test.ts > DatabaseProbe > returns down within 2.5 seconds when the database container is paused 3499ms
 ✓ |integration| src/modules/health/health.int.test.ts > GET /health > returns 503 degraded/down within 2 seconds when the database does not answer 3579ms
[Nest] 13699  - 11/02/2026, 7:22:48 PM    WARN [DatabasePool] idle database client failed: terminating connection due to administrator command
 ✓ |integration| src/modules/health/database-probe.int.test.ts > DatabaseProbe > returns down when the database container is stopped 1132ms
 ✓ |integration| src/modules/health/health.int.test.ts > GET /health > returns 503 degraded/down when the database container is stopped 1105ms
 ✓ |integration| src/infra/database/migrations.int.test.ts > runMigrations > retries for 30 seconds before failing when the database is down 30079ms

 Test Files  4 passed (4)
      Tests  12 passed (12)
   Start at  19:22:42
   Duration  34.35s (tests 96%, import 4%)
```

`Run guardrails` - exit 0

```
 ✓ src/design-system-lint.test.ts > design system lint > fails raw colors and arbitrary values naming file and class 235ms
 ✓ src/design-system-lint.test.ts > design system lint > fails a class that is not a token naming file and class 17ms
 ✓ src/design-system-lint.test.ts > design system lint > allows token classes in apps/web and packages/ui 30ms
 ✓ src/pre-commit-secrets.test.ts > pre-commit secrets > blocks a staged aws key naming the file 1063ms
 ✓ src/pre-commit-secrets.test.ts > pre-commit secrets > lets a commit without secrets through 789ms
 ✓ src/pre-commit-secrets.test.ts > pre-commit secrets > hooks are installed by pnpm install 881ms
 ✓ src/root-commands.test.ts > root commands > pnpm lint runs eslint in every workspace and fails on a violation 15212ms
 ✓ src/root-commands.test.ts > root commands > pnpm typecheck fails on a type error in any workspace 16711ms
 ✓ src/root-commands.test.ts > root commands > pnpm test runs vitest in every workspace 5112ms
 ✓ src/root-commands.test.ts > root commands > pnpm test fails when a packages/ui story throws 2639ms

 Test Files  6 passed (6)
      Tests  25 passed (25)
   Start at  19:23:17
   Duration  44.29s (tests 99%, import 1%)
```

`Run ui` - exit 0

```
 ✓ |storybook (chromium)| src/components/status-badge/StatusBadge.stories.tsx > Operacional 154ms
 ✓ |storybook (chromium)| src/components/status-badge/StatusBadge.stories.tsx > Indisponível 3ms
 ✓ |storybook (chromium)| src/components/status-badge/StatusBadge.stories.tsx > Tema escuro 4ms

 Test Files  4 passed (4)
      Tests  9 passed (9)
   Start at  19:24:02
   Duration  1.29s (setup 33%, environment 32%, tests 14%, worker 13%, transform 7%, import 1%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - import "./vite.config" without a file extension (vitest.config.ts:6:24). Add the file extension
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - import "./vite.config" without a file extension (vitest.config.ts:6:24). Add the file extension
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run api-unit` - exit 0

```
RUN  v5.0.5 /Users/antoniosantos/Documents/trabalho/repositorios/estudo/application-manager.worktrees/walking-skeleton/apps/api

 ✓ |unit| src/config/env.test.ts > loadEnv > throws naming DATABASE_URL when it is missing or empty 1ms
 ✓ |unit| src/config/env.test.ts > loadEnv > applies the defaults PORT 3333 and LOG_LEVEL info 1ms
 ✓ |unit| src/config/env.test.ts > loadEnv > returns the values that are present 0ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > writes json lines with level, time, msg and requestId 15ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > reuses x-request-id and returns it 2ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > generates an id and returns it when the header is absent 1ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > replaces a malformed x-request-id with a generated id 2ms
 ✓ |unit| src/main.test.ts > api entrypoint > exits non-zero naming DATABASE_URL when it is missing 297ms

 Test Files  3 passed (3)
      Tests  8 passed (8)
   Start at  19:24:04
   Duration  1.02s (tests 69%, import 27%, transform 4%)
```

`pnpm storybook:build && node -e "const i=require('./packages/ui/storybook-static/index.json');const n=Object.v` - exit 0

```
@am/ui:storybook:build: │  ]8;;https://rolldown.rs/reference/OutputOptions.codeSplittinghttps://rolldown.rs/reference/OutputOptions.codeSplitting]8;;
@am/ui:storybook:build: │  - Adjust chunk size limit for this warning via
@am/ui:storybook:build: │  build.chunkSizeWarningLimit.
@am/ui:storybook:build: │
@am/ui:storybook:build: ◇  Output directory:
@am/ui:storybook:build: │  /Users/antoniosantos/Documents/trabalho/repositorios/estudo/application-manager.worktrees/walking-skeleton/packages/ui/storybook-static
@am/ui:storybook:build: │
@am/ui:storybook:build: └  Storybook build completed successfully
@am/ui:storybook:build: 

 Tasks:    1 successful, 1 total
Cached:    0 cached, 1 total
  Time:    1.592s 

$ turbo run storybook:build --filter @am/ui
```
