# Skills Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, the Verifier and the screens sub-agent). Neste projeto o fechamento segue `docs/workflow.md#gates-e-tempo`: sem `check_proofs.py` nem `validate_verification.py`.

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/skills/design.md`
**Status**: Approved
**Approved**: 2026-11-08 - user: "Task aprovavadas"
**Build**: `pnpm build; pnpm typecheck; pnpm lint`
**Run contracts**: `pnpm --filter @am/contracts exec vitest run --reporter=verbose`
**Run api-unit**: `pnpm --filter @am/api exec vitest run --project unit --reporter=verbose`
**Run api-integration**: `pnpm --filter @am/api exec vitest run --project integration --reporter=verbose`
**Run web**: `pnpm --filter @am/web exec vitest run --reporter=verbose`
**Run e2e**: `pnpm test:e2e`

Ambiente: `nvm use 24` antes de qualquer comando, Docker rodando para os testes de integração e para o E2E, e `.env` copiado de `.env.example`.

Convenção dos testes: o nome de cada teste que prova um check começa pelo id do requisito, como `SKL-05 ...`, e a linha esperada de cada proof é `✓ SKL-05`. Na primeira execução real cada linha é conferida com a saída e ajustada só na forma; a afirmação do check nunca muda. Os testes de skills criam skills só com nomes fictícios que não estão no seed (`Skill Fictícia Alfa`, `Skill Fictícia Beta`, `Drizzle ORM de Teste`).

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `docs/engineering-guidelines.md`, `docs/design/principles.md`, `docs/design/system/prumo.md`, `docs/workflow.md`, `apps/api/vitest.config.ts`, `packages/ui/vitest.config.ts`, `apps/web/vitest.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Contratos (`packages/contracts`) | unit | Cada forma válida aceita e cada limite rejeitado | `packages/contracts/src/**/*.test.ts` | `pnpm --filter @am/contracts test` |
| API: domínio e seed | unit | Todos os ramos; 1:1 com os critérios | `apps/api/src/**/*.test.ts` | `pnpm --filter @am/api test` |
| API: HTTP, serviços, repositórios, schema, migrações | integration (Testcontainers, PG 18) | Toda rota: sucesso e cada erro da spec; concorrência com requisições paralelas; sem mock de banco | `apps/api/src/**/*.int.test.ts` | `pnpm --filter @am/api test:integration` |
| Componentes de UI (`packages/ui`) | unit (jsdom) + browser (Chromium) + storybook | Cada variante; teclado e foco no navegador; story nos dois temas | `packages/ui/src/**/*.test.tsx`, `*.browser.test.tsx`, `*.stories.tsx` | `pnpm --filter @am/ui test` |
| Web: model, BFF, componentes e rotas | unit (Testing Library, MSW) | Cada texto e estado de tela da spec; todo ramo das funções puras | `apps/web/src/**/*.test.ts(x)` | `pnpm --filter @am/web test` |
| Jornadas, axe, teclado e larguras | e2e (Playwright + compose) | A jornada do Success Criteria e as páginas em todos os estados | `tests/e2e/specs/**/*.spec.ts` | `pnpm test:e2e` |
| Documentos e migrações geradas | none | build gate only | - | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks de contratos, UI e web | `pnpm lint && pnpm typecheck && pnpm test` |
| Full | Tasks com testes de integração | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration` |
| E2E | T35 | `pnpm test:e2e` (local; fora do CI) |
| Build | Fim de fase e tasks de documento | `pnpm build && pnpm typecheck && pnpm lint && pnpm test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Contratos e schema

```
T1 → T2 → T3
```

### Phase 2: Seed

```
T4 → T5
```

### Phase 3: API do member e API pública

```
T6 → T7 → T8
```

### Phase 4: API do admin

```
T9 → T10 → T11 → T12 → T13 → T14 → T15
```

### Phase 5: Base do web

```
T16 → T17 → T18 → T19
```

### Phase 6: Componentes de UI

```
T20 → T21 → T22 → T23 → T24 → T25
```

### Phase 7: Telas do admin

```
T26 → T27 → T28 → T29 → T30 → T31 → T32 → T33 → T34
```

### Phase 8: Fechamento

```
T35 → T36
```

---

## Model Assignment

Plano de execução: o orquestrador e o Verifier rodam em **Opus 5.5**, e **todas as tasks são executadas por sub-agentes Sonnet 5.5**, um lote por vez, em sequência. O orquestrador não implementa: despacha, confere os gates por conta própria, lê o diff e os testes de cada lote e devolve o defeito ao mesmo worker (até 2 rodadas por lote; depois, o problema volta ao usuário). O prompt do orquestrador está em `.specs/features/skills/orchestrator-prompt.md`. A escolha de modelo é metadado: nenhum gate depende dela.

| Lote | Fases | Tasks | Executa | Pontos que o orquestrador confere |
| ---- | ----- | ----- | ------- | --------------------------------- |
| B1 | 1, 2 e 3 | T1–T8 (8) | Sonnet 5.5 | Chave normalizada, dedupe, corrida de criação, isolamento entre contas, JSON do seed e migração igual ao gerador |
| B2 | 4 | T9–T15 (7) | Sonnet 5.5 | Lock nas quatro escritas de nome global, concorrência real, dono nunca exposto, logs limpos |
| B3 | 5 e 6 | T16–T25 (10) | Sonnet 5.5 | Testes do `identity` sem edição, `ConfirmDialog` compatível, teclado e foco dos componentes novos |
| B4 | 7 | T26–T34 (9) | Sonnet 5.5 | Textos da carta, diferenças aprovadas, estados, foco, filtros na URL, debounce |
| B5 | 8 | T35–T36 (2) | Sonnet 5.5 | Jornada, axe nos dois temas, teclado e larguras |
| Verifier | depois de T36 | - | Opus 5.5, sessão nova | Julga se o teste de cada check seguraria o critério |

Não há sub-agente de telas (screens), porque as fontes binding são as cartas HTML sem capturas, como na feature do Prumo.

---

## Task Breakdown

### T1: Contratos de skills e a chave normalizada

**What**: Schemas Zod e `normalizeSkillKey` compartilhados por API, web e gerador do seed.
**Where**: `packages/contracts/src/skills.ts`
**Depends on**: None
**Reuses**: `packages/contracts/src/identity.ts` (estilo, limites exportados)
**Requirement**: SKL-01, SKL-09, SKL-15, SKL-16, SKL-31, SKL-37, SKL-66

**Done when**:

- [x] `normalizeSkillKey` devolve `nodejs`, `c++`, `c#`, `comunicacao` e `net` para "Node.js", "C++", "C#", "Comunicação" e ".NET"
- [x] `skillTextSchema` apara, reduz espaços internos, exige 1 a 60 caracteres e chave não vazia
- [x] Existem os schemas de criar, editar (ao menos um campo), apelido, busca (`q` até 60), query do admin (`scope` com padrão `all`) e as respostas da spec; corpo com `ownerUserId` ou `scope` é aparado
- [x] Tudo exportado por `packages/contracts/src/index.ts`; testes `SKL-01`, `SKL-09`, `SKL-15`, `SKL-16`, `SKL-31`, `SKL-37`, `SKL-66` passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(contracts): add the skill contracts and the normalized key`

---

### T2: Título do `422` nos Problem Details

**What**: O `problemFor(422)` devolve o título "Unprocessable Content".
**Where**: `apps/api/src/infra/http/problem-details.ts`
**Depends on**: T1
**Reuses**: `apps/api/src/infra/http/problem-details.test.ts`
**Requirement**: SKL-30, SKL-65

**Done when**:

- [x] `titles` tem o `422`
- [x] Um teste cobre o título do `422`
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): name the 422 problem details status`

---

### T3: Schema `skills` e migração 0002

**What**: Tabelas `skills.skills` e `skills.skill_aliases`, enum de categoria e índices únicos parciais.
**Where**: `apps/api/src/modules/skills/infra/schema.ts`
**Depends on**: T2
**Reuses**: `apps/api/src/modules/identity/infra/schema.ts` (id `uuidv7()`, `pgSchema`)
**Requirement**: SKL-04

**Done when**:

- [x] O schema é reexportado em `apps/api/src/infra/database/schema.ts` e `0002_skills_schema.sql` foi gerada pelo `drizzle-kit`
- [x] Índices: chave única entre globais, `(owner_user_id, normalized_key)` único entre privadas, `normalized_alias` único, índice em `owner_user_id`
- [x] Teste `SKL-04`: nenhuma chave estrangeira do schema `skills` aponta para outro schema; testes de índice recusam duas globais com a mesma chave e aceitam a mesma chave em donos diferentes
- [x] Os testes de migração existentes continuam passando sem edição

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add the skills schema`

---

### T4: Lista do seed global

**What**: O JSON revisável com pelo menos 200 skills comuns de desenvolvimento, categoria e apelidos.
**Where**: `apps/api/src/modules/skills/seed/global-skills.json`
**Depends on**: None (Phase 1 concluída)
**Reuses**: `packages/contracts/src/skills.ts` (`normalizeSkillKey`)
**Requirement**: SKL-03

**Done when**:

- [x] Pelo menos 200 skills, cada uma com uma das sete categorias; nomes e apelidos só de tecnologias e competências, sem dado pessoal
- [x] Teste `SKL-03`: nenhuma chave repetida, nenhum apelido igual a uma chave do seed ou a outro apelido
- [x] Teste confere que os nomes de fixture dos testes de skills (`Skill Fictícia Alfa`, `Skill Fictícia Beta`, `Drizzle ORM de Teste`) não estão no seed
- [x] O autor revisa a lista no PR antes do merge (registrado na spec)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): add the global skills seed list`

---

### T5: Gerador do SQL do seed e migração 0003

**What**: Script que gera `drizzle/0003_skills_seed.sql` a partir do JSON, com a migração commitada.
**Where**: `apps/api/src/modules/skills/seed/generate-seed-sql.ts`
**Depends on**: T4
**Reuses**: `apps/api/src/infra/database/migrations.ts` (as migrações rodam na subida da API)
**Requirement**: SKL-02

**Done when**:

- [x] `pnpm --filter @am/api seed:generate` escreve o SQL com `INSERT ... ON CONFLICT DO NOTHING` nas duas tabelas e as chaves calculadas por `normalizeSkillKey`
- [x] A entrada `0003_skills_seed` está no journal do Drizzle
- [x] Teste unitário de deriva: o SQL gerado em memória é igual ao arquivo commitado
- [x] Teste `SKL-02`: num banco migrado há pelo menos 200 globais, toda `normalized_key` é a normalização do `name`, e as sete categorias aparecem

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): seed the global skills catalog by migration`

---

### T6: Busca de skills do member

**What**: `GET /skills?q=` com o módulo `skills` registrado no `AppModule`.
**Where**: `apps/api/src/modules/skills/http/skills.controller.ts`
**Depends on**: None (Phase 2 concluída)
**Reuses**: `apps/api/src/modules/identity/http/invitations.controller.ts`, `zodBody`
**Requirement**: SKL-05, SKL-06, SKL-07, SKL-08, SKL-09, SKL-10

**Done when**:

- [x] `SkillsModule`, `SkillsRepository.search` e `SkillsService.search` criados; rota `@Roles('member')`
- [x] Testes `SKL-05` a `SKL-10` passam contra Postgres real com o seed e duas contas member (ordem nome primeiro, 20 itens, isolamento, `q` acima de 60 caracteres, escopo)
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): search the skills catalog`

---

### T7: Criar skill privada

**What**: `POST /skills`: cria a privada, devolve a existente ou recusa.
**Where**: `apps/api/src/modules/skills/application/skills.service.ts`
**Depends on**: T6
**Reuses**: `SkillsRepository` e `zodBody`
**Requirement**: SKL-11, SKL-12, SKL-13, SKL-14, SKL-15, SKL-16, SKL-23

**Done when**:

- [x] `create` confere o nome contra globais, apelidos de globais e privadas do próprio usuário; `201` ou `200` conforme o caso; a corrida é resolvida por `ON CONFLICT` e releitura
- [x] Testes `SKL-11` a `SKL-16` e `SKL-23` passam (duas criações simultâneas, dono só da sessão, admin recebe `403` em `GET` e `POST /skills`)
- [x] Os testes usam só nomes fictícios fora do seed

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): create private skills`

---

### T8: API pública do módulo para as próximas fatias

**What**: `SkillsCatalog.visibleIds` exportado por `modules/skills/index.ts`.
**Where**: `apps/api/src/modules/skills/application/skills-catalog.ts`
**Depends on**: T7
**Reuses**: `apps/api/src/modules/identity/index.ts` (formato da API pública)
**Requirement**: SKL-58, SKL-59

**Done when**:

- [x] `visibleIds(userId, ids)` devolve só ids globais ou privados do usuário e descarta o que não é uuid antes da consulta
- [x] `index.ts` exporta `SkillsModule` e `SkillsCatalog`; o `AppModule` importa pelo `index.ts`
- [x] Testes `SKL-58` e `SKL-59` passam

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): expose the skills catalog to other modules`

---

### T9: Lista do catálogo para o admin

**What**: `GET /admin/skills` com filtros, cursor, apelidos e contagens.
**Where**: `apps/api/src/modules/skills/http/skills-admin.controller.ts`
**Depends on**: None (Phase 3 concluída)
**Reuses**: `InvitationsRepository.listPending` (uma linha a mais para o cursor)
**Requirement**: SKL-33, SKL-34, SKL-35, SKL-36, SKL-37

**Done when**:

- [x] `domain/cursor.ts` codifica e decodifica o cursor e recusa texto inválido (teste unitário)
- [x] Resposta `{ items, nextCursor, counts }`, 50 por página, sem campo que identifique o dono; filtros de `scope`, `category` e `q` combinados; `counts` ignora os filtros
- [x] Testes `SKL-33` a `SKL-37` passam, incluindo seguir `nextCursor` até o fim

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): list the skills catalog for the admin`

---

### T10: Promover skill privada

**What**: `POST /skills/:id/promote` com o lock consultivo dos nomes globais.
**Where**: `apps/api/src/modules/skills/application/skills-admin.service.ts`
**Depends on**: T9
**Reuses**: `SkillsRepository.lockGlobalNames` (novo) e `SkillsAdminController`
**Requirement**: SKL-17, SKL-18, SKL-19, SKL-20, SKL-21, SKL-24

**Done when**:

- [x] `promote` roda em transação com `pg_advisory_xact_lock`, mantém `id`, nome e categoria, é idempotente para global e responde `409` quando a chave é de global ou de apelido
- [x] Testes `SKL-17` a `SKL-21` e `SKL-24` (duas privadas de mesma chave promovidas ao mesmo tempo: uma `200`, outra `409`) passam

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): promote a private skill to global`

---

### T11: Apelido de skill global

**What**: `POST /skills/:id/aliases` com texto digitado, chave normalizada e conflitos.
**Where**: `apps/api/src/modules/skills/http/skills-admin.controller.ts` (modify)
**Depends on**: T10
**Reuses**: `SkillsAdminService` (lock da T10)
**Requirement**: SKL-22, SKL-26, SKL-27, SKL-28, SKL-29, SKL-30, SKL-31

**Done when**:

- [x] `addAlias` responde `201` com `{ id, alias }`, `200` para o apelido repetido da mesma skill, `409` para chave de global ou apelido de outra, `422` para privada, `404` e `400` conforme a spec
- [x] Testes `SKL-22` (member recebe `403` em promover, apelidos e `GET /admin/skills`), `SKL-26` a `SKL-31` passam

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add aliases to global skills`

---

### T12: Editar nome e categoria de skill global

**What**: `PATCH /skills/:id`.
**Where**: `apps/api/src/modules/skills/application/skills-admin.service.ts` (modify)
**Depends on**: T11
**Reuses**: `SkillsAdminService.addAlias` (checagem de conflito)
**Requirement**: SKL-62, SKL-63, SKL-64, SKL-65, SKL-66

**Done when**:

- [x] `update` recalcula a chave, mantém o `id`, aceita só a grafia nova com a mesma chave, recusa chave de outra global ou de qualquer apelido (inclusive o próprio) com `409`, privada com `422`
- [x] Testes `SKL-62` a `SKL-66` passam, inclusive que o nome antigo deixa de casar e que nenhum apelido é criado

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): edit the name and category of a global skill`

---

### T13: Editar e remover apelido

**What**: `PATCH` e `DELETE /skills/:id/aliases/:aliasId`.
**Where**: `apps/api/src/modules/skills/application/skills-admin.service.ts` (modify)
**Depends on**: T12
**Reuses**: `SkillsAdminService.addAlias`
**Requirement**: SKL-67, SKL-68, SKL-69, SKL-70, SKL-71

**Done when**:

- [x] `updateAlias` e `removeAlias` com as respostas `200`, `204`, `409`, `400` e `404` da spec; apelido de outra skill é `404`
- [x] Testes `SKL-67` a `SKL-71` passam (inclui member recebendo `403` nos três métodos)

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): edit and remove skill aliases`

---

### T14: Concorrência e superfície das rotas

**What**: Testes das garantias que só existem com todas as operações prontas.
**Where**: `apps/api/src/modules/skills/http/skills-invariants.int.test.ts`
**Depends on**: T13
**Reuses**: `apps/api/test/api.ts` (`startApi`)
**Requirement**: SKL-25, SKL-32

**Done when**:

- [x] Teste `SKL-32`: requisições paralelas misturando promover, renomear e criar ou editar apelido nunca deixam chave global igual a outra chave global ou a um apelido
- [x] Teste `SKL-25`: nenhuma rota registrada despromove ou exclui uma skill
- [x] Se um teste revelar falha, a correção entra nesta task, com o teste mantido

**Tests**: integration
**Gate**: full

**Commit**: `test(api): hold the global names invariant under concurrency`

---

### T15: Eventos de log das mudanças no catálogo

**What**: Os serviços registram `skill.created`, `skill.updated`, `skill.promoted` e os três eventos de apelido.
**Where**: `apps/api/src/modules/skills/application/skills-admin.service.ts` (modify)
**Depends on**: T14
**Reuses**: `apps/api/src/infra/logging/logging.module.ts`, `PinoLogger`
**Requirement**: SKL-60, SKL-61

**Done when**:

- [x] Cada operação registra `{ event, skillId, actorId }`, incluindo a criação feita em `SkillsService`
- [x] Testes `SKL-60` e `SKL-61` leem as linhas JSON e não acham cookie, token nem e-mail

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): log the skills catalog changes`

---

### T16: Helpers do BFF em `lib/bff.ts`

**What**: Move `Outcome`, `ApiFailure`, `parsed`, `accepted`, o contexto da requisição e o repasse de `Set-Cookie` para `lib`.
**Where**: `apps/web/src/lib/bff.ts`
**Depends on**: None (Phase 4 concluída)
**Reuses**: `apps/web/src/features/identity/api/server-functions.ts`
**Requirement**: AD-016

**Done when**:

- [x] `identity` importa de `lib/bff.ts` e reexporta `Outcome` e `ApiFailure`; nenhum comportamento muda
- [x] Os testes do `identity` passam sem edição e o número de testes não cai

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(web): share the BFF helpers through lib`

---

### T17: `PATCH` no `callApi`

**What**: `ApiMethod` aceita `PATCH` e o `fetch` o repassa.
**Where**: `apps/web/src/lib/call-api.ts`
**Depends on**: T16
**Reuses**: `apps/web/src/lib/call-api.test.ts`
**Requirement**: SKL-54

**Done when**:

- [x] `ApiMethod` inclui `PATCH`; um teste confere o método e o corpo enviados
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): let callApi send PATCH`

---

### T18: Server functions do catálogo

**What**: Uma função pura e uma `createServerFn` por endpoint do admin, mais a tabela `ADMIN_SKILLS_ENDPOINTS`.
**Where**: `apps/web/src/features/skills/api/server-functions.ts`
**Depends on**: T17
**Reuses**: `apps/web/src/features/identity/api/server-functions.ts` (padrão)
**Requirement**: SKL-54

**Done when**:

- [x] Funções para listar, promover, editar, criar, editar e remover apelido, validadas contra os contratos
- [x] Teste `SKL-54` compara `ADMIN_SKILLS_ENDPOINTS` com a lista esperada e afirma que `GET /skills` e `POST /skills` não aparecem
- [x] Testes com MSW cobrem sucesso, `409`, `404` e API fora do ar (`503`)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the skills server functions`

---

### T19: Modelo do catálogo: categorias, filtros e mensagens

**What**: Rótulos de categoria (AD-015), leitura e escrita dos filtros na URL e os textos do catálogo.
**Where**: `apps/web/src/features/skills/model/filters.ts`
**Depends on**: T18
**Reuses**: `apps/web/src/features/identity/model/messages.ts`
**Requirement**: SKL-38, SKL-41

**Done when**:

- [x] `parseCatalogSearch` aceita `scope`, `category` e `q` válidos e cai no padrão para o resto; `searchOf` omite o padrão
- [x] `categories.ts` e `messages.ts` com os textos da spec; testes unitários cobrem todos os ramos

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the skills catalog model`

---

### T20: FilterChip

**What**: Botão de filtro com `aria-pressed` e contagem opcional em `font-mono`.
**Where**: `packages/ui/src/components/filter-chip/filter-chip.tsx`
**Depends on**: None (Phase 5 concluída)
**Reuses**: `packages/ui/src/components/button/button.tsx`
**Requirement**: SKL-41, SKL-42

**Done when**:

- [x] Exportado em `packages/ui/src/index.ts`; story nos dois temas
- [x] Teste unitário e de navegador do estado pressionado, do foco visível e do contraste

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the filter chip`

---

### T21: SearchInput

**What**: `input type="search"` com o ícone `search`, rótulo acessível vindo de quem usa.
**Where**: `packages/ui/src/components/search-input/search-input.tsx`
**Depends on**: T20
**Reuses**: `packages/ui/src/components/field/field.tsx`
**Requirement**: SKL-41

**Done when**:

- [x] Exportado; story nos dois temas
- [x] Testes cobrem rótulo, digitação e foco

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the search input`

---

### T22: Dialog

**What**: Diálogo de formulário sobre `@radix-ui/react-dialog`, na mesma superfície do `ConfirmDialog`.
**Where**: `packages/ui/src/components/dialog/dialog.tsx`
**Depends on**: T21
**Reuses**: `packages/ui/src/components/confirm-dialog/confirm-dialog.tsx`
**Requirement**: SKL-48, SKL-53, SKL-72

**Done when**:

- [x] Dependência `@radix-ui/react-dialog` instalada; partes `Root`, `Trigger`, `Content`, `Title`, `Description`, `Footer`
- [x] Story nos dois temas; teste de navegador: foco entra, fica preso, Esc fecha e o foco volta ao gatilho

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the form dialog`

---

### T23: DropdownMenu

**What**: Menu sobre `@radix-ui/react-dropdown-menu` para o "⋯" da linha.
**Where**: `packages/ui/src/components/dropdown-menu/dropdown-menu.tsx`
**Depends on**: T22
**Reuses**: `packages/ui/src/components/confirm-dialog/confirm-dialog.tsx` (superfície)
**Requirement**: SKL-40, SKL-53

**Done when**:

- [x] Dependência instalada; partes `Root`, `Trigger`, `Content`, `Item`
- [x] Story nos dois temas; teste de navegador: Enter abre, setas movem, Esc fecha e devolve o foco

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the dropdown menu`

---

### T24: Combobox

**What**: Campo com lista de opções no padrão WAI-ARIA 1.2, controlado por quem usa.
**Where**: `packages/ui/src/components/combobox/combobox.tsx`
**Depends on**: T23
**Reuses**: `packages/ui/src/components/field/field.tsx`
**Requirement**: SKL-48

**Done when**:

- [x] `query`, `options`, `onQueryChange`, `onSelect`, `selected`; `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`
- [x] Story nos dois temas; teste de navegador: setas, Enter escolhe, Esc fecha, sem opção escolhida o valor não vale

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the combobox`

---

### T25: ConfirmDialog com intenção e confirmação assíncrona

**What**: `confirmIntent` e `onConfirm` que pode devolver uma promessa.
**Where**: `packages/ui/src/components/confirm-dialog/confirm-dialog.tsx` (modify)
**Depends on**: T24
**Reuses**: o próprio componente e suas stories
**Requirement**: SKL-46, SKL-50

**Done when**:

- [x] `confirmIntent` tem padrão `danger`; com promessa, o diálogo fica aberto, os botões desabilitados e `aria-busy` no de confirmar até a promessa terminar
- [x] Os testes e a story atuais passam sem edição; novos testes cobrem a intenção `primary` e o estado pendente

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): let the confirm dialog wait for the action`

---

### T26: Linha do catálogo

**What**: Nome, selo "Privada", apelidos ou "—", categoria, e "Promover" ou o menu "⋯".
**Where**: `apps/web/src/features/skills/components/SkillRow.tsx`
**Depends on**: None (Phase 6 concluída)
**Reuses**: `apps/web/src/features/identity/components/InvitationsPanel.tsx` (Row)
**Requirement**: SKL-40

**Done when**:

- [x] Só a privada tem "Promover"; só a global tem o menu com nome acessível "Ações de {nome}" e os itens "Editar" e "Apelidos"
- [x] Teste `SKL-40` passa

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the skills catalog row`

---

### T27: Tela do catálogo: lista, contagens e falha

**What**: A página `SkillsCatalog` com título, total, botão "Apelido", `Alert` informativo, linhas e "Carregar mais".
**Where**: `apps/web/src/features/skills/components/SkillsCatalog.tsx`
**Depends on**: T26
**Reuses**: `InvitationsPanel` (`useInfiniteQuery`, `onExpired`)
**Requirement**: SKL-38, SKL-44, SKL-51

**Done when**:

- [x] Mostra a carta `PageSkills` com os textos copiados; "Carregar mais" só com `nextCursor`; falha da leitura vira `Alert` `danger` sem linhas
- [x] Testes `SKL-38`, `SKL-44` e `SKL-51` passam (incluindo o `401` que aciona `onExpired`)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the skills catalog list`

---

### T28: Filtros e busca do catálogo

**What**: Chips de escopo e categoria, busca com 300 ms e estado vazio com "Limpar filtros".
**Where**: `apps/web/src/features/skills/components/SkillsCatalog.tsx` (modify)
**Depends on**: T27
**Reuses**: `FilterChip`, `SearchInput`, `EmptyState`
**Requirement**: SKL-41, SKL-42, SKL-43

**Done when**:

- [x] Os filtros vão para a URL pelo `onFiltersChange`; clicar no chip de categoria pressionado remove o filtro; a busca espera 300 ms
- [x] Testes `SKL-41` a `SKL-43` passam com relógio simulado

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): filter and search the skills catalog`

---

### T29: Promover pelo catálogo

**What**: Confirmação, chamada, atualização da linha e do contador, e o `Alert` do `409`.
**Where**: `apps/web/src/features/skills/components/SkillsCatalog.tsx` (modify)
**Depends on**: T28
**Reuses**: `ConfirmDialog` com `confirmIntent="primary"`
**Requirement**: SKL-45, SKL-46, SKL-47, SKL-50

**Done when**:

- [x] O diálogo diz que a skill passa a ser visível para todas as pessoas e que não se desfaz por aqui; depois do sucesso o foco vai para a linha
- [x] Testes `SKL-45`, `SKL-46`, `SKL-47` e `SKL-50` (promoção) passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): promote a skill from the catalog`

---

### T30: Diálogo de edição de skill

**What**: "Editar" no menu: nome e categoria com erro por campo.
**Where**: `apps/web/src/features/skills/components/EditSkillDialog.tsx`
**Depends on**: T29
**Reuses**: `Dialog`, `Field`, `skillTextSchema`
**Requirement**: SKL-72, SKL-73, SKL-50

**Done when**:

- [x] Campos preenchidos, validação do contrato, `409` no campo "Nome" e `400` no campo inválido sem fechar
- [x] Testes `SKL-72`, `SKL-73` e `SKL-50` (edição) passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): edit a global skill from the catalog`

---

### T31: Diálogo "Apelido" da barra superior

**What**: Escolher uma global pelo `Combobox` e digitar o apelido.
**Where**: `apps/web/src/features/skills/components/AddAliasDialog.tsx`
**Depends on**: T30
**Reuses**: `Combobox`, `Dialog`, `listAdminSkills` com `scope=global`
**Requirement**: SKL-48, SKL-49, SKL-50

**Done when**:

- [x] Exige escolher uma skill; envia, fecha e mostra o apelido na linha; `409` no campo "Apelido"; `400` no campo inválido
- [x] Testes `SKL-48`, `SKL-49` e `SKL-50` (apelido) passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add aliases from the catalog top bar`

---

### T32: Diálogo "Apelidos de {nome}"

**What**: Lista os apelidos da skill com editar inline, remover com confirmação e um campo para acrescentar.
**Where**: `apps/web/src/features/skills/components/AliasesDialog.tsx`
**Depends on**: T31
**Reuses**: `Dialog`, `ConfirmDialog`
**Requirement**: SKL-74, SKL-75, SKL-76, SKL-50

**Done when**:

- [x] Mensagem "Esta skill não tem apelidos."; editar com `409` mantém o campo aberto; remover pede `ConfirmDialog` e cancelar devolve o foco ao botão "Remover"
- [x] Testes `SKL-74`, `SKL-75`, `SKL-76` e `SKL-50` (remoção) passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): manage the aliases of a skill`

---

### T33: Rota `/admin/skills` e item da sidebar

**What**: A rota liga o catálogo às server functions e à URL; a sidebar ganha "Catálogo de skills".
**Where**: `apps/web/src/routes/admin/_protected/skills.tsx`
**Depends on**: T32
**Reuses**: `apps/web/src/routes/admin/_protected/invitations.tsx`
**Requirement**: SKL-39

**Done when**:

- [x] `validateSearch` usa `parseCatalogSearch`; o item "Catálogo de skills" (ícone `Tags`) fica entre "Convites" e "Status do sistema", com `aria-current="page"` na rota
- [x] Teste `SKL-39` passa; `routeTree.gen.ts` regenerada

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the skills catalog route`

---

### T34: Widget de skills privadas no painel

**What**: `PrivateSkillsSummary` e a leitura no loader do painel.
**Where**: `apps/web/src/features/skills/components/PrivateSkillsSummary.tsx`
**Depends on**: T33
**Reuses**: `apps/web/src/features/identity/components/InvitationSummary.tsx`
**Requirement**: SKL-55, SKL-56, SKL-57

**Done when**:

- [x] Até 8 `SkillTag` privadas em ordem alfabética, "e mais N", ação "Abrir catálogo" para `/admin/skills?scope=private`; vazio e falha com os textos da spec
- [x] O loader de `routes/admin/_protected/index.tsx` lê as privadas no mesmo `Promise.all`; testes `SKL-55` a `SKL-57` passam

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): show private skills on the admin dashboard`

---

### T35: E2E do catálogo

**What**: Jornada no navegador contra a stack: privada criada pela API, promoção, edição, apelidos, axe, teclado e larguras.
**Where**: `tests/e2e/specs/browser/skills.spec.ts`
**Depends on**: None (Phase 7 concluída)
**Reuses**: `tests/e2e/specs/browser/identity.spec.ts`, `tests/e2e/support/identity.ts`
**Requirement**: SKL-52, SKL-53

**Done when**:

- [x] A jornada do Success Criteria passa: o member cria a privada por `127.0.0.1:3333`, o admin a promove em `/admin/skills` e outro member a acha na busca com o mesmo id
- [x] Teste `SKL-52`: axe nos estados lista, vazio, menu aberto, confirmações, diálogos de apelido e edição e `Alert` de erro, nos dois temas
- [x] Teste `SKL-53`: teclado completo, foco preso e Esc nos diálogos, sem rolagem horizontal a 375 px e 1280 px
- [x] Gate check passes: `pnpm test:e2e`

**Tests**: e2e
**Gate**: e2e

**Commit**: `test(e2e): cover the skills catalog`

---

### T36: Documentos

**What**: O `.design`, o guia de teste manual e a lista de páginas do design refletem a feature.
**Where**: `.design/application-manager.md`
**Depends on**: T35
**Reuses**: `docs/guia-teste-manual.md`, `docs/design/principles.md`, `docs/design/system/components/PageAdminDashboard/README.md`
**Requirement**: SKL-33

**Done when**:

- [ ] A seção Skill lista as rotas acrescentadas e passa a "done"; `docs/guia-teste-manual.md` ensina a criar uma privada pela API e a curar no catálogo
- [ ] `docs/design/principles.md` move `PageSkills` para as páginas atuais e o README do painel deixa de dizer que o terceiro widget está pendente
- [ ] Gate check passes: `pnpm build && pnpm typecheck && pnpm lint && pnpm test`

**Tests**: none
**Gate**: build

**Commit**: `docs: record the skills feature`

---

## Checks

**C1** - The system SHALL derive the normalized key of a name or alias by Unicode NFKD, removing combining marks, lowercasing and keeping only letters, digits, `+` and `#`. (SKL-01, AC 1)
Proof: run contracts | ✓ SKL-01

**C2** - WHEN as migrações rodam num banco novo THEN o catálogo SHALL conter pelo menos 200 skills globais, cada uma com nome, uma das sete categorias e os apelidos do seed. (SKL-02, AC 2)
Proof: run api-integration | ✓ SKL-02

**C3** - The seed SHALL hold no two skills with the same normalized key and no alias whose normalized key equals a seeded skill key or another alias. (SKL-03, AC 3)
Proof: run api-unit | ✓ SKL-03

**C4** - The `skills` schema SHALL hold no foreign key to any other schema. (SKL-04, AC 4)
Proof: run api-integration | ✓ SKL-04

**C5** - WHEN um member chama `GET /skills?q=` THEN a API SHALL responder `200` com um array de `{ id, name, category, scope }` com as globais e as privadas dele cuja chave do nome ou de algum apelido contém a chave de `q`, no máximo 20. (SKL-05, AC 1)
Proof: run api-integration | ✓ SKL-05

**C6** - The search SHALL list first the skills whose name matches and then those that match only through an alias, each group in alphabetical order of the normalized key, and SHALL always return the official name. (SKL-06, AC 2)
Proof: run api-integration | ✓ SKL-06

**C7** - WHEN `q` está ausente ou a chave de `q` é vazia THEN a API SHALL responder `200` com as 20 primeiras skills visíveis em ordem alfabética da chave. (SKL-07, AC 3)
Proof: run api-integration | ✓ SKL-07

**C8** - IF existe uma skill privada de outra pessoa que casa com `q` THEN a API SHALL não devolvê-la. (SKL-08, AC 4)
Proof: run api-integration | ✓ SKL-08

**C9** - IF `q` tem mais de 60 caracteres THEN a API SHALL responder `400` em Problem Details. (SKL-09, AC 5)
Proof: run api-integration | ✓ SKL-09

**C10** - WHEN uma skill global é devolvida THEN o campo `scope` SHALL ser `global`, e WHEN uma privada da própria pessoa é devolvida THEN `scope` SHALL ser `private`. (SKL-10, AC 6)
Proof: run api-integration | ✓ SKL-10

**C11** - WHEN um member envia `POST /skills` com `{ name, category }` válidos cuja chave não casa com nenhuma global, nenhum apelido de global nem privada dele THEN a API SHALL criar a skill privada do usuário da sessão e responder `201` com `{ id, name, category, scope: "private" }`. (SKL-11, AC 1)
Proof: run api-integration | ✓ SKL-11

**C12** - WHEN a chave de `name` casa com uma global, com um apelido de global ou com uma privada do próprio usuário THEN a API SHALL responder `200` com a skill existente, sem criar linha e ignorando a categoria enviada. (SKL-12, AC 2)
Proof: run api-integration | ✓ SKL-12

**C13** - WHEN duas requisições do mesmo usuário com a mesma chave nova chegam ao mesmo tempo THEN a API SHALL gravar uma só skill, respondendo `201` a uma e `200` à outra. (SKL-13, AC 3)
Proof: run api-integration | ✓ SKL-13

**C14** - WHEN outra pessoa cria um nome que só existe como privada de um terceiro THEN a API SHALL criar uma privada separada para ela, com outro id, e responder `201`. (SKL-14, AC 4)
Proof: run api-integration | ✓ SKL-14

**C15** - IF `name` está vazio, passa de 60 caracteres ou tem chave normalizada vazia, ou `category` não é uma das sete categorias THEN a API SHALL responder `400` em Problem Details com o campo inválido, sem gravar nada. (SKL-15, AC 5)
Proof: run api-integration | ✓ SKL-15

**C16** - The API SHALL take the owner only from the session and SHALL ignore any `ownerUserId` or `scope` sent by the client. (SKL-16, AC 6)
Proof: run api-integration | ✓ SKL-16

**C17** - WHEN um admin chama `POST /skills/:id/promote` numa privada cuja chave não é chave nem apelido de uma global THEN a API SHALL torná-la global mantendo `id`, nome e categoria, e responder `200` com `scope: "global"`. (SKL-17, AC 1)
Proof: run api-integration | ✓ SKL-17

**C18** - WHEN uma skill é promovida THEN a busca de qualquer member SHALL passar a devolvê-la como `global`, com o mesmo `id`. (SKL-18, AC 2)
Proof: run api-integration | ✓ SKL-18

**C19** - IF a chave da privada já é chave ou apelido de uma global THEN a API SHALL responder `409` em Problem Details e a skill SHALL continuar privada. (SKL-19, AC 3)
Proof: run api-integration | ✓ SKL-19

**C20** - WHEN o admin promove uma skill que já é global THEN a API SHALL responder `200` sem alterar nada. (SKL-20, AC 4)
Proof: run api-integration | ✓ SKL-20

**C21** - IF `:id` não é um uuid ou não existe THEN a API SHALL responder `404` em Problem Details. (SKL-21, AC 5)
Proof: run api-integration | ✓ SKL-21

**C22** - IF a sessão é de um member THEN a API SHALL responder `403` a `POST /skills/:id/promote`, `POST /skills/:id/aliases` e `GET /admin/skills`, sem alterar nada. (SKL-22, AC 6)
Proof: run api-integration | ✓ SKL-22

**C23** - IF a sessão é de um admin THEN a API SHALL responder `403` a `GET /skills` e `POST /skills`. (SKL-23, AC 7)
Proof: run api-integration | ✓ SKL-23

**C24** - WHEN duas privadas de mesma chave são promovidas ao mesmo tempo THEN exatamente uma SHALL virar global e a outra SHALL receber `409`. (SKL-24, AC 8)
Proof: run api-integration | ✓ SKL-24

**C25** - The API SHALL expose no operation that turns a global skill back into a private one or that deletes a skill. (SKL-25, AC 9)
Proof: run api-integration | ✓ SKL-25

**C26** - WHEN um admin envia `POST /skills/:id/aliases` com `{ alias }` válido a uma skill global THEN a API SHALL gravar o apelido com o texto digitado e a chave normalizada e responder `201` com o `id` e o texto do apelido gravado. (SKL-26, AC 1)
Proof: run api-integration | ✓ SKL-26

**C27** - WHEN um apelido é gravado THEN a busca do member por esse apelido SHALL devolver a skill pelo nome oficial. (SKL-27, AC 2)
Proof: run api-integration | ✓ SKL-27

**C28** - IF a chave do apelido é a chave de uma global (inclusive da própria skill) ou o apelido de outra skill THEN a API SHALL responder `409` em Problem Details, sem gravar. (SKL-28, AC 3)
Proof: run api-integration | ✓ SKL-28

**C29** - WHEN o apelido já pertence à mesma skill THEN a API SHALL responder `200` com o apelido existente, sem duplicar. (SKL-29, AC 4)
Proof: run api-integration | ✓ SKL-29

**C30** - IF a skill é privada THEN a API SHALL responder `422` em Problem Details, sem gravar. (SKL-30, AC 5)
Proof: run api-integration | ✓ SKL-30

**C31** - IF `:id` não existe THEN a API SHALL responder `404`, and IF `alias` está vazio, passa de 60 caracteres ou tem chave vazia THEN a API SHALL responder `400`, sem gravar. (SKL-31, AC 6)
Proof: run api-integration | ✓ SKL-31

**C32** - WHILE requisições concorrentes criam ou editam apelidos, renomeiam ou promovem skills, o catálogo SHALL never hold a global skill whose key equals the key of another global skill or of any alias. (SKL-32, AC 7)
Proof: run api-integration | ✓ SKL-32

**C33** - WHEN um admin chama `GET /admin/skills` THEN a API SHALL responder `200` com `{ items, nextCursor, counts }`, onde cada item traz `id`, `name`, `category`, `scope` e `aliases` (o `id` e o texto de cada apelido), sem identificar o dono de uma privada. (SKL-33, AC 1)
Proof: run api-integration | ✓ SKL-33

**C34** - The list SHALL return the global skills and the private skills of every user, 50 per page in alphabetical order of the normalized key, with `nextCursor` null on the last page. (SKL-34, AC 2)
Proof: run api-integration | ✓ SKL-34

**C35** - WHEN `scope`, `category` e `q` são enviados THEN a lista SHALL devolver só o que casa com todos, e `q` casa pelo nome ou por apelido como na busca do member. (SKL-35, AC 3)
Proof: run api-integration | ✓ SKL-35

**C36** - The `counts` field SHALL hold the total number of skills and the number of private skills of the whole catalog, ignoring the filters. (SKL-36, AC 4)
Proof: run api-integration | ✓ SKL-36

**C37** - IF `scope`, `category` ou `cursor` são inválidos THEN a API SHALL responder `400` em Problem Details. (SKL-37, AC 5)
Proof: run api-integration | ✓ SKL-37

**C38** - WHEN o admin abre `/admin/skills` THEN o web SHALL mostrar a carta `PageSkills`, acrescida do menu "⋯" das globais (SKL-40): o título "Catálogo de skills" com o total do catálogo em `mono`, o botão "Apelido" com o ícone `plus`, os chips "Todas" e "Privadas" com o número de privadas, os sete chips de categoria, o campo "Nome ou apelido", as linhas em ordem alfabética e o `Alert` `info` "Promover torna a skill global. Se a chave já existir como global, a promoção é recusada e a fusão é manual.". (SKL-38, AC 1)
Proof: run web | ✓ SKL-38

**C39** - WHILE o admin está em `/admin/skills` a sidebar SHALL mostrar o item "Catálogo de skills" com `aria-current="page"`, entre "Convites" e "Status do sistema". (SKL-39, AC 2)
Proof: run web | ✓ SKL-39

**C40** - The row of a skill SHALL show its official name, the "Privada" badge when it is private, its aliases separated by commas or "—" when it has none, and its category label, and only a private row SHALL carry the button "Promover", while only a global row SHALL carry the "⋯" menu button with the accessible name "Ações de {nome}" and the items "Editar" and "Apelidos". (SKL-40, AC 3)
Proof: run web | ✓ SKL-40

**C41** - WHEN o admin escolhe "Todas" ou "Privadas", escolhe uma categoria, ou digita no campo de busca THEN o web SHALL listar só o que casa, colocar `scope`, `category` e `q` na URL e manter os filtros ao recarregar; a busca SHALL atualizar 300 ms depois da última tecla. (SKL-41, AC 4)
Proof: run web | ✓ SKL-41

**C42** - WHEN o admin usa o chip de categoria já pressionado THEN o web SHALL remover o filtro de categoria. (SKL-42, AC 5)
Proof: run web | ✓ SKL-42

**C43** - IF nenhuma skill casa com os filtros THEN o web SHALL mostrar um `EmptyState` "Nenhuma skill encontrada." com a ação "Limpar filtros", que SHALL zerar `scope`, `category` e `q`. (SKL-43, AC 6)
Proof: run web | ✓ SKL-43

**C44** - WHERE a resposta traz `nextCursor` o web SHALL mostrar o botão "Carregar mais", que acrescenta a página seguinte à lista, e WHERE `nextCursor` é nulo o botão SHALL não aparecer. (SKL-44, AC 7)
Proof: run web | ✓ SKL-44

**C45** - WHEN o admin usa "Promover" numa linha THEN o web SHALL abrir um `ConfirmDialog` "Promover {nome}?" que diz que a skill passa a ser visível para todas as pessoas e que a promoção não se desfaz por aqui, e WHEN confirma THEN o web SHALL chamar a promoção e mostrar a linha sem o selo e sem o botão, com o número de "Privadas" reduzido em um e o total igual. (SKL-45, AC 8)
Proof: run web | ✓ SKL-45

**C46** - WHEN o admin cancela ou fecha o `ConfirmDialog` de promoção THEN o web SHALL não chamar a API e SHALL devolver o foco ao botão "Promover" da linha. (SKL-46, AC 9)
Proof: run web | ✓ SKL-46

**C47** - IF a promoção responde `409` THEN o web SHALL fechar o diálogo, manter a linha como privada e mostrar um `Alert` `danger` "Já existe uma skill global com esse nome ou apelido. A fusão é manual.". (SKL-47, AC 10)
Proof: run web | ✓ SKL-47

**C48** - WHEN o admin usa o botão "Apelido" THEN o web SHALL abrir um diálogo com o campo "Skill", que busca entre as globais por nome ou apelido e exige escolher uma, e o campo "Apelido", e WHEN ele envia os dois válidos THEN o web SHALL chamar a API, fechar o diálogo e mostrar o apelido na linha dessa skill. (SKL-48, AC 11)
Proof: run web | ✓ SKL-48

**C49** - IF a API responde `409` ao apelido THEN o web SHALL manter o diálogo aberto com o erro "Esse apelido já pertence a outra skill." no campo "Apelido", e IF responde `400` THEN o erro SHALL aparecer no campo inválido, sem fechar o diálogo. (SKL-49, AC 12)
Proof: run web | ✓ SKL-49

**C50** - WHILE uma chamada de promoção, edição, apelido ou remoção de apelido está pendente o botão de confirmar SHALL ficar desabilitado com `aria-busy`, de modo que um segundo clique não envie outra chamada. (SKL-50, AC 13)
Proof: run web | ✓ SKL-50

**C51** - IF a leitura do catálogo falha THEN o web SHALL mostrar um `Alert` `danger` com o texto de indisponibilidade já usado no app e nenhuma linha, e IF a sessão expirou THEN o web SHALL seguir o redirecionamento ao login do admin que as telas protegidas já têm. (SKL-51, AC 14)
Proof: run web | ✓ SKL-51

**C52** - The page SHALL pass the axe scan in light and dark themes in the list, empty, open row menu, promote confirm dialog, remove-alias confirm dialog, add-alias dialog, edit dialog, aliases dialog and error alert states. (SKL-52, AC 15)
Proof: run e2e | ✓ SKL-52

**C53** - The page SHALL be fully operable by keyboard, with the row menu opening with Enter and moving between items with the arrow keys, the dialogs moving focus in, trapping it and closing with Escape, and SHALL show no horizontal page scroll at 375 px and 1280 px. (SKL-53, AC 16)
Proof: run e2e | ✓ SKL-53

**C54** - The web SHALL reach the skills API only through one server function per admin endpoint, and the browser SHALL have no function for `GET /skills` or `POST /skills`. (SKL-54, AC 17)
Proof: run web | ✓ SKL-54

**C55** - WHEN o admin abre `/admin` THEN o web SHALL mostrar o widget "Skills privadas aguardando promoção" em largura total, com as privadas como `SkillTag` privadas em ordem alfabética, até 8, e "e mais N" quando houver mais, e a ação `ghost` "Abrir catálogo" com seta que leva a `/admin/skills?scope=private`. (SKL-55, AC 1)
Proof: run web | ✓ SKL-55

**C56** - IF não há privadas THEN o widget SHALL mostrar "Nenhuma skill privada aguardando promoção." e manter a ação "Abrir catálogo". (SKL-56, AC 2)
Proof: run web | ✓ SKL-56

**C57** - IF a leitura das privadas falha THEN o widget SHALL mostrar um `Alert` `danger` e os outros widgets do painel SHALL continuar na tela. (SKL-57, AC 3)
Proof: run web | ✓ SKL-57

**C58** - The `skills` module SHALL export from its `index.ts` an operation that, given a user id and skill ids, returns the ids visible to that user (global or the user's own private). (SKL-58, AC 1)
Proof: run api-integration | ✓ SKL-58

**C59** - IF um id pertence à privada de outra pessoa ou não existe THEN a operação SHALL não incluí-lo no resultado. (SKL-59, AC 2)
Proof: run api-integration | ✓ SKL-59

**C60** - WHEN uma skill é criada, editada ou promovida, ou um apelido é criado, editado ou removido, THEN a API SHALL registrar um evento estruturado com a operação, o id da skill e o id do usuário que agiu. (SKL-60, AC 1)
Proof: run api-integration | ✓ SKL-60

**C61** - The skills log events SHALL contain no cookie, session token or e-mail. (SKL-61, AC 2)
Proof: run api-integration | ✓ SKL-61

**C62** - WHEN um admin envia `PATCH /skills/:id` com `name`, `category` ou os dois, válidos, a uma skill global THEN a API SHALL atualizar a skill, recalcular a chave normalizada, manter o `id` e responder `200` com `{ id, name, category, scope: "global" }`. (SKL-62, AC 1)
Proof: run api-integration | ✓ SKL-62

**C63** - WHEN uma skill é renomeada THEN a busca pelo nome novo SHALL devolvê-la, a busca só pelo nome antigo SHALL não devolvê-la e a API SHALL não criar apelido algum. (SKL-63, AC 2)
Proof: run api-integration | ✓ SKL-63

**C64** - IF a chave do nome novo é a chave de outra global ou o apelido de qualquer skill, inclusive da própria THEN a API SHALL responder `409` em Problem Details, sem alterar nada; a mesma chave com outra grafia SHALL ser aceita. (SKL-64, AC 3)
Proof: run api-integration | ✓ SKL-64

**C65** - IF a skill é privada THEN a API SHALL responder `422` em Problem Details a `PATCH /skills/:id`, sem alterar nada. (SKL-65, AC 4)
Proof: run api-integration | ✓ SKL-65

**C66** - IF o corpo não traz `name` nem `category`, o nome está vazio, passa de 60 caracteres ou tem chave vazia, ou a categoria não é uma das sete THEN a API SHALL responder `400`, and IF `:id` não existe THEN a API SHALL responder `404`, sem alterar nada. (SKL-66, AC 5)
Proof: run api-integration | ✓ SKL-66

**C67** - WHEN um admin envia `PATCH /skills/:id/aliases/:aliasId` com `{ alias }` válido THEN a API SHALL trocar o texto e a chave do apelido e responder `200` com o `id` e o texto do apelido. (SKL-67, AC 6)
Proof: run api-integration | ✓ SKL-67

**C68** - IF a chave do apelido novo é a chave de uma global ou o apelido de outra skill THEN a API SHALL responder `409` em Problem Details, e IF o apelido é inválido THEN `400`, and IF a skill ou o apelido não existe, ou o apelido é de outra skill, THEN `404`, sem alterar nada; a mesma chave com outra grafia SHALL ser aceita. (SKL-68, AC 7)
Proof: run api-integration | ✓ SKL-68

**C69** - WHEN um admin chama `DELETE /skills/:id/aliases/:aliasId` THEN a API SHALL apagar o apelido e responder `204`, e a busca por ele SHALL deixar de devolver a skill. (SKL-69, AC 8)
Proof: run api-integration | ✓ SKL-69

**C70** - IF o apelido já foi apagado, a skill não existe ou o apelido é de outra skill THEN a API SHALL responder `404` a `DELETE /skills/:id/aliases/:aliasId`. (SKL-70, AC 9)
Proof: run api-integration | ✓ SKL-70

**C71** - IF a sessão é de um member THEN a API SHALL responder `403` a `PATCH /skills/:id`, `PATCH /skills/:id/aliases/:aliasId` e `DELETE /skills/:id/aliases/:aliasId`, sem alterar nada. (SKL-71, AC 10)
Proof: run api-integration | ✓ SKL-71

**C72** - WHEN o admin usa "Editar" no menu de uma global THEN o web SHALL abrir um diálogo "Editar skill" com os campos "Nome" e "Categoria" preenchidos, e WHEN ele envia valores válidos THEN o web SHALL chamar a API, fechar o diálogo e mostrar a linha com o nome e a categoria novos, com os totais iguais. (SKL-72, AC 18)
Proof: run web | ✓ SKL-72

**C73** - IF a edição responde `409` THEN o web SHALL manter o diálogo aberto com o erro "Já existe uma skill ou apelido com esse nome." no campo "Nome", e IF responde `400` THEN o erro SHALL aparecer no campo inválido, sem fechar o diálogo. (SKL-73, AC 19)
Proof: run web | ✓ SKL-73

**C74** - WHEN o admin usa "Apelidos" no menu de uma global THEN o web SHALL abrir um diálogo "Apelidos de {nome}" que lista cada apelido com as ações "Editar" e "Remover" e tem um campo para acrescentar outro, e IF a skill não tem apelidos THEN o diálogo SHALL dizer "Esta skill não tem apelidos.". (SKL-74, AC 20)
Proof: run web | ✓ SKL-74

**C75** - WHEN o admin usa "Editar" num apelido e envia um texto válido THEN o web SHALL chamar a API e mostrar o texto novo no diálogo e na linha, and IF a API responde `409` THEN o web SHALL manter o campo aberto com o erro "Esse apelido já pertence a outra skill.". (SKL-75, AC 21)
Proof: run web | ✓ SKL-75

**C76** - WHEN o admin usa "Remover" num apelido THEN o web SHALL abrir um `ConfirmDialog` "Remover o apelido {apelido}?" que diz que a busca por ele deixa de achar a skill, and WHEN ele confirma THEN o web SHALL chamar a API e tirar o apelido do diálogo e da linha, and WHEN cancela ou fecha THEN o web SHALL não chamar a API e devolver o foco ao botão "Remover" do apelido. (SKL-76, AC 22)
Proof: run web | ✓ SKL-76

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-08 - user: "Pode executar as task até o final, só pare se precisar de uma decisão importante minha"
**Dispatched:** B1 (T1–T8, Sonnet 5.5) at HEAD 373a398, 2026-11-08 13:05 - returned; accepted at 21ec8ce after 1 fix round (console.log in the seed generator) | B2 (T9–T15, Sonnet 5.5) at HEAD 21ec8ce, 2026-11-08 13:22 - returned; accepted at 9b03ec7 with no fix round | B3 (T16–T25, Sonnet 5.5) at HEAD 9b03ec7, 2026-11-08 13:41 - returned; accepted at 8367a02 with no fix round | B4 (T26–T34, Sonnet 5.5) at HEAD 8367a02, 2026-11-08 14:02 - returned; accepted at 48fee4c after 2 fix rounds (neutral StatusBadge for "Privada"; vitest attachments out of git) | B5 (T35–T36, Sonnet 5.5) at HEAD 48fee4c, 2026-11-08 14:31
**Orchestrator decisions:** 2026-11-08 B5 blocked on SKL-52 (axe `aria-hidden-focus` with the row menu open: Radix `DropdownMenu` is modal by default and hides the AppShell, trigger included). Decided: the `packages/ui` `DropdownMenu.Root` wrapper defaults to `modal={false}` (still overridable), proven by a ui test; no axe rule disabled.
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

Phase 1:  T1 ------→ T2 ------→ T3
Phase 2:  T4 ------→ T5
Phase 3:  T6 ------→ T7 ------→ T8
Phase 4:  T9 ------→ T10 ------→ T11 ------→ T12 ------→ T13 ------→ T14 ------→ T15
Phase 5:  T16 ------→ T17 ------→ T18 ------→ T19
Phase 6:  T20 ------→ T21 ------→ T22 ------→ T23 ------→ T24 ------→ T25
Phase 7:  T26 ------→ T27 ------→ T28 ------→ T29 ------→ T30 ------→ T31 ------→ T32 ------→ T33 ------→ T34
Phase 8:  T35 ------→ T36
```

Execução estritamente sequencial dentro de cada fase; a depender do tamanho (36 tasks), as fases se agrupam em lotes de cerca de 7 tasks para workers, mediante oferta ao usuário.
