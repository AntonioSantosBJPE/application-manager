# Walking Skeleton Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/walking-skeleton/design.md`
**Status**: Approved
**Approved**: 2026-11-02 - user: "Aprovo as tasks"
**Build**: `pnpm build; pnpm typecheck; pnpm lint`
**Run guardrails**: `pnpm --filter @am/guardrails exec vitest run --reporter=verbose`
**Run ui**: `pnpm --filter @am/ui exec vitest run --reporter=verbose`
**Run api-unit**: `pnpm --filter @am/api exec vitest run --project unit --reporter=verbose`
**Run api-integration**: `pnpm --filter @am/api exec vitest run --project integration --reporter=verbose`
**Run e2e**: `pnpm test:e2e`

Ambiente: `nvm use 24` antes de qualquer comando; Docker rodando; portas do `.env` deste worktree (slot 1: web 3010, api 3343, postgres 5442). O reporter `list` do Playwright é fixado no `playwright.config.ts`, então `pnpm test:e2e` imprime uma linha por teste.

As linhas esperadas dos proofs seguem o formato do reporter (`✓ <describe> > <teste>` no Vitest, `✓ ... › <describe> › <teste>` no Playwright). Na primeira execução real, cada linha é conferida com a saída e ajustada só na forma (prefixo de arquivo, separador); a afirmação do check nunca muda.

---

## Test Coverage Matrix

> Generated from project guidelines and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `docs/engineering-guidelines.md` (seção Testes), `.specs/features/walking-skeleton/design.md`. Não há testes no repositório ainda.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Contratos (`packages/contracts`) | unit | Cada variante válida aceita; cada forma inválida rejeitada | `packages/contracts/src/**/*.test.ts` | `pnpm --filter @am/contracts test` |
| Componentes de UI (`packages/ui`) | unit + storybook (browser) | Cada variante e cada parte do compound; toda story renderiza | `packages/ui/src/**/*.test.tsx`, `*.stories.tsx` | `pnpm --filter @am/ui test` |
| API: config e logging | unit | Todos os ramos; 1:1 com SKEL-11 e LOG-01..03 | `apps/api/src/**/*.test.ts` | `pnpm --filter @am/api test` |
| API: HTTP, banco, migrations | integration (Testcontainers, PG 18) | Happy path + falha + timeout de cada rota e do runner; EDGE-01 | `apps/api/src/**/*.int.test.ts` | `pnpm --filter @am/api test:integration` |
| Web: model, BFF, componentes | unit (MSW, Testing Library) | Todos os ramos do mapeamento; 200, 503, timeout, corpo inválido, rede fora | `apps/web/src/**/*.test.ts(x)` | `pnpm --filter @am/web test` |
| Regras do repositório (lint, hooks, CI, env) | unit (`tooling/guardrails`) | Cada violação da spec barrada com arquivo e import/classe; cada regra do workflow | `tooling/guardrails/src/**/*.test.ts` | `pnpm --filter @am/guardrails test` |
| Imagens e stack | e2e (Playwright + compose) | Cada critério de stack, imagem, falha e degradação | `tests/e2e/specs/**/*.spec.ts` | `pnpm test:e2e` |
| Config (tsconfig, turbo, tokens CSS, Dockerfile isolado) | none | build gate only | - | build gate |

## Gate Check Commands

> Generated from design - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks com testes unit | `pnpm test` |
| Full | Tasks com testes de integração | `pnpm test && pnpm test:integration` |
| E2E | Tasks com testes Playwright | `pnpm test && pnpm test:e2e` |
| Build | Tasks de config e fim de fase | `pnpm build && pnpm typecheck && pnpm lint && pnpm test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Fundação e guard-rails de repositório

Workspace, config compartilhada e as proteções que valem para todos os commits seguintes.

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Design system

```
T6 → T7 → T8 → T9 → T10
```

### Phase 3: API

```
T11 → T12 → T13 → T14 → T15
```

### Phase 4: Web

```
T16 → T17 → T18 → T19
```

### Phase 5: Imagens e stack

```
T20 → T21 → T22 → T23 → T24 → T25
```

### Phase 6: CI, comandos e documentação

```
T26 → T27 → T28
```

---

## Task Breakdown

### Phase 1 (tasks): Fundação e guard-rails de repositório

### T1: Criar o workspace raiz

**What**: Workspace pnpm 11 + Turborepo com scripts únicos, catalog, `allowBuilds` e Node 24 fixado.
**Where**: raiz do repositório (manifesto do workspace, config do Turborepo, `.nvmrc`, `.gitignore`)
**Depends on**: None
**Reuses**: `.gitignore` existente
**Requirement**: GUARD-01, GUARD-02, GUARD-03 (fiação; provados em T27)

**Done when**:

- [x] `.nvmrc` com `24`; `engines.node` `^24`; `packageManager` `pnpm@11.x` com hash (corepack)
- [x] Scripts `lint`, `lint:boundaries`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`, `storybook:build` conforme o design
- [x] `pnpm-workspace.yaml` com `apps/*`, `packages/*`, `tooling/*`, `tests/*`, `catalog` (TypeScript `~6.0.3`, React 19, Zod 4, Vitest 5) e `allowBuilds`
- [x] `.gitignore` ganha `storybook-static/`, `playwright-report/`, `test-results/`
- [x] Gate passa: `pnpm install` e `pnpm build && pnpm typecheck` sem workspaces de código

**Tests**: none
**Gate**: build

**Commit**: `chore: add pnpm workspace and turborepo root`

---

### T2: Criar `@am/config`

**What**: tsconfig base (strict), presets de ESLint flat (typescript-eslint, react-hooks) e Prettier; `eslint.config.js` da raiz usando o preset.
**Where**: `packages/config/`
**Depends on**: T1
**Reuses**: -
**Requirement**: GUARD-01, GUARD-02

**Done when**:

- [x] `tsconfig.base.json`, `tsconfig.react.json`, `tsconfig.node.json` exportados
- [x] `eslint/base.js` e `eslint/react.js` exportam arrays de flat config
- [x] Cada workspace terá `lint` (`eslint .`) e `typecheck` (`tsc --noEmit`) usando esses presets
- [x] Gate passa: `pnpm lint && pnpm typecheck`

**Tests**: none
**Gate**: build

**Commit**: `chore(config): add shared tsconfig, eslint and prettier presets`

---

### T3: Barrar segredos no pre-commit

**What**: Workspace `@am/guardrails` com Vitest, `lefthook.yml` e `scripts/gitleaks-staged.sh` (binário local ou imagem `ghcr.io/gitleaks/gitleaks:v8.30.1` por digest), hooks instalados pelo `pnpm install`.
**Where**: `tooling/guardrails/` e config do lefthook na raiz
**Depends on**: T2
**Reuses**: -
**Requirement**: SEC-01, SEC-02

**Done when**:

- [x] Commit com chave fictícia no formato AWS em stage é bloqueado e a saída cita o arquivo
- [x] Commit sem segredo passa
- [x] Após `pnpm install`, `git rev-parse --git-path hooks/pre-commit` existe e chama o lefthook (também num worktree)
- [x] Comportamento do `postinstall` do lefthook com `CI` definido confirmado e registrado no design
- [x] Gate passa: `pnpm test`; 3 testes

**Tests**: unit
**Gate**: quick

**Commit**: `chore(guardrails): block staged secrets with lefthook and gitleaks`

---

### T4: Fronteiras com dependency-cruiser

**What**: `.dependency-cruiser.cjs` com `no-cross-app`, `no-feature-internals` e `no-module-internals`, ligado ao `pnpm lint` via `lint:boundaries`.
**Where**: `tooling/guardrails/` e config do dependency-cruiser na raiz
**Depends on**: T3
**Reuses**: workspace `@am/guardrails` de T3
**Requirement**: GUARD-06, GUARD-07, GUARD-08

**Done when**:

- [x] Cada regra falha numa fixture com a violação e a mensagem cita arquivo e import
- [x] Import pelo `index.ts` de outra feature/módulo passa; import interno da própria feature/módulo passa
- [x] Fixtures fora do alcance do `pnpm lint` real
- [x] Gate passa: `pnpm test && pnpm lint`; 6 testes

**Tests**: unit
**Gate**: quick

**Commit**: `chore(guardrails): enforce app, feature and module boundaries`

---

### T5: Criar `@am/contracts` com o schema do health

**What**: `healthResponseSchema` (Zod 4) e o tipo `HealthResponse`.
**Where**: `packages/contracts/src/health.ts`
**Depends on**: T4
**Reuses**: presets de `@am/config`
**Requirement**: SKEL-03, SKEL-04 (contrato)

**Done when**:

- [x] Aceita `{"status":"ok","db":"up"}` e `{"status":"degraded","db":"down"}`
- [x] Rejeita combinações cruzadas, campos ausentes e valores fora do enum
- [x] Gate passa: `pnpm test`; 5 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(contracts): add health response schema`

---

### Phase 2 (tasks): Design system

### T6: Tokens provisórios do design system

**What**: `tokens.css` com Tailwind 4, paleta padrão zerada (`--color-*: initial`), tokens semânticos OKLCH claro/escuro por `prefers-color-scheme` e por `[data-theme]`.
**Where**: `packages/ui/src/styles/tokens.css`
**Depends on**: T5
**Reuses**: `@am/config`
**Requirement**: SKEL-07 (provado em T24), DS-02 (provado em T9)

**Done when**:

- [x] Workspace `@am/ui` criado com `lint`, `typecheck`, `test`
- [x] Tokens de superfície, texto, borda e dois status definidos nos dois temas
- [x] Gate passa: `pnpm build && pnpm lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(ui): add provisional design tokens for light and dark themes`

---

### T7: Componente `StatusBadge`

**What**: `StatusBadge` com `cva` (`intent: operational | unavailable`) e `asChild` via `@radix-ui/react-slot`.
**Where**: `packages/ui/src/components/status-badge/`
**Depends on**: T6
**Reuses**: tokens de T6
**Requirement**: DS-01

**Done when**:

- [x] Renderiza o texto recebido com as classes de token de cada intent
- [x] `asChild` repassa as classes ao filho
- [x] Exportado no `index.ts` do pacote
- [x] Gate passa: `pnpm test`; 3 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add StatusBadge component`

---

### T8: Arquétipo `DashboardPage`

**What**: Compound `DashboardPage.Root`, `.Header`, `.Grid`.
**Where**: `packages/ui/src/layouts/dashboard-page/`
**Depends on**: T7
**Reuses**: tokens de T6
**Requirement**: Regra de arquétipo (`docs/design/principles.md`), usada por SKEL-05

**Done when**:

- [x] As três partes renderizam com landmarks (`main`, `header`) e só classes de token
- [x] Gate passa: `pnpm test`; 2 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add DashboardPage archetype`

---

### T9: Storybook com temas e stories testadas

**What**: Storybook 10 (`react-vite`, `addon-themes`, `addon-vitest`), stories de `StatusBadge` (Operacional, Indisponível, tema escuro) e `DashboardPage`, projeto `storybook` do Vitest em browser mode dentro do `pnpm test`.
**Where**: `packages/ui/.storybook/` e stories em `packages/ui/src/`
**Depends on**: T8
**Reuses**: componentes de T7 e T8
**Requirement**: DS-01, DS-02, DS-03

**Done when**:

- [x] `pnpm storybook:build` gera `storybook-static` com as stories "Operacional" e "Indisponível"
- [x] Toolbar alterna claro/escuro (`withThemeByDataAttribute`); a story de tema escuro afirma o token escuro aplicado
- [x] `pnpm test` renderiza cada story em Chromium headless
- [x] Gate passa: `pnpm test && pnpm storybook:build`; 5 testes de story

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add storybook with theme switching and story tests`

---

### T10: Regras de lint do design system

**What**: `no-restricted-imports` de `@radix-ui/*` e `radix-ui` fora de `packages/ui`; `better-tailwindcss/no-restricted-classes` (paleta crua e valor arbitrário) e `no-unknown-classes` com `entryPoint` nos tokens.
**Where**: `packages/config/eslint/` e `tooling/guardrails/`
**Depends on**: T9
**Reuses**: preset de T2, tokens de T6
**Requirement**: GUARD-09, GUARD-10

**Done when**:

- [x] Import de `@radix-ui/react-slot` em arquivo fora de `packages/ui` falha citando o arquivo; dentro de `packages/ui` passa
- [x] `bg-purple-500`, `hover:text-red-600/50` e `p-[13px]` falham em `apps/web` e em `packages/ui`, citando arquivo e classe; classes de token passam
- [x] O código real do repo passa no `pnpm lint`
- [x] Gate passa: `pnpm test && pnpm lint`; 6 testes

**Tests**: unit
**Gate**: quick

**Commit**: `chore(guardrails): forbid raw radix imports, raw colors and arbitrary values`

---

### Phase 3 (tasks): API

### T11: Scaffold da API e validação de ambiente

**What**: `@am/api` em Nest 12 ESM com build SWC, projetos Vitest `unit` e `integration` (`unplugin-swc`), `loadEnv()` e `main.ts` que sai com 1 nomeando a variável ausente.
**Where**: `apps/api/`
**Depends on**: T10
**Reuses**: `@am/config`
**Requirement**: SKEL-11

**Done when**:

- [x] `loadEnv` sem `DATABASE_URL` lança erro com o nome da variável; com tudo presente devolve os valores e os padrões (`PORT` 3333, `LOG_LEVEL` info)
- [x] `node dist/main.js` sem `DATABASE_URL` sai com código ≠ 0 e imprime o nome
- [x] Gate passa: `pnpm test && pnpm build`; 4 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): scaffold nest app with environment validation`

---

### T12: Logs JSON com request id

**What**: `LoggerModule` (nestjs-pino) com `genReqId` validando `x-request-id`, `customProps` com `requestId`, nível em texto, `time` ISO e middleware que devolve o header.
**Where**: `apps/api/src/infra/logging/`
**Depends on**: T11
**Reuses**: `app.module.ts` de T11
**Requirement**: LOG-01, LOG-02, LOG-03

**Done when**:

- [x] Toda linha registrada numa requisição é um JSON com `level`, `time`, `msg`, `requestId`
- [x] `x-request-id` válido é reutilizado e devolvido; ausente ou malformado gera UUID devolvido no header
- [x] Gate passa: `pnpm test`; 4 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): add structured json logs with request id`

---

### T13: Sonda do banco com timeout de 2 segundos

**What**: `DatabaseModule` (pg Pool + drizzle, `connectionTimeoutMillis` e `query_timeout` 2000) e `DatabaseProbe.check()`; `globalSetup` de integração com Testcontainers `postgres:18`.
**Where**: `apps/api/src/infra/database/` (+ `modules/health/database-probe.ts`)
**Depends on**: T12
**Reuses**: `loadEnv` de T11
**Requirement**: SKEL-04, GUARD-04

**Done when**:

- [x] `check()` devolve `up` com o banco no ar
- [x] Com o container pausado, `check()` devolve `down` em até 2,5 s; com o container parado, `down`
- [x] O banco de teste é PostgreSQL 18 iniciado pelo Testcontainers
- [x] Gate passa: `pnpm test && pnpm test:integration`; 4 testes

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add database probe with two second timeout`

---

### T14: Endpoint `GET /health`

**What**: `HealthModule` (API pública em `index.ts`) e `HealthController` que responde 200 ou 503 com o corpo do contrato.
**Where**: `apps/api/src/modules/health/`
**Depends on**: T13
**Reuses**: `DatabaseProbe` de T13, `healthResponseSchema` de T5
**Requirement**: SKEL-03, SKEL-04

**Done when**:

- [x] Banco no ar: `200` com corpo exatamente `{"status":"ok","db":"up"}`
- [x] Banco pausado: `503` com corpo exatamente `{"status":"degraded","db":"down"}` em até 2,5 s
- [x] Os dois corpos passam no `healthResponseSchema`
- [x] Gate passa: `pnpm test && pnpm test:integration`; 3 testes

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add health endpoint`

---

### T15: Runner de migrations e entrypoint `migrate`

**What**: `drizzle.config.ts`, migration `0000_require_postgres_18`, `runMigrations()` com retry de 30 s e `migrate.ts` que sai com 0 ou ≠ 0.
**Where**: `apps/api/src/infra/database/` e entrypoint `migrate` em `apps/api/src/`
**Depends on**: T14
**Reuses**: `loadEnv` de T11, Testcontainers de T13
**Requirement**: SKEL-08, SKEL-09, SKEL-10, EDGE-01

**Done when**:

- [x] Primeira execução aplica a migration e registra em `drizzle.__drizzle_migrations`
- [x] Segunda execução não aplica nada
- [x] Migration com SQL inválido rejeita e não deixa nada aplicado
- [x] Banco que sobe dentro da janela: sucesso; banco ausente: falha depois de 30 s (entre 30 e 35 s)
- [x] Gate passa: `pnpm test && pnpm test:integration`; 5 testes

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add migration runner with startup retry`

---

### Phase 4 (tasks): Web

### T16: Scaffold do web e validação de ambiente

**What**: `@am/web` com TanStack Start + Vite 8 + Tailwind 4 importando os tokens, `server.ts` que valida `API_INTERNAL_URL` e sai com 1, Vitest; produção via srvx (entry confirmado e registrado no design).
**Where**: `apps/web/`
**Depends on**: T15
**Reuses**: `@am/config`, `@am/ui`
**Requirement**: SKEL-11

**Done when**:

- [x] `loadServerEnv` sem `API_INTERNAL_URL` lança erro com o nome
- [x] Servidor de produção sem `API_INTERNAL_URL` sai com código ≠ 0 e imprime o nome
- [x] `pnpm build` gera `dist/client` e `dist/server`; o servidor srvx sobe com a variável presente
- [x] Gate passa: `pnpm test && pnpm build`; 3 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): scaffold tanstack start app with environment validation`

---

### T17: `fetchHealth` e `toSystemStatus`

**What**: Cliente do health com timeout de 3 s, `x-request-id` e validação pelo contrato; mapeamento puro para "operational"/"unavailable".
**Where**: `apps/web/src/features/system-status/model/` (+ `api/fetch-health.ts`)
**Depends on**: T16
**Reuses**: `healthResponseSchema` de T5
**Requirement**: SKEL-05, SKEL-06, EDGE-02

**Done when**:

- [x] MSW: 200 ok → API e banco operacionais; 503 → API operacional, banco indisponível
- [x] Resposta depois de 3 s, erro de rede, status fora de 200/503 e corpo inválido → os dois indisponíveis
- [x] O header `x-request-id` é enviado
- [x] Gate passa: `pnpm test`; 7 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add health client and status mapping`

---

### T18: Server function `getSystemStatus` com log correlacionado

**What**: `createServerFn` que reaproveita ou gera o request id, registra no pino do servidor e chama `fetchHealth`, sem nunca lançar.
**Where**: `apps/web/src/features/system-status/api/` e `apps/web/src/lib/`
**Depends on**: T17
**Reuses**: `fetchHealth`, `toSystemStatus` de T17
**Requirement**: LOG-04, SKEL-06

**Done when**:

- [x] O id registrado no log do web é o mesmo enviado em `x-request-id`
- [x] Um `x-request-id` recebido na requisição de entrada é reaproveitado
- [x] Falha da API resulta em status indisponível, não em exceção
- [x] Gate passa: `pnpm test`; 3 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add system status server function with request id`

---

### T19: Página de status

**What**: `StatusPanel` (DashboardPage + StatusBadge) e rota `/` com loader chamando `getSystemStatus`.
**Where**: `apps/web/src/features/system-status/` e `apps/web/src/routes/`
**Depends on**: T18
**Reuses**: `DashboardPage`, `StatusBadge` de `@am/ui`
**Requirement**: SKEL-05

**Done when**:

- [x] Renderiza "API" e "Banco de dados", cada um com "Operacional" ou "Indisponível", para as quatro combinações
- [x] A rota só carrega dados e compõe a feature
- [x] Gate passa: `pnpm test && pnpm lint`; 4 testes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add status page`

---

### Phase 5 (tasks): Imagens e stack

### T20: Imagem da API e workspace E2E

**What**: `apps/api/Dockerfile` (prune → build → `pnpm deploy --prod` → `USER node`), `.dockerignore`, workspace `@am/e2e` com Playwright (reporter `list`, `workers: 1`) e o projeto `images` para a API.
**Where**: `apps/api/` (Dockerfile), `.dockerignore` na raiz e `tests/e2e/`
**Depends on**: T19
**Reuses**: build de T11-T15
**Requirement**: IMG-02, IMG-03, IMG-04

**Done when**:

- [x] Imagem sem nenhum pacote `@tanstack`, processo como usuário não-root, nenhum `.env`
- [x] `node dist/main.js` e `node dist/migrate.js` existem na imagem
- [x] Gate passa: `pnpm test && pnpm test:e2e`; 3 testes

**Tests**: e2e
**Gate**: e2e

**Commit**: `build(api): add production image`

---

### T21: Imagem do web

**What**: `apps/web/Dockerfile` no mesmo padrão, rodando srvx sobre `dist/`.
**Where**: `apps/web/Dockerfile`
**Depends on**: T20
**Reuses**: Dockerfile de T20
**Requirement**: IMG-01, IMG-03, IMG-04

**Done when**:

- [x] Imagem sem nenhum pacote `@nestjs`, processo como usuário não-root, nenhum `.env`
- [x] Os testes de IMG-03 e IMG-04 cobrem as duas imagens
- [x] Gate passa: `pnpm test && pnpm test:e2e`; 5 testes

**Tests**: e2e
**Gate**: e2e

**Commit**: `build(web): add production image`

---

### T22: Compose e `.env.example`

**What**: `compose.yaml` (postgres 18 com volume em `/var/lib/postgresql`, migrate, api, web, healthchecks, portas por variável), `.env.example`, setup do Playwright com `docker compose up -d --build --wait` medindo o tempo, teardown com `down -v`, e o teste de `.env.example`.
**Where**: raiz (compose e exemplo de env), `tests/e2e/specs/stack/` e `tooling/guardrails/`
**Depends on**: T21
**Reuses**: `scripts/worktree.sh` (chaves de porta), imagens de T20 e T21
**Requirement**: SKEL-01, SKEL-02, SKEL-08, SKEL-10, SKEL-12, SKEL-13, GUARD-05

**Done when**:

- [x] `docker compose up` sobe os quatro serviços e a página responde 200 em até 120 s
- [x] Postgres 18; `migrate` termina com 0 antes de a `api` iniciar; segunda subida não reaplica
- [x] Portas publicadas vêm de `WEB_PORT`, `API_PORT`, `POSTGRES_PORT`; postgres só em `127.0.0.1`; Playwright usa `WEB_PORT`
- [x] `.env.example` lista toda variável lida por web, api e migrate, só com placeholders
- [x] `scripts/worktree.sh init` continua funcionando a partir do `.env.example`
- [x] Gate passa: `pnpm test && pnpm test:e2e`; 8 testes novos

**Tests**: e2e
**Gate**: e2e

**Commit**: `build: add compose stack and env example`

---

### T23: Falhas de inicialização da stack

**What**: Testes de migration quebrada (override do compose com pasta de migrations inválida, projeto de compose próprio) e de variável obrigatória ausente (`docker compose run` sem a variável).
**Where**: `tests/e2e/specs/stack/failures.spec.ts`
**Depends on**: T22
**Reuses**: compose de T22
**Requirement**: SKEL-09, SKEL-11

**Done when**:

- [x] Migration inválida: `migrate` sai com ≠ 0 e o container da `api` nunca inicia
- [x] `api` sem `DATABASE_URL` e `web` sem `API_INTERNAL_URL` saem com ≠ 0 e os logs nomeiam a variável
- [x] Gate passa: `pnpm test && pnpm test:e2e`; 2 testes novos

**Tests**: e2e
**Gate**: e2e

**Commit**: `test(e2e): cover stack startup failures`

---

### T24: Página de status no navegador

**What**: Testes da página pelo navegador: HTML do SSR, temas, axe e correlação de logs entre web e api.
**Where**: `tests/e2e/specs/browser/status-page.spec.ts`
**Depends on**: T23
**Reuses**: setup de T22
**Requirement**: SKEL-05, SKEL-07, LOG-04

**Done when**:

- [x] HTML inicial (sem JavaScript) contém "API" e "Banco de dados" com "Operacional"
- [x] `colorScheme: 'dark'` aplica os tokens escuros; `light`, os claros (cor computada comparada ao token)
- [x] Nenhuma violação do axe
- [x] O mesmo `requestId` aparece nos logs do `web` e da `api` para uma visita
- [x] Gate passa: `pnpm test && pnpm test:e2e`; 4 testes novos

**Tests**: e2e
**Gate**: e2e

**Commit**: `test(e2e): cover status page rendering, themes and log correlation`

---

### T25: Degradação com API ou banco fora

**What**: Projeto `disruption` (último): API parada, API pausada (lenta) e banco parado, cada teste restaurando o serviço no `finally`.
**Where**: `tests/e2e/specs/disruption/outages.spec.ts`
**Depends on**: T24
**Reuses**: setup de T22
**Requirement**: SKEL-06, EDGE-02, SKEL-04

**Done when**:

- [x] API parada: página 200 com "API: Indisponível" e "Banco de dados: Indisponível"
- [x] API pausada: página 200 com os dois indisponíveis, respondendo em menos de 5 s
- [x] Banco parado: "API: Operacional" e "Banco de dados: Indisponível"
- [x] Gate passa: `pnpm test && pnpm test:e2e`; 3 testes novos

**Tests**: e2e
**Gate**: e2e

**Commit**: `test(e2e): cover degraded status when api or database is down`

---

### Phase 6 (tasks): CI, comandos e documentação

### T26: Workflow de CI

**What**: `.github/workflows/ci.yml` com jobs `quality`, `integration`, `e2e`, `secrets`, `images`, `workflow-lint`; actions por SHA; `permissions: contents: read`; sem `pull_request_target`.
**Where**: `.github/workflows/` e `tooling/guardrails/`
**Depends on**: T25
**Reuses**: comandos da raiz, script de gitleaks de T3
**Requirement**: CI-01, CI-02, CI-03, CI-04

**Done when**:

- [x] Eventos `pull_request` e `push` na `main`; nenhum `pull_request_target`
- [x] Lint, typecheck, unit, integração, E2E, gitleaks no histórico inteiro e build das duas imagens presentes
- [x] Todo `uses:` de terceiro com SHA de 40 caracteres
- [x] `actionlint` (imagem fixada) sem erros
- [x] Gate passa: `pnpm test`; 4 testes

**Tests**: unit
**Gate**: quick

**Commit**: `ci: add pull request and main workflow`

---

### T27: Testes dos comandos únicos

**What**: Testes que rodam os comandos da raiz numa cópia temporária do repositório com uma violação plantada.
**Where**: `tooling/guardrails/src/commands.test.ts`
**Depends on**: T26
**Reuses**: fixtures de T4 e T10
**Requirement**: GUARD-01, GUARD-02, GUARD-03, DS-03

**Done when**:

- [ ] `pnpm lint` sai com ≠ 0 e cita o arquivo com erro de ESLint plantado em cada workspace
- [ ] `pnpm typecheck` sai com ≠ 0 com erro de tipo plantado em cada workspace
- [ ] `pnpm test` roda o Vitest de todos os workspaces (lista do `turbo run test --dry=json`)
- [ ] `pnpm test` sai com ≠ 0 com uma story que lança erro em `packages/ui`
- [ ] Gate passa: `pnpm test`; 4 testes

**Tests**: unit
**Gate**: quick

**Commit**: `test(guardrails): prove the root commands fail on violations`

---

### T28: Documentar a stack local

**What**: README com pré-requisitos (Node 24, corepack, Docker), `cp .env.example .env`, `docker compose up` e os comandos únicos.
**Where**: `README.md`
**Depends on**: T27
**Reuses**: README existente
**Requirement**: Independent Tests da spec

**Done when**:

- [ ] Passos do README reproduzidos num clone limpo
- [ ] Gate passa: `pnpm build && pnpm typecheck && pnpm lint && pnpm test`

**Tests**: none
**Gate**: build

**Commit**: `docs: document local stack and root commands`

---

## Checks

**C1** - `docker compose up` sobe `web`, `api`, `migrate` e `postgres`, e a página de status responde `200` em até 120 segundos (SKEL-01, AC 1)
Proof: run e2e | ✓ compose › starts web, api, migrate and postgres and answers 200 within 120 seconds

**C2** - O serviço `postgres` roda PostgreSQL 18 (SKEL-02, AC 2)
Proof: run e2e | ✓ compose › runs postgres 18

**C3** - Com o banco respondendo, `GET /health` devolve `200` e corpo exatamente `{"status":"ok","db":"up"}` (SKEL-03, AC 3)
Proof: run api-integration | ✓ GET /health > returns 200 ok/up when the database answers

**C4** - Com o banco sem responder por 2 segundos, `GET /health` devolve `503` e corpo exatamente `{"status":"degraded","db":"down"}` (SKEL-04, AC 4)
Proof: run api-integration | ✓ GET /health > returns 503 degraded/down within 2 seconds when the database does not answer

**C5** - O HTML inicial renderizado no servidor traz "API" e "Banco de dados", cada um com "Operacional" ou "Indisponível" (SKEL-05, AC 5)
Proof: run e2e | ✓ status page › server html shows API and Banco de dados with their state

**C6** - Com a API fora, o `web` responde `200` com "API: Indisponível" e "Banco de dados: Indisponível" (SKEL-06, AC 6)
Proof: run e2e | ✓ outages › shows both rows Indisponível with 200 when the api is down

**C7** - Com preferência escura do sistema a página usa os tokens escuros; caso contrário, os claros (SKEL-07, AC 7)
Proof: run e2e | ✓ status page › follows the system color scheme with dark and light tokens

**C8** - O `migrate` aplica as migrations e termina com 0 antes de a `api` iniciar (SKEL-08, AC 8)
Proof: run e2e | ✓ compose › migrate exits 0 before api starts

**C9** - Migration com falha: `migrate` termina com ≠ 0 e a `api` não inicia (SKEL-09, AC 9)
Proof: run e2e | ✓ failures › a failing migration exits non-zero and api never starts

**C10** - Segundo `docker compose up` sem migrations novas: `migrate` termina com 0 sem reaplicar nada (SKEL-10, AC 10)
Proof: run e2e | ✓ compose › second compose up applies no migration

**C11** - Sem uma variável obrigatória, `web` e `api` encerram com ≠ 0 e a mensagem nomeia a variável (SKEL-11, AC 11)
Proof: run e2e | ✓ failures › web and api exit non-zero naming the missing variable

**C12** - O `.env.example` lista toda variável lida por `web`, `api` e `migrate`, só com placeholders (SKEL-12, AC 12)
Proof: run guardrails | ✓ .env.example > lists every variable read by web, api and migrate with placeholders only

**C13** - As portas publicadas vêm de `WEB_PORT`, `API_PORT` e `POSTGRES_PORT` (padrões 3000, 3333, 5432) e o Playwright usa `WEB_PORT` (SKEL-13, AC 13)
Proof: run e2e | ✓ compose › publishes ports from WEB_PORT, API_PORT and POSTGRES_PORT

**C14** - A imagem do `web` não contém pacote do escopo `@nestjs` (IMG-01, AC 1)
Proof: run e2e | ✓ images › web image has no @nestjs package

**C15** - A imagem da `api` não contém pacote do escopo `@tanstack` (IMG-02, AC 2)
Proof: run e2e | ✓ images › api image has no @tanstack package

**C16** - As imagens `web` e `api` rodam o processo como usuário não-root (IMG-03, AC 3)
Proof: run e2e | ✓ images › web and api run as a non-root user

**C17** - As imagens `web` e `api` não contêm arquivo `.env` (IMG-04, AC 4)
Proof: run e2e | ✓ images › web and api contain no .env file

**C18** - `pnpm lint` roda o ESLint em todos os workspaces e sai com ≠ 0 numa violação (GUARD-01, AC 1)
Proof: run guardrails | ✓ root commands > pnpm lint runs eslint in every workspace and fails on a violation

**C19** - `pnpm typecheck` checa todos os workspaces e sai com ≠ 0 num erro de tipo (GUARD-02, AC 2)
Proof: run guardrails | ✓ root commands > pnpm typecheck fails on a type error in any workspace

**C20** - `pnpm test` roda os testes Vitest de todos os workspaces (GUARD-03, AC 3)
Proof: run guardrails | ✓ root commands > pnpm test runs vitest in every workspace

**C21** - `pnpm test:integration` roda os testes da API contra PostgreSQL 18 iniciado pelo Testcontainers (GUARD-04, AC 4)
Proof: run api-integration | ✓ test database > runs postgresql 18 from testcontainers

**C22** - `pnpm test:e2e` sobe a stack do compose e roda o Playwright contra ela (GUARD-05, AC 5)
Proof: run e2e | ✓ compose › e2e runs against the compose project of this checkout

**C23** - Arquivo em `apps/` importando de outra app faz o lint falhar nomeando arquivo e import (GUARD-06, AC 6)
Proof: run guardrails | ✓ dependency boundaries > fails an app importing another app naming file and import

**C24** - Feature do `web` importando interno de outra feature faz o lint falhar nomeando arquivo e import (GUARD-07, AC 7)
Proof: run guardrails | ✓ dependency boundaries > fails a feature importing another feature internals naming file and import

**C25** - Módulo da `api` importando interno de outro módulo faz o lint falhar nomeando arquivo e import (GUARD-08, AC 8)
Proof: run guardrails | ✓ dependency boundaries > fails a module importing another module internals naming file and import

**C26** - Import de pacote `@radix-ui` fora de `packages/ui` faz o lint falhar nomeando o arquivo (GUARD-09, AC 9)
Proof: run guardrails | ✓ design system lint > fails a radix import outside packages/ui naming the file

**C27** - Cor crua do Tailwind ou valor arbitrário em `apps/web` ou `packages/ui` faz o lint falhar nomeando arquivo e classe (GUARD-10, AC 10)
Proof: run guardrails | ✓ design system lint > fails raw colors and arbitrary values naming file and class

**C28** - Segredo detectável pelo gitleaks em stage bloqueia o commit e nomeia o arquivo (SEC-01, AC 1)
Proof: run guardrails | ✓ pre-commit secrets > blocks a staged aws key naming the file

**C29** - Os git hooks ficam instalados pelo `pnpm install`, sem passo manual (SEC-02, AC 2)
Proof: run guardrails | ✓ pre-commit secrets > hooks are installed by pnpm install

**C30** - Em pull request e push na `main`, o workflow roda lint, typecheck, unit, integração, E2E, gitleaks no histórico e build das imagens (CI-01, AC 1)
Proof: run guardrails | ✓ ci workflow > runs every required step on pull_request and push to main

**C31** - O workflow declara `permissions: contents: read` no topo (CI-02, AC 2)
Proof: run guardrails | ✓ ci workflow > declares contents read permissions at the top level

**C32** - Toda action de terceiro é referenciada por SHA completo (CI-03, AC 3)
Proof: run guardrails | ✓ ci workflow > pins every third-party action to a full commit sha

**C33** - O workflow não usa `pull_request_target` (CI-04, AC 4)
Proof: run guardrails | ✓ ci workflow > never uses pull_request_target

**C34** - `pnpm storybook:build` gera Storybook estático com as stories "Operacional" e "Indisponível" do `StatusBadge` (DS-01, AC 1)
Proof: `pnpm storybook:build && node -e "const i=require('./packages/ui/storybook-static/index.json');const n=Object.values(i.entries).filter(e=>e.title.endsWith('StatusBadge')).map(e=>e.name);process.exit(['Operacional','Indisponível'].every(x=>n.includes(x))?0:1)"`

**C35** - As stories do `StatusBadge` alternam entre tema claro e escuro (DS-02, AC 2)
Proof: run ui | ✓ StatusBadge > Tema escuro

**C36** - `pnpm test` renderiza cada story do `packages/ui` e falha se alguma lançar erro (DS-03, AC 3)
Proof: run guardrails | ✓ root commands > pnpm test fails when a packages/ui story throws

**C37** - Cada linha de log da `api` registrada numa requisição é um JSON com `level`, `time`, `msg` e `requestId` (LOG-01, AC 1)
Proof: run api-unit | ✓ request logging > writes json lines with level, time, msg and requestId

**C38** - Com `x-request-id` na requisição, a `api` usa o valor como `requestId` e o devolve no header (LOG-02, AC 2)
Proof: run api-unit | ✓ request logging > reuses x-request-id and returns it

**C39** - Sem `x-request-id`, a `api` gera um id e o devolve no header (LOG-03, AC 3)
Proof: run api-unit | ✓ request logging > generates an id and returns it when the header is absent

**C40** - No SSR, o `web` envia `x-request-id` com o mesmo id dos seus logs, e a `api` registra o mesmo id (LOG-04, AC 4)
Proof: run e2e | ✓ status page › web and api log the same requestId for one visit

**C41** - Com o banco fora quando inicia, o `migrate` tenta por até 30 segundos antes de terminar com ≠ 0 (EDGE-01)
Proof: run api-integration | ✓ runMigrations > retries for 30 seconds before failing when the database is down

**C42** - API demorando mais de 3 segundos é tratada como "Indisponível" (EDGE-02)
Proof: run e2e | ✓ outages › treats an api slower than 3 seconds as Indisponível

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** none
**Dispatched:** batch 1 (Fase 1, T1–T5, Opus 5.5) at 8758f9a, returned; batch 2 (Fase 2, T6–T10, Sonnet 5.5) at d275ed8, returned; batch 3 (Fase 3, T11–T15, Opus 5.5) at 6478365, returned; batch 4 (Fase 4, T16–T19, Opus 5.5) at e715c62, returned; batch 5 (Fase 5, T20–T25, Sonnet 5.5) at 92d2d50, returned; batch 6 (Fase 6, T26–T28, Sonnet 5.5) at ac9cdd0
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 → T2 → T3 → T4 → T5
Phase 2:  T6 → T7 → T8 → T9 → T10
Phase 3:  T11 → T12 → T13 → T14 → T15
Phase 4:  T16 → T17 → T18 → T19
Phase 5:  T20 → T21 → T22 → T23 → T24 → T25
Phase 6:  T26 → T27 → T28
```

Execution is strictly sequential.
