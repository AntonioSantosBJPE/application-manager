# Identity Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/identity/design.md`
**Status**: Approved
**Approved**: 2026-11-03 - user: "as tasks estão aprovavadas"
**Build**: `pnpm build; pnpm typecheck; pnpm lint`
**Run guardrails**: `pnpm --filter @am/guardrails exec vitest run --reporter=verbose`
**Run ui**: `pnpm --filter @am/ui exec vitest run --reporter=verbose`
**Run api-unit**: `pnpm --filter @am/api exec vitest run --project unit --reporter=verbose`
**Run api-integration**: `pnpm --filter @am/api exec vitest run --project integration --reporter=verbose`
**Run web**: `pnpm --filter @am/web exec vitest run --reporter=verbose`
**Run e2e**: `pnpm test:e2e`

Ambiente: `nvm use 24` antes de qualquer comando (`node:crypto.argon2` exige 24.7+), Docker rodando e `.env` copiado de `.env.example`.

As linhas esperadas dos proofs seguem o formato do reporter (`✓ <describe> > <teste>` no Vitest, `✓ ... › <describe> › <teste>` no Playwright). Na primeira execução real, cada linha é conferida com a saída e ajustada só na forma; a afirmação do check nunca muda.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `docs/engineering-guidelines.md` (seção Testes), `docs/design/principles.md`, `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Contratos (`packages/contracts`) | unit | Cada forma válida aceita; cada limite rejeitado | `packages/contracts/src/**/*.test.ts` | `pnpm --filter @am/contracts test` |
| Componentes de UI (`packages/ui`) | unit + storybook (browser) | Cada variante e parte do compound; toda story renderiza nos dois temas | `packages/ui/src/**/*.test.tsx`, `*.stories.tsx` | `pnpm --filter @am/ui test` |
| API: domínio e config | unit | Todos os ramos; 1:1 com os critérios; sem DI do Nest | `apps/api/src/**/*.test.ts` | `pnpm --filter @am/api test` |
| API: HTTP, guard, serviços, repositórios, CLI | integration (Testcontainers, PG 18) | Toda rota: sucesso + cada erro da spec; relógio controlado; sem mock de banco | `apps/api/src/**/*.int.test.ts` | `pnpm --filter @am/api test:integration` |
| Web: model, BFF, componentes | unit (MSW, Testing Library) | Todos os ramos do mapeamento e do repasse; cada estado de tela | `apps/web/src/**/*.test.ts(x)` | `pnpm --filter @am/web test` |
| Regras do repositório | unit (`tooling/guardrails`) | Cada violação barrada com arquivo e import | `tooling/guardrails/src/**/*.test.ts` | `pnpm --filter @am/guardrails test` |
| Jornadas, headers, stack | e2e (Playwright + compose) | Jornadas críticas, estados de sessão, IP real, axe e larguras | `tests/e2e/specs/**/*.spec.ts` | `pnpm test:e2e` |
| Documentação | none | build gate only | - | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks com testes unit | `pnpm test` |
| Full | Tasks com testes de integração | `pnpm test && pnpm test:integration` |
| E2E | Tasks com testes Playwright | `pnpm test && pnpm test:e2e` |
| Build | Tasks de documentação e fim de fase | `pnpm build && pnpm typecheck && pnpm lint && pnpm test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Fundação do backend

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Domínio e guard

```
T7 → T8 → T9 → T10 → T11 → T12 → T13
```

### Phase 3: Endpoints e CLI

```
T14 → T15 → T16 → T17 → T18 → T19 → T20 → T21
```

### Phase 4: Componentes em `packages/ui`

```
T22 → T23 → T24 → T25 → T26 → T27 → T28 → T29
```

### Phase 5: BFF e base do web

```
T30 → T31 → T32 → T33 → T34
```

### Phase 6: Telas

```
T35 → T36 → T37 → T38 → T39
```

### Phase 7: Stack, jornadas e documentação

```
T40 → T41 → T42
```

---

## Task Breakdown

### T1: Contratos de Identity

**What**: Schemas Zod e tipos de login, `me`, convites, lista paginada e Problem Details, com as constantes de senha (12 a 128) e de nome (1 a 120).
**Where**: `packages/contracts/src/identity.ts`
**Depends on**: None
**Reuses**: `packages/contracts/src/health.ts`
**Requirement**: INV-08, EDGE-02

**Done when**:

- [x] Limites de senha e nome rejeitados nas duas pontas do intervalo
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(contracts): add identity schemas`

---

### T2: Schema `identity` e migration

**What**: Tabelas `users`, `sessions`, `invitations` e `login_attempts` em Drizzle, com índices do design, único parcial de convite pendente e migration gerada.
**Where**: `apps/api/src/modules/identity/infra/schema.ts`
**Depends on**: T1
**Reuses**: `apps/api/src/infra/database/schema.ts`, `apps/api/drizzle.config.ts`
**Requirement**: EDGE-07

**Done when**:

- [x] Migration aplicada num Postgres real cria o schema, com `uuidv7()` nas chaves
- [x] Nenhuma foreign key sai do schema `identity`
- [x] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add identity schema and migration`

---

### T3: Variáveis de ambiente da API

**What**: `loadEnv` passa a exigir `WEB_PUBLIC_URL` e a ler `SESSION_COOKIE_SECURE`; `loadDatabaseEnv` atende `migrate` e CLI; `.env.example` e `compose.yaml` recebem as variáveis.
**Where**: `apps/api/src/config/env.ts`
**Depends on**: T2
**Reuses**: `MissingEnvError`
**Requirement**: EDGE-04, AUTH-08

**Done when**:

- [x] API sem `WEB_PUBLIC_URL` recusa iniciar, e o erro nomeia a variável
- [x] `migrate` funciona só com `DATABASE_URL`
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add identity environment variables`

---

### T4: Relógio injetável

**What**: Token `CLOCK` com relógio do sistema; `AppModule.forRoot` e `startApi` aceitam relógio de teste.
**Where**: `apps/api/src/infra/clock/clock.ts`
**Depends on**: T3
**Reuses**: `apps/api/test/api.ts`
**Requirement**: AUTH-11, LOCK-07

**Done when**:

- [x] Relógio de teste avança sem espera real e é injetado no `AppModule`
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add injectable clock`

---

### T5: Problem Details e validação

**What**: Filtro global que converte exceções em `application/problem+json` e pipe que valida o corpo com Zod, sem ecoar valores.
**Where**: `apps/api/src/infra/http/problem-details.filter.ts`
**Depends on**: T4
**Reuses**: `apps/api/src/app.module.ts`
**Requirement**: AUTH-17, EDGE-02

**Done when**:

- [x] Rota inexistente, corpo inválido e erro inesperado respondem Problem Details
- [x] Testes de `/health` e de request id continuam passando sem alteração
- [x] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(api): return errors as problem details`

---

### T6: Segredos fora dos logs da API

**What**: `redact` de cookie, `set-cookie` e IP interno, com serializer que substitui o token de convite na URL.
**Where**: `apps/api/src/infra/logging/logging.module.ts`
**Depends on**: T5
**Reuses**: `apps/api/src/infra/logging/request-logging.test.ts`
**Requirement**: AUTH-18

**Done when**:

- [x] As linhas JSON não contêm cookie, `set-cookie` nem token da URL
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `fix(api): redact session and invitation secrets from logs`

---

### T7: Regras de credencial

**What**: `normalizeEmail` e `isAcceptablePassword`.
**Where**: `apps/api/src/modules/identity/domain/credentials.ts`
**Depends on**: None (fase anterior concluída)
**Reuses**: Constantes de `@am/contracts`
**Requirement**: EDGE-01, CLI-05

**Done when**:

- [x] Maiúsculas e espaços normalizados; limites de 12 e 128 testados
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): add credential rules`

---

### T8: Tokens

**What**: `generateToken` (32 bytes em base64url) e `hashToken` (SHA-256 em hex).
**Where**: `apps/api/src/modules/identity/domain/tokens.ts`
**Depends on**: T7
**Reuses**: `node:crypto`
**Requirement**: AUTH-06

**Done when**:

- [x] Token decodifica para 32 bytes; hash confere com um vetor conhecido
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): add opaque token helpers`

---

### T9: Hash de senha

**What**: Interface `PasswordHasher` e implementação Argon2id em PHC, com `verifyDummy` para e-mail inexistente.
**Where**: `apps/api/src/modules/identity/application/password-hasher.ts`
**Depends on**: T8
**Reuses**: `crypto.argon2` de `node:crypto`
**Requirement**: AUTH-05, AUTH-04

**Done when**:

- [x] PHC traz `m=19456,t=2,p=1`; senha certa e errada verificadas; salt difere a cada hash
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): add argon2id password hasher`

---

### T10: Regra de bloqueio

**What**: `evaluateLockout` pura, com os limites de 5 e 50, janela de 15 minutos e cálculo de `Retry-After`.
**Where**: `apps/api/src/modules/identity/domain/lockout.ts`
**Depends on**: T9
**Reuses**: Nenhum
**Requirement**: LOCK-01, LOCK-02, LOCK-03

**Done when**:

- [x] Fronteiras 4/5 e 49/50 testadas; `Retry-After` vem da falha contada mais antiga
- [x] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): add login lockout rule`

---

### T11: Sessões

**What**: Regra pura de renovação, repositório e `SessionService` (criar, resolver, renovar, revogar).
**Where**: `apps/api/src/modules/identity/application/session.service.ts`
**Depends on**: T10
**Reuses**: `DATABASE`, `CLOCK`
**Requirement**: AUTH-10, AUTH-11

**Done when**:

- [x] Expirada, revogada e desconhecida não resolvem; renovação só abaixo de 29 dias
- [x] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add session service`

---

### T12: Guard global e declarações de acesso

**What**: `SessionGuard` via `APP_GUARD`, `@Public`, `@Roles`, `@AnySession`, `@CurrentUser`, `session-cookie.ts`, `IdentityModule` e API pública; `HealthController` recebe `@Public()`. O JSDoc explica a regra de AD-006.
**Where**: `apps/api/src/modules/identity/http/session.guard.ts`
**Depends on**: T11
**Reuses**: `SessionService`, pacote `cookie`
**Requirement**: AUTH-07, AUTH-08, AUTH-10, AUTH-11, AUTH-14, AUTH-15

**Done when**:

- [ ] Controllers de fixture provam `401`, `403`, rota pública, renovação e flags do cookie
- [ ] `/health` segue público sem mudar seus testes
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add session guard and access declarations`

---

### T13: Testes de arquitetura de acesso

**What**: Teste que percorre as rotas registradas (`AUTH-19`), com fixture sem declaração, e fixture de fronteira para o interior de `identity`.
**Where**: `apps/api/src/modules/identity/http/route-access.int.test.ts`
**Depends on**: T12
**Reuses**: `DiscoveryService`, `tooling/guardrails/fixtures/boundaries/`
**Requirement**: AUTH-19, EDGE-08

**Done when**:

- [ ] Fixture sem declaração faz o teste falhar nomeando a rota e as declarações aceitas
- [ ] Import do interior de `identity` é barrado no guardrail
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `test(identity): enforce route access declarations`

---

### T14: Endpoints de login

**What**: `POST /auth/login` e `POST /auth/admin/login`, com `401` único, verificação fictícia e limpeza de sessões expiradas.
**Where**: `apps/api/src/modules/identity/application/login.service.ts`
**Depends on**: None (fase anterior concluída)
**Reuses**: `PasswordHasher`, `SessionService`, `session-cookie.ts`
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-13, EDGE-01, EDGE-02, EDGE-03

**Done when**:

- [ ] Os três casos de `401` têm corpo idêntico byte a byte
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add member and admin login`

---

### T15: Bloqueio de login

**What**: Repositório de tentativas com advisory lock, reserva da falha, `pair_cleared` e limpeza de linhas vencidas, integrado ao login.
**Where**: `apps/api/src/modules/identity/infra/login-attempts.repository.ts`
**Depends on**: T14
**Reuses**: `evaluateLockout`, `CLOCK`, `http/client-ip.ts`
**Requirement**: LOCK-01, LOCK-02, LOCK-03, LOCK-04, LOCK-05, LOCK-06, LOCK-07, LOCK-08

**Done when**:

- [ ] Rajada simultânea de 20 tentativas leva só 5 ao Argon2
- [ ] Login certo durante o bloqueio responde `429`; a janela libera com o relógio avançado
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add login lockout`

---

### T16: `me` e logout

**What**: `GET /auth/me` e `POST /auth/logout`.
**Where**: `apps/api/src/modules/identity/http/auth.controller.ts`
**Depends on**: T15
**Reuses**: `@AnySession`, `@Public`, `@CurrentUser`
**Requirement**: AUTH-09, AUTH-12

**Done when**:

- [ ] O cookie antigo recebe `401` depois do logout; logout sem sessão responde `204`
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add me and logout endpoints`

---

### T17: Criar convite

**What**: `POST /invitations` só para admin, com revogação do pendente anterior e `inviteUrl` montado de `WEB_PUBLIC_URL`.
**Where**: `apps/api/src/modules/identity/application/invitation.service.ts`
**Depends on**: T16
**Reuses**: `generateToken`, `@Roles`
**Requirement**: INV-01, INV-02, INV-03, INV-04, AUTH-16

**Done when**:

- [ ] `invited_by` vem da sessão, mesmo com `invitedBy` no corpo
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add invitation creation`

---

### T18: Abrir e aceitar convite

**What**: `GET /invitations/:token` e `POST /invitations/:token/accept` na transação do design.
**Where**: `apps/api/src/modules/identity/http/invitations.controller.ts`
**Depends on**: T17
**Reuses**: `PasswordHasher`, `SessionService`
**Requirement**: INV-05, INV-06, INV-07, INV-08, INV-09, INV-10, EDGE-05

**Done when**:

- [ ] Os quatro estados inválidos respondem `410` nos dois endpoints
- [ ] Dois aceites simultâneos criam um único usuário
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add invitation acceptance`

---

### T19: Listar e revogar convites

**What**: `GET /invitations` com cursor e `totalPending`, e `DELETE /invitations/:id`.
**Where**: `apps/api/src/modules/identity/infra/invitations.repository.ts`
**Depends on**: T18
**Reuses**: `@Roles`
**Requirement**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05

**Done when**:

- [ ] Expirados, aceitos e revogados ficam fora da lista e do total
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): list and revoke pending invitations`

---

### T20: Serviço de administração de contas

**What**: `createAdmin` e `resetPassword`, com revogação das sessões no reset.
**Where**: `apps/api/src/modules/identity/application/account-admin.service.ts`
**Depends on**: T19
**Reuses**: `PasswordHasher`, repositórios
**Requirement**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05

**Done when**:

- [ ] Cada caminho de sucesso e recusa é conferido nas tabelas
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add account administration service`

---

### T21: CLI

**What**: `runIdentityCli` e entrypoint `dist/cli.js`, com prompt oculto, `--password-stdin` e recusa de senha em argumento.
**Where**: `apps/api/src/modules/identity/cli/run-identity-cli.ts`
**Depends on**: T20
**Reuses**: `loadDatabaseEnv`, `AccountAdminService`
**Requirement**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07

**Done when**:

- [ ] O entrypoint compilado roda contra Postgres real, com os códigos de saída da spec
- [ ] Nenhuma rota registrada cria admin nem troca senha
- [ ] Gate check passes: `pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full
**Commit**: `feat(identity): add admin command line`

---

### T22: `Button` e tokens novos

**What**: Tokens `accent`, `on-accent` e `danger` nos dois temas, `Button` com `intent` e `asChild`, e teste que exige story em todo componente.
**Where**: `packages/ui/src/components/button/button.tsx`
**Depends on**: None (fase anterior concluída)
**Reuses**: `tokens.css`, `status-badge`, `@radix-ui/react-slot`, `cva`
**Requirement**: UI-21

**Done when**:

- [ ] Story nos dois temas; o teste falha com componente sem story
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add button and semantic tokens`

---

### T23: `Field`

**What**: Compound `Field` com `Label`, `Control`, `Hint` e `Error`, ligados por `aria-*`.
**Where**: `packages/ui/src/components/field/field.tsx`
**Depends on**: T22
**Reuses**: Padrão de `status-badge`
**Requirement**: UI-21, UI-22

**Done when**:

- [ ] `aria-describedby` e `aria-invalid` testados; story nos dois temas
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add field`

---

### T24: `Alert`

**What**: `Alert` com `intent`, usando `role="alert"` para erro.
**Where**: `packages/ui/src/components/alert/alert.tsx`
**Depends on**: T23
**Reuses**: `cva`
**Requirement**: UI-21

**Done when**:

- [ ] Os dois `intent` testados; story nos dois temas
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add alert`

---

### T25: `ConfirmDialog`

**What**: Diálogo de confirmação sobre `@radix-ui/react-alert-dialog`, com tokens.
**Where**: `packages/ui/src/components/confirm-dialog/confirm-dialog.tsx`
**Depends on**: T24
**Reuses**: `Button`
**Requirement**: UI-21

**Done when**:

- [ ] Foco, Esc e confirmação testados; story nos dois temas
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add confirm dialog`

---

### T26: `CopyField`

**What**: Valor selecionável com ação de copiar; `onCopy` e estado vêm de fora.
**Where**: `packages/ui/src/components/copy-field/copy-field.tsx`
**Depends on**: T25
**Reuses**: `Button`
**Requirement**: UI-21

**Done when**:

- [ ] Os estados normal, copiado e falha testados; story nos dois temas
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add copy field`

---

### T27: Arquétipo `AuthPage`

**What**: `AuthPage` com `Root`, `Header`, `Form` e `Footer`; `data-archetype` nos arquétipos, incluindo `DashboardPage`.
**Where**: `packages/ui/src/layouts/auth-page/auth-page.tsx`
**Depends on**: T26
**Reuses**: `dashboard-page`
**Requirement**: UI-21

**Done when**:

- [ ] Landmark `main` e partes testados; story nos dois temas
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add auth page archetype`

---

### T28: Arquétipo `ListPage`

**What**: `ListPage` com `Root`, `Header`, `Filters` e `Content`.
**Where**: `packages/ui/src/layouts/list-page/list-page.tsx`
**Depends on**: T27
**Reuses**: `dashboard-page`
**Requirement**: ADM-15

**Done when**:

- [ ] Partes testadas; story nos dois temas
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add list page archetype`

---

### T29: `AppShell`

**What**: `AppShell` com `Root`, `Sidebar`, `NavItem` (`asChild`) e `Main`; em 375 px, a navegação fica acima do conteúdo.
**Where**: `packages/ui/src/layouts/app-shell/app-shell.tsx`
**Depends on**: T28
**Reuses**: `@radix-ui/react-slot`
**Requirement**: UI-21, UI-22

**Done when**:

- [ ] Landmark `nav` e `asChild` testados; story nos dois temas
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add app shell`

---

### T30: `callApi`

**What**: Cliente do BFF com encaminhamento de cookie, request id e IP, timeout, repasse de cada `Set-Cookie` e resultado tipado; resolve o IP do cliente com `CLIENT_IP_HEADER`.
**Where**: `apps/web/src/lib/call-api.ts`
**Depends on**: None (fase anterior concluída)
**Reuses**: `fetch-health.ts`, `request-id.ts`, `env.ts`
**Requirement**: LOCK-09, LOCK-10, UI-05, AUTH-18

**Done when**:

- [ ] Mais de um `Set-Cookie` repassado; timeout e rede fora viram `503`; `X-Forwarded-For` do cliente ignorado
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add bff api client`

---

### T31: CSRF e headers de resposta

**What**: `start.ts` com `createCsrfMiddleware` e `origin: WEB_PUBLIC_URL`; `responseHeadersFor` aplicado em `server.ts`; variáveis novas no env do web.
**Where**: `apps/web/src/server.ts`
**Depends on**: T30
**Reuses**: `createCsrfMiddleware` de `@tanstack/react-start`
**Requirement**: UI-17, UI-18, UI-19

**Done when**:

- [ ] Função pura testada por caminho; `WEB_PUBLIC_URL` ausente recusa iniciar
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add csrf protection and response headers`

---

### T32: Página de status em `/status`

**What**: Move a rota para `routes/status.tsx`, troca o healthcheck do compose e atualiza a URL dos E2E, sem mudar as asserções.
**Where**: `apps/web/src/routes/status.tsx`
**Depends on**: T31
**Reuses**: `StatusPanel`, `getSystemStatus`
**Requirement**: UI-20, EDGE-06

**Done when**:

- [ ] O diff dos E2E só muda URLs
- [ ] Gate check passes: `pnpm test && pnpm test:e2e`

**Tests**: e2e
**Gate**: full
**Commit**: `refactor(web): move status page to /status`

---

### T33: Regras de tela

**What**: `problemMessage`, `safeRedirect` e `areaOf` em `model/`, com as mensagens literais da spec.
**Where**: `apps/web/src/features/identity/model/messages.ts`
**Depends on**: T32
**Reuses**: Tipos de `@am/contracts`
**Requirement**: UI-03, UI-04, UI-05, UI-09

**Done when**:

- [ ] `//evil`, `/\evil`, URL absoluta e caminho sem `/` usam o destino padrão
- [ ] Minutos do `429` arredondados para cima
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity-web): add screen rules`

---

### T34: Server functions e Query

**What**: Uma server function por endpoint (AD-007), `getSession`, `QueryClient` no router com a integração de SSR, e API pública da feature.
**Where**: `apps/web/src/features/identity/api/server-functions.ts`
**Depends on**: T33
**Reuses**: `callApi`, `get-system-status.ts`
**Requirement**: UI-01, UI-02, UI-13

**Done when**:

- [ ] Cada função pura repassa método, caminho e corpo certos, testada com MSW
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity-web): add bff server functions`

---

### T35: Telas de login

**What**: `LoginForm` com TanStack Form, e rotas `/login` e `/admin/login` com `AuthPage`.
**Where**: `apps/web/src/features/identity/components/LoginForm.tsx`
**Depends on**: None (fase anterior concluída)
**Reuses**: `AuthPage`, `Field`, `Button`, `Alert`
**Requirement**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-23

**Done when**:

- [ ] `401`, `429`, `503` e envio em andamento testados; e-mail mantido após erro
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity-web): add login screens`

---

### T36: Áreas protegidas e home

**What**: Layouts `_member` e `admin/_protected`, home com `DashboardPage`, `SessionMenu` e redirecionamento em `401` de mutação.
**Where**: `apps/web/src/routes/_member.tsx`
**Depends on**: T35
**Reuses**: `getSession`, `AppShell`, `DashboardPage`
**Requirement**: UI-06, UI-07, UI-08, UI-10, UI-11, UI-12, UI-13

**Done when**:

- [ ] Cada destino de redirecionamento e a tela de sem acesso testados por papel
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity-web): add protected areas and home`

---

### T37: Tela de aceitar convite

**What**: `AcceptInvitationForm` e rota `/invite/:token` com `AuthPage`.
**Where**: `apps/web/src/features/identity/components/AcceptInvitationForm.tsx`
**Depends on**: T36
**Reuses**: `getInvitation`, `acceptInvitation`, `Field`, `Alert`
**Requirement**: UI-14, UI-15, UI-16, UI-23

**Done when**:

- [ ] Pendente, `410` ao abrir e `410` ao enviar testados; regra de 12 caracteres visível
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity-web): add invitation acceptance screen`

---

### T38: Tela de convites

**What**: `InvitationsPanel` em `/admin/invitations` com `ListPage`: formulário, link com `CopyField`, lista, revogação e "Carregar mais".
**Where**: `apps/web/src/features/identity/components/InvitationsPanel.tsx`
**Depends on**: T37
**Reuses**: `ListPage`, `CopyField`, `ConfirmDialog`, `useInfiniteQuery`
**Requirement**: ADM-06, ADM-07, ADM-08, ADM-09, ADM-10, ADM-11, ADM-12, ADM-13, ADM-15

**Done when**:

- [ ] Cada controle e estado da spec testado, incluindo falha de cópia e lista vazia
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity-web): add invitations screen`

---

### T39: Dashboard do admin

**What**: `/admin` com `DashboardPage`, `StatusPanel` e `InvitationSummary`.
**Where**: `apps/web/src/routes/admin/_protected/index.tsx`
**Depends on**: T38
**Reuses**: `StatusPanel`, `listInvitations`
**Requirement**: ADM-14, ADM-15

**Done when**:

- [ ] Painel, total e link aparecem; API fora mostra o painel como indisponível
- [ ] Gate check passes: `pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity-web): add admin dashboard`

---

### T40: Stack endurecida e apoio aos E2E

**What**: API publicada em `127.0.0.1`; fixture de compose com `CLIENT_IP_HEADER`; helpers de CLI e SQL nos E2E; prova de IP real.
**Where**: `tests/e2e/specs/disruption/client-ip.spec.ts`
**Depends on**: None (fase anterior concluída)
**Reuses**: `tests/e2e/support/compose.ts`, `tests/e2e/fixtures/`
**Requirement**: LOCK-09, LOCK-10

**Done when**:

- [ ] IPs diferentes contam em separado; `X-Forwarded-For` falso não muda a contagem
- [ ] Gate check passes: `pnpm test && pnpm test:e2e`

**Tests**: e2e
**Gate**: full
**Commit**: `test(e2e): prove client ip forwarding`

---

### T41: Jornadas E2E

**What**: Jornada completa, sessão expirada e revogada, renovação em SSR, `403`, `410`, CSRF, headers, logs, axe e larguras, nas imagens de produção.
**Where**: `tests/e2e/specs/browser/identity.spec.ts`
**Depends on**: T40
**Reuses**: `@axe-core/playwright`, helpers de T40
**Requirement**: UI-06, UI-07, UI-08, UI-10, UI-13, UI-16, UI-17, UI-18, UI-19, UI-21, UI-22, ADM-15, AUTH-18

**Done when**:

- [ ] Busca nos logs da stack não encontra senha, token nem cookie usados no teste
- [ ] Gate check passes: `pnpm test && pnpm test:e2e`

**Tests**: e2e
**Gate**: full
**Commit**: `test(e2e): cover identity journeys`

---

### T42: Documentação do projeto

**What**: Atualiza `docs/engineering-guidelines.md` (regra de acesso, BFF, API sem domínio), `docs/design/principles.md` (`AuthPage`), `.design/application-manager.md` (Key decision 3, contratos, contas) e `.env.example`.
**Where**: `docs/engineering-guidelines.md`
**Depends on**: T41
**Reuses**: AD-004 a AD-007
**Requirement**: AUTH-19, EDGE-08

**Done when**:

- [ ] Os documentos citam AD-004 a AD-007, sem dados reais nem detalhes de infraestrutura
- [ ] Gate check passes: `pnpm build && pnpm typecheck && pnpm lint && pnpm test`

**Tests**: none
**Gate**: build
**Commit**: `docs: record identity decisions`

---

## Checks

**C1** - `create-admin` com e-mail novo cria `admin` em minúsculas e sai com 0 (CLI-01, AC 1)
Proof: run api-integration | ✓ identity cli > create-admin creates a lowercase admin and exits 0

**C2** - `create-admin` com e-mail existente sai com ≠ 0 sem alterar usuários (CLI-02, AC 2)
Proof: run api-integration | ✓ identity cli > create-admin refuses an existing email in any role

**C3** - `reset-password` troca o hash, mantém o papel e revoga todas as sessões (CLI-03, AC 3)
Proof: run api-integration | ✓ identity cli > reset-password changes the hash keeps the role and revokes every session

**C4** - `reset-password` com e-mail inexistente sai com ≠ 0 sem criar usuário (CLI-04, AC 4)
Proof: run api-integration | ✓ identity cli > reset-password refuses an unknown email without creating a user

**C5** - Senha do CLI com 11 ou 129 caracteres é recusada sem gravar (CLI-05, AC 5)
Proof: run api-integration | ✓ identity cli > refuses passwords of 11 and 129 characters without writing

**C6** - O CLI lê a senha só do prompt ou de `--password-stdin` e recusa senha em argumento (CLI-06, AC 6)
Proof: run api-integration | ✓ identity cli > reads the password from stdin and rejects it as an argument

**C7** - Nenhuma rota da API cria admin nem troca senha (CLI-07, AC 7)
Proof: run api-integration | ✓ route access > no route creates an admin or changes a password

**C8** - Login válido de member cria sessão, define o cookie e responde `204` (AUTH-01, AC 1)
Proof: run api-integration | ✓ POST /auth/login > creates a session sets the cookie and answers 204 for a member

**C9** - Login válido de admin na entrada de admin cria sessão, define o cookie e responde `204` (AUTH-02, AC 2)
Proof: run api-integration | ✓ POST /auth/admin/login > creates a session sets the cookie and answers 204 for an admin

**C10** - Senha errada, e-mail inexistente e entrada errada recebem `401` com corpo idêntico, sem sessão (AUTH-03, AC 3)
Proof: run api-integration | ✓ login failures > answer an identical 401 for wrong password unknown email and wrong entrance

**C11** - E-mail inexistente executa a mesma verificação Argon2id de uma senha errada (AUTH-04, AC 4)
Proof: run api-integration | ✓ login failures > runs the password verifier once for a known and an unknown email

**C12** - A senha é guardada em PHC Argon2id com `m=19456`, `t=2`, `p=1` (AUTH-05, AC 5)
Proof: run api-unit | ✓ password hasher > stores argon2id phc with m=19456 t=2 p=1

**C13** - Tokens têm 32 bytes aleatórios e o banco guarda só o SHA-256 (AUTH-06, AC 6)
Proof: run api-integration | ✓ tokens at rest > stores only the sha-256 of 32-byte session and invitation tokens

**C14** - O cookie traz `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` e nenhum `Domain` (AUTH-07, AC 7)
Proof: run api-integration | ✓ session cookie > carries HttpOnly SameSite=Lax Path=/ Max-Age=2592000 and no Domain

**C15** - Sem `SESSION_COOKIE_SECURE=false`, o cookie se chama `__Host-am_session` e traz `Secure` (AUTH-08, AC 8)
Proof: run api-integration | ✓ session cookie > is named __Host-am_session with Secure by default

**C16** - `GET /auth/me` responde `200` com `{ id, email, name, role }` da sessão (AUTH-09, AC 9)
Proof: run api-integration | ✓ GET /auth/me > answers 200 with the session user

**C17** - Sessão ausente, expirada, revogada ou desconhecida recebe `401` em rota não pública (AUTH-10, AC 10)
Proof: run api-integration | ✓ session guard > answers 401 for a missing expired revoked and unknown session

**C18** - Com menos de 29 dias restantes, a sessão é estendida para 30 dias e o cookie é reenviado; com 29 ou mais, não (AUTH-11, AC 11)
Proof: run api-integration | ✓ session guard > extends the session and resends the cookie only below 29 days

**C19** - Logout revoga a sessão, apaga o cookie e responde `204`, com ou sem sessão (AUTH-12, AC 12)
Proof: run api-integration | ✓ POST /auth/logout > revokes the session clears the cookie and answers 204 with or without a session

**C20** - Um login apaga as sessões expiradas do usuário e mantém as válidas (AUTH-13, AC 13)
Proof: run api-integration | ✓ POST /auth/login > deletes only the expired sessions of the user

**C21** - Rota de um papel recebe sessão do outro papel e responde `403`, nos dois sentidos (AUTH-14, AC 14)
Proof: run api-integration | ✓ session guard > answers 403 when the role differs in both directions

**C22** - Rota sem marca de pública exige sessão, e `GET /health` continua público (AUTH-15, AC 15)
Proof: run api-integration | ✓ session guard > requires a session unless public and keeps /health public

**C23** - `userId` e `invitedBy` enviados pelo cliente são ignorados (AUTH-16, AC 16)
Proof: run api-integration | ✓ POST /invitations > takes invited_by from the session and ignores client ids

**C24** - Todos os erros de Identity usam `application/problem+json` (AUTH-17, AC 17)
Proof: run api-integration | ✓ problem details > every identity error uses application/problem+json

**C25** - Os logs de API e web não contêm senha, token de sessão, token de convite nem cookie (AUTH-18, AC 18)
Proof: run e2e | ✓ identity › stack logs contain no password token or cookie after a full journey

**C26** - Toda rota registrada declara o acesso, e uma rota sem declaração faz o teste falhar nomeando a rota e as opções (AUTH-19, AC 19)
Proof: run api-integration | ✓ route access > every registered route declares access and an undeclared fixture is named in the failure

**C27** - Com 5 falhas de e-mail + IP em 15 min, a sexta tentativa responde `429`, mesmo com senha correta (LOCK-01, AC 1)
Proof: run api-integration | ✓ login lockout > answers 429 after 5 pair failures even with the correct password

**C28** - Com 50 falhas do mesmo IP em 15 min, qualquer e-mail recebe `429` (LOCK-02, AC 2)
Proof: run api-integration | ✓ login lockout > answers 429 for any email after 50 failures from one ip

**C29** - O `429` traz `Retry-After` com os segundos até a falha contada mais antiga sair da janela (LOCK-03, AC 3)
Proof: run api-integration | ✓ login lockout > sends Retry-After until the oldest counted failure leaves the window

**C30** - E-mails existentes e inexistentes contam igual e recebem o mesmo corpo de `429` (LOCK-04, AC 4)
Proof: run api-integration | ✓ login lockout > treats known and unknown emails alike with the same 429 body

**C31** - Tentativa com `429` não executa Argon2id nem registra falha nova (LOCK-05, AC 5)
Proof: run api-integration | ✓ login lockout > a blocked attempt runs no argon2 and records no failure

**C32** - Login certo deixa de contar as falhas do par e mantém as do IP (LOCK-06, AC 6)
Proof: run api-integration | ✓ login lockout > a success clears the pair and keeps the ip count

**C33** - Passada a janela, a tentativa é aceita e as linhas vencidas são apagadas na falha seguinte (LOCK-07, AC 7)
Proof: run api-integration | ✓ login lockout > accepts attempts after the window and deletes expired rows on the next failure

**C34** - As duas entradas compartilham os contadores de falha (LOCK-08, AC 8)
Proof: run api-integration | ✓ login lockout > both entrances share the failure counters

**C35** - O web repassa o IP do cliente, e IPs diferentes contam em separado (LOCK-09, AC 9)
Proof: run e2e | ✓ client ip › failures from two client ips are counted separately through the web

**C36** - Com `CLIENT_IP_HEADER` definido, `X-Forwarded-For` enviado pelo cliente é ignorado (LOCK-10, AC 10)
Proof: run e2e | ✓ client ip › a forged X-Forwarded-For does not change the count

**C37** - Admin convida e recebe `201` com `{ inviteUrl, expiresAt }`, validade de 7 dias e link de `WEB_PUBLIC_URL` (INV-01, AC 1)
Proof: run api-integration | ✓ POST /invitations > answers 201 with a 7-day invitation and a url from WEB_PUBLIC_URL

**C38** - Member recebe `403` em `POST /invitations`, sem convite criado (INV-02, AC 2)
Proof: run api-integration | ✓ POST /invitations > answers 403 to a member and creates nothing

**C39** - E-mail já cadastrado recebe `409`, sem convite criado (INV-03, AC 3)
Proof: run api-integration | ✓ POST /invitations > answers 409 for an email that has an account

**C40** - Novo convite para e-mail pendente revoga o anterior (INV-04, AC 4)
Proof: run api-integration | ✓ POST /invitations > revokes the previous pending invitation of the email

**C41** - `GET /invitations/:token` de convite pendente responde `200` com `{ email, expiresAt }` (INV-05, AC 5)
Proof: run api-integration | ✓ GET /invitations/:token > answers 200 with email and expiresAt for a pending invitation

**C42** - Token desconhecido, expirado, aceito ou revogado recebe `410` em abrir e aceitar (INV-06, AC 6)
Proof: run api-integration | ✓ invalid invitations > answer 410 for unknown expired accepted and revoked tokens on both endpoints

**C43** - Aceite válido cria `member` com o e-mail do convite, marca `accepted_at`, inicia sessão e responde `201` (INV-07, AC 7)
Proof: run api-integration | ✓ POST /invitations/:token/accept > creates the member marks accepted_at starts a session and answers 201

**C44** - Senha com 11 ou 129 caracteres, ou nome vazio ou com 121, recebe `400`, e o convite segue pendente (INV-08, AC 8)
Proof: run api-integration | ✓ POST /invitations/:token/accept > answers 400 for out-of-range password and name and keeps the invitation pending

**C45** - Dois aceites simultâneos criam um único usuário, e o outro recebe `410` (INV-09, AC 9)
Proof: run api-integration | ✓ POST /invitations/:token/accept > two concurrent accepts create one user and the other gets 410

**C46** - Aceite com sessão válida revoga essa sessão antes de iniciar a nova (INV-10, AC 10)
Proof: run api-integration | ✓ POST /invitations/:token/accept > revokes the current session before starting the new one

**C47** - Member que usa "Entrar" abre a rota preservada, ou `/`, com o nome e "Sair" (UI-01, AC 1)
Proof: run e2e | ✓ identity › a member signs in and reaches the preserved route with name and Sair

**C48** - Admin que usa "Entrar" abre a rota preservada, ou `/admin` (UI-02, AC 2)
Proof: run e2e | ✓ identity › an admin signs in and reaches the preserved route or /admin

**C49** - O `401` mostra "E-mail ou senha incorretos." e mantém o e-mail (UI-03, AC 3)
Proof: run web | ✓ LoginForm > shows the 401 message and keeps the email

**C50** - O `429` mostra "Muitas tentativas. Tente novamente em {n} min.", com `n` arredondado para cima (UI-04, AC 4)
Proof: run web | ✓ LoginForm > shows the 429 message with minutes rounded up

**C51** - API fora mostra "Serviço indisponível. Tente novamente em instantes." sem ir para o login (UI-05, AC 5)
Proof: run e2e | ✓ outages › shows the unavailable message without redirecting to login when the api is down

**C52** - Visitante sem sessão em `/` é redirecionado pelo servidor para `/login`, preservando a rota (UI-06, AC 6)
Proof: run e2e | ✓ identity › the server redirects / to /login preserving the route

**C53** - Visitante sem sessão em `/admin/*` é redirecionado pelo servidor para `/admin/login`, preservando a rota (UI-07, AC 7)
Proof: run e2e | ✓ identity › the server redirects /admin routes to /admin/login preserving the route

**C54** - Ação com `401` abre o login da área, preservando a rota, com "Sua sessão expirou. Entre novamente." (UI-08, AC 8)
Proof: run e2e | ✓ identity › an action with an expired session opens login with the expired message and the route

**C55** - Rota preservada que não é caminho interno de uma única `/` é ignorada (UI-09, AC 9)
Proof: run web | ✓ safeRedirect > falls back for absolute protocol-relative and backslash paths

**C56** - Member em `/admin/*` vê "Você não tem acesso a esta área." com link para `/`, sem dados de admin (UI-10, AC 10)
Proof: run e2e | ✓ identity › a member on /admin sees the no-access message and no admin data

**C57** - Admin logado em `/` é redirecionado para `/admin` (UI-11, AC 11)
Proof: run e2e | ✓ identity › a signed-in admin on / goes to /admin

**C58** - Usuário logado na tela de login da sua área vai para a home da área (UI-12, AC 12)
Proof: run e2e | ✓ identity › a signed-in user on the login of their area goes to its home

**C59** - "Sair" encerra a sessão e abre o login da área, e o cookie antigo deixa de valer (UI-13, AC 13)
Proof: run e2e | ✓ identity › Sair ends the session and opens the login of the area

**C60** - `/invite/:token` pendente mostra o e-mail sem edição, nome, senha e a regra de 12 caracteres (UI-14, AC 14)
Proof: run web | ✓ AcceptInvitationForm > shows the invited email read-only and the password rule

**C61** - "Criar conta" com dados válidos abre `/` já logado (UI-15, AC 15)
Proof: run e2e | ✓ identity › the full journey goes from cli to admin invite to accepted member home

**C62** - `410` ao abrir e ao enviar mostra "Este convite não é mais válido. Peça um novo ao administrador." sem formulário (UI-16, AC 16)
Proof: run web | ✓ AcceptInvitationForm > shows the invalid message without a form on 410 at open and at submit

**C63** - `/invite/:token` responde com `Referrer-Policy: no-referrer` (UI-17, AC 17)
Proof: run e2e | ✓ identity › /invite responds with Referrer-Policy no-referrer

**C64** - Páginas autenticadas e `/invite/:token` respondem com `Cache-Control: no-store` (UI-18, AC 18)
Proof: run e2e | ✓ identity › authenticated pages and /invite respond with Cache-Control no-store

**C65** - POST de outra origem a uma server function é recusado sem chamar a API (UI-19, AC 19)
Proof: run e2e | ✓ identity › a cross-origin post to a server function is refused and never reaches the api

**C66** - `/status` sem sessão entrega o mesmo conteúdo renderizado no servidor (UI-20, AC 20)
Proof: run e2e | ✓ status page › server html shows API and Banco de dados with their state

**C67** - Login, convite e home usam `AuthPage` ou `DashboardPage` (UI-21, AC 21)
Proof: run e2e | ✓ identity › login invite and home render the auth and dashboard archetypes

**C68** - Telas sem violação axe nos dois temas e sem rolagem horizontal da página em 375 e 1280 px (UI-22, AC 22)
Proof: run e2e | ✓ identity › identity screens have no axe violations or horizontal scroll in both themes and widths

**C69** - Enquanto aguarda resposta, a ação de envio fica desabilitada (UI-23, AC 23)
Proof: run web | ✓ LoginForm > disables submit while waiting and sends one request

**C70** - `GET /invitations` responde `{ items, nextCursor, totalPending }`, só com pendentes não expirados, do mais recente ao mais antigo (ADM-01, AC 1)
Proof: run api-integration | ✓ GET /invitations > lists only pending invitations newest first with cursor and total

**C71** - `DELETE /invitations/:id` em pendente marca `revoked_at` e responde `204` (ADM-02, AC 2)
Proof: run api-integration | ✓ DELETE /invitations/:id > marks revoked_at and answers 204

**C72** - Convite inexistente ou não pendente recebe `404` no `DELETE` (ADM-03, AC 3)
Proof: run api-integration | ✓ DELETE /invitations/:id > answers 404 for an unknown or non-pending invitation

**C73** - Member recebe `403` em `GET /invitations` e `DELETE /invitations/:id` (ADM-04, AC 4)
Proof: run api-integration | ✓ invitations administration > answers 403 to a member on list and revoke

**C74** - `GET /invitations` nunca devolve token nem hash (ADM-05, AC 5)
Proof: run api-integration | ✓ GET /invitations > never returns a token or its hash

**C75** - "Convidar" mostra o link com "Copiar", avisa que ele só aparece esta vez e inclui o e-mail na lista (ADM-06, AC 6)
Proof: run web | ✓ InvitationsPanel > shows the link once with copy and adds the email to the list

**C76** - "Copiar" copia o link e mostra "Copiado" (ADM-07, AC 7)
Proof: run web | ✓ InvitationsPanel > copies the link and shows Copiado

**C77** - Falha de cópia mantém o link selecionável e mostra "Não foi possível copiar. Selecione o link." (ADM-08, AC 8)
Proof: run web | ✓ InvitationsPanel > keeps the link selectable and shows the message when copy fails

**C78** - E-mail cadastrado mostra "Este e-mail já tem uma conta." e mantém o valor (ADM-09, AC 9)
Proof: run web | ✓ InvitationsPanel > shows the existing account message and keeps the value

**C79** - "Revogar" pede confirmação com o e-mail e não revoga antes dela (ADM-10, AC 10)
Proof: run web | ✓ InvitationsPanel > asks confirmation with the email before revoking

**C80** - Confirmar remove o convite da lista e atualiza o total (ADM-11, AC 11)
Proof: run web | ✓ InvitationsPanel > removes the invitation and updates the total after confirming

**C81** - Sem pendentes, a tela mostra "Nenhum convite pendente." e o formulário (ADM-12, AC 12)
Proof: run web | ✓ InvitationsPanel > shows the empty message and the form

**C82** - Com mais convites que a primeira página, "Carregar mais" usa `nextCursor` (ADM-13, AC 13)
Proof: run web | ✓ InvitationsPanel > loads the next page with nextCursor

**C83** - `/admin` mostra o painel de status, o total de pendentes e o link para `/admin/invitations` (ADM-14, AC 14)
Proof: run e2e | ✓ identity › the admin dashboard shows status pending total and the invitations link

**C84** - `/admin` usa `DashboardPage` e `/admin/invitations` usa `ListPage` (ADM-15, AC 15)
Proof: run e2e | ✓ identity › admin screens render the dashboard and list archetypes

**C85** - E-mail com maiúsculas ou espaços é normalizado antes de comparar ou gravar (EDGE-01, AC 1)
Proof: run api-integration | ✓ POST /auth/login > normalizes case and surrounding spaces of the email

**C86** - Corpo inválido recebe `400` em Problem Details, sem ecoar a senha (EDGE-02, AC 2)
Proof: run api-integration | ✓ problem details > answers 400 without echoing the password

**C87** - Senha de login acima de 128 caracteres recebe o mesmo `401`, conta a falha e não executa Argon2id (EDGE-03, AC 3)
Proof: run api-integration | ✓ login failures > a password above 128 characters gets the same 401 counts a failure and runs no argon2

**C88** - API sem `WEB_PUBLIC_URL` recusa iniciar, com mensagem que nomeia a variável (EDGE-04, AC 4)
Proof: run api-unit | ✓ loadEnv > throws naming WEB_PUBLIC_URL when it is missing

**C89** - Usuário criado entre o convite e o aceite faz o aceite responder `410`, sem alterá-lo (EDGE-05, AC 5)
Proof: run api-integration | ✓ POST /invitations/:token/accept > answers 410 and keeps the user created after the invitation

**C90** - O healthcheck do `web` consulta `/status`, e a API fora não o derruba (EDGE-06, AC 6)
Proof: run e2e | ✓ outages › web stays healthy through /status when the api is down

**C91** - O schema `identity` tem as quatro tabelas, chaves `uuidv7()` e nenhuma foreign key para outro schema (EDGE-07, AC 7)
Proof: run api-integration | ✓ identity schema > has four tables uuidv7 keys and no foreign key to another schema

**C92** - Importar o interior de `identity` de outro módulo é barrado (EDGE-08, AC 8)
Proof: run guardrails | ✓ boundaries > blocks importing identity internals from another module

**C93** - Todo componente novo de `packages/ui` tem story, e um componente sem story faz o teste falhar (UI-21, AC 21)
Proof: run ui | ✓ stories coverage > every component and archetype has a story

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** none
**Dispatched:** Phase 2 (T7-T13) worker, started from HEAD b77fc2a
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

Phase 1:  T1 → T2 → T3 → T4 → T5 → T6
Phase 2:  T7 → T8 → T9 → T10 → T11 → T12 → T13
Phase 3:  T14 → T15 → T16 → T17 → T18 → T19 → T20 → T21
Phase 4:  T22 → T23 → T24 → T25 → T26 → T27 → T28 → T29
Phase 5:  T30 → T31 → T32 → T33 → T34
Phase 6:  T35 → T36 → T37 → T38 → T39
Phase 7:  T40 → T41 → T42
```

Execution is strictly sequential. With 42 tasks, phases pack into about 6 batches, so sub-agents are offered before the first task.
