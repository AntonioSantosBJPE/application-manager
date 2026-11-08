# Application Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, the Verifier and the screens sub-agent). Neste projeto o fechamento segue `docs/workflow.md#gates-e-tempo`: sem `check_proofs.py` nem `validate_verification.py`.

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/application/design.md`
**Status**: Approved
**Approved**: 2026-11-08 - user: "Tasks aprovadas"
**Build**: `pnpm build; pnpm typecheck; pnpm lint`
**Run api-unit**: `pnpm --filter @am/api exec vitest run --project unit --reporter=verbose`
**Run api-integration**: `pnpm --filter @am/api exec vitest run --project integration --reporter=verbose`
**Run web**: `pnpm --filter @am/web exec vitest run --reporter=verbose`
**Run e2e**: `pnpm test:e2e`

Ambiente: `nvm use 24` antes de qualquer comando, Docker rodando para os testes de integração e para o E2E, e `.env` copiado de `.env.example`.

Convenção dos testes: o nome de cada teste que prova um check começa pelo id do requisito, como `APP-05 ...`, e a linha esperada de cada proof é `✓ APP-05`. Na primeira execução real cada linha é conferida com a saída e ajustada só na forma; a afirmação do check nunca muda. Os testes usam só dados fictícios: empresas como `Empresa Fictícia Alfa`, títulos como `Vaga de Teste Pleno`, links em `https://vagas.exemplo.com/`, e skills do seed ou privadas com nomes fictícios fora do seed (`Skill Fictícia Alfa`).

Relógio: toda regra de tempo (sem retorno, adiamento, datas de evento) é provada movendo o `CLOCK` da API (`apps/api/test/clock.ts`), nunca esperando.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `docs/engineering-guidelines.md`, `docs/design/principles.md`, `docs/design/system/prumo.md`, `docs/workflow.md`, `apps/api/vitest.config.ts`, `packages/ui/vitest.config.ts`, `apps/web/vitest.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Contratos (`packages/contracts`) | unit | Cada forma válida aceita e cada limite rejeitado | `packages/contracts/src/**/*.test.ts` | `pnpm --filter @am/contracts test` |
| API: domínio (funções puras) | unit | Todos os ramos; 1:1 com os critérios; bordas de tempo dos dois lados | `apps/api/src/**/*.test.ts` | `pnpm --filter @am/api test` |
| API: HTTP, serviços, repositórios, schema, migrações | integration (Testcontainers, PG 18) | Toda rota: sucesso e cada erro da spec; isolamento entre duas contas member; concorrência com requisições paralelas; sem mock de banco | `apps/api/src/**/*.int.test.ts` | `pnpm --filter @am/api test:integration` |
| Componentes de UI (`packages/ui`) | unit (jsdom) + browser (Chromium) + storybook | Cada variante; teclado e foco no navegador; story nos dois temas | `packages/ui/src/**/*.test.tsx`, `*.browser.test.tsx`, `*.stories.tsx` | `pnpm --filter @am/ui test` |
| Web: model, BFF, componentes e rotas | unit (Testing Library, API falsa) | Cada texto e estado de tela da spec; todo ramo das funções puras | `apps/web/src/**/*.test.ts(x)` | `pnpm --filter @am/web test` |
| Jornadas, axe, teclado, larguras e capturas | e2e (Playwright + compose) | A jornada do Success Criteria, as telas em todos os estados, e as imagens `captures/*.running.png` | `tests/e2e/specs/browser/**/*.spec.ts` | `pnpm test:e2e` |
| Documentos e migrações geradas | none | build gate only | - | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks de contratos, domínio, UI e web | `pnpm lint && pnpm typecheck && pnpm test` |
| Full | Tasks com testes de integração | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration` |
| E2E | T47 | `pnpm test:e2e` (local; fora do CI) |
| Build | Fim de fase e tasks de documento | `pnpm build && pnpm typecheck && pnpm lint && pnpm test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Contratos, domínio e schema

```
T1 → T2 → T3 → T4
```

### Phase 2: API de leitura e cadastro

```
T5 → T6 → T7 → T8 → T9
```

### Phase 3: API de escrita

```
T10 → T11 → T12 → T13 → T14 → T15 → T16
```

### Phase 4: Contagem de vagas no catálogo

```
T17
```

### Phase 5: Componentes de UI

```
T18 → T19 → T20 → T21 → T22 → T23 → T24 → T25
```

### Phase 6: Base do web

```
T26 → T27 → T28 → T29 → T30
```

### Phase 7: Lista e cadastro

```
T31 → T32 → T33 → T34 → T35 → T36
```

### Phase 8: Detalhe

```
T37 → T38 → T39 → T40 → T41 → T42 → T43 → T44
```

### Phase 9: Home e catálogo do admin

```
T45 → T46
```

### Phase 10: Fechamento

```
T47 → T48
```

---

## Model Assignment

Plano de execução pedido pelo usuário: o orquestrador (Opus 5.5) não implementa; **todas as tasks são executadas por sub-agentes Sonnet 5.5 com esforço médio**, um lote por vez, em sequência, despachados por `delegate_task` no checkout principal. O orquestrador confere os gates por conta própria, lê o diff e os testes de cada lote e devolve defeitos a um worker (até 2 rodadas por lote). O Verifier e o sub-agente de telas rodam em Opus 5.5 depois da T48.

| Lote | Fases | Tasks |
| ---- | ----- | ----- |
| B1 | 1 e 2 | T1–T9 (9) |
| B2 | 3 e 4 | T10–T17 (8) |
| B3 | 5 | T18–T25 (8) |
| B4 | 6 | T26–T30 (5) |
| B5 | 7 | T31–T36 (6) |
| B6 | 8 | T37–T44 (8) |
| B7 | 9 e 10 | T45–T48 (4) |

---

## Task Breakdown

### T1: Contratos de candidaturas

**What**: Enums, corpos, query e respostas de `/applications` em zod, e `postingCount` no item do catálogo do admin.
**Where**: `packages/contracts/src/applications.ts`
**Depends on**: None
**Reuses**: `packages/contracts/src/skills.ts` (forma dos schemas e de `skillTextSchema`)
**Requirement**: APP-04, APP-17, APP-25

**Done when**:

- [x] Schemas do design (seção Contrato) exportados por `packages/contracts/src/index.ts`, com `ACTIVE_STATUSES`, `CLOSED_STATUSES` e `FUNNEL_ORDER`
- [x] Limites do spec: empresa e título 1 a 200 após aparar, local até 120, link `http`/`https` até 2048, descrição até 20 000, nota até 2 000, até 50 skills, `q` até 100; `PATCH` exige ao menos um campo e aceita `null` nos opcionais
- [x] `adminSkillSchema` ganha `postingCount` (inteiro ≥ 0) sem quebrar os testes de `skills.test.ts`
- [x] Testes unitários de cada limite aceito e recusado passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(contracts): add the applications contract`

---

### T2: Funil e sugestão de sem retorno

**What**: `funnel.ts` (posição de cada status, aba de cada um) e `ghost.ts` (`isGhostSuggested`).
**Where**: `apps/api/src/modules/applications/domain/ghost.ts`
**Depends on**: T1
**Reuses**: `ACTIVE_STATUSES`, `CLOSED_STATUSES`, `FUNNEL_ORDER` de `@am/contracts`
**Requirement**: APP-11, APP-14, APP-32, APP-33, APP-34

**Done when**:

- [x] `isGhostSuggested` verdadeiro só em `applied` e `interviewing`, com 504 h ou mais desde a atividade e adiamento nulo ou vencido; testes nas bordas 504 h − 1 min e 504 h, e no instante exato do fim do adiamento
- [x] `funnel.ts` dá a ordem `offer`, `interviewing`, `applied`, `saved`, `accepted`, `rejected`, `withdrawn`, `ghosted` e a aba de cada status
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): add the funnel and the ghost suggestion rules`

---

### T3: Texto de busca e cursor da lista

**What**: `searchTextOf`, `searchPatternOf` e o cursor opaco `{ rank, at, id }`.
**Where**: `apps/api/src/modules/applications/domain/search-text.ts`
**Depends on**: T2
**Reuses**: `apps/api/src/modules/skills/domain/cursor.ts`
**Requirement**: APP-13, APP-15, APP-17

**Done when**:

- [x] `searchTextOf("Saúde Ágil", "Pleno")` e `searchPatternOf("saude")` casam; `%`, `_` e `\` em `q` são escapados
- [x] `domain/cursor.ts` codifica e decodifica; texto que não é base64url, JSON inválido, `rank` fora de 0..7, data inválida ou id que não é uuid dão `undefined`
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): add the applications search text and cursor`

---

### T4: Schema `applications` e migração 0004

**What**: Tabelas, enums, índices e checks do design, e a migração gerada pelo `drizzle-kit`.
**Where**: `apps/api/src/modules/applications/infra/schema.ts`
**Depends on**: T3
**Reuses**: `apps/api/src/modules/skills/infra/schema.ts`, `apps/api/src/infra/database/schema.ts`
**Requirement**: APP-07

**Done when**:

- [x] `job_postings` (com `search_text`), `job_posting_skills` (com `position`), `applications` (com `ghost_snoozed_until`), `application_events`, os índices e os checks por `kind` do design
- [x] `apps/api/drizzle/0004_*.sql` gerado e aplicado pelo teste de migrações
- [x] Teste `APP-07`: nenhuma FK do schema `applications` aponta para outro schema
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add the applications schema`

---

### T5: `SkillsCatalog.describe` e `matchingIds`

**What**: Os dois métodos que o módulo `applications` pede ao catálogo.
**Where**: `apps/api/src/modules/skills/application/skills-catalog.ts`
**Depends on**: None (Phase 1 concluída)
**Reuses**: `SkillsRepository.visibleIds`, `search`
**Requirement**: APP-08, APP-13

**Done when**:

- [x] `describe(userId, ids)` devolve nome oficial, categoria e escopo das globais e das privadas do usuário, e omite as privadas alheias e os ids inexistentes
- [x] `matchingIds(userId, key)` devolve as visíveis cuja chave do nome ou de um apelido contém `key` (ex.: `nodejs` acha "Node.js" pelo apelido)
- [x] Testes de integração dos dois métodos com duas contas member passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): describe and match skills for other modules`

---

### T6: Criar candidatura

**What**: `POST /applications` com o módulo `applications` registrado no `AppModule`.
**Where**: `apps/api/src/modules/applications/application/applications.service.ts`
**Depends on**: T5
**Reuses**: `zodBody`, `@Roles`, `@CurrentUser`, `SkillsCatalog.visibleIds`, `CLOCK`
**Requirement**: APP-01, APP-02, APP-03, APP-04, APP-05, APP-06, APP-08

**Done when**:

- [x] `ApplicationsModule`, `ApplicationsRepository.insert`, `ApplicationsService.create` e `ApplicationsController.create` criados; `index.ts` exporta o módulo; rota `@Roles('member')`
- [x] Vaga, skills (com `position`) e candidatura numa transação; evento `status_changed` sem `from_status` quando o status não é `saved`; `search_text` gravado
- [x] `InvalidSkillsError` → `422` com `invalidSkillIds` para skill inexistente, alheia, repetida ou id que não é uuid
- [x] Testes `APP-01` a `APP-06` passam contra Postgres real; teste unitário `APP-08` prova que `modules/applications` só importa `modules/skills/index.ts`
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): create applications`

---

### T7: Detalhe da candidatura

**What**: `GET /applications/:id` com vaga, skills descritas, eventos e `ghostSuggested`.
**Where**: `apps/api/src/modules/applications/http/applications.controller.ts`
**Depends on**: T6
**Reuses**: `SkillsCatalog.describe`, `isGhostSuggested`
**Requirement**: APP-18, APP-19, APP-88

**Done when**:

- [x] Eventos do mais recente ao mais antigo por `occurred_at`, empate por `created_at`
- [x] `404` para id que não é uuid, inexistente ou de outra conta
- [x] Teste `APP-88`: depois que o admin promove a privada usada na vaga, o detalhe mostra a mesma skill, mesmo id, com `scope: "global"`
- [x] Testes `APP-18` e `APP-88` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): read an application with its timeline`

---

### T8: Lista: isolamento e filtros

**What**: `GET /applications` com `tab`, `status`, `level`, `workModel` e `q`.
**Where**: `apps/api/src/modules/applications/infra/applications.repository.ts`
**Depends on**: T7
**Reuses**: `searchPatternOf`, `SkillsCatalog.matchingIds`, `SkillsCatalog.describe`
**Requirement**: APP-09, APP-10, APP-11, APP-12, APP-13, APP-17

**Done when**:

- [x] Só as candidaturas da sessão; 50 por página; item com os campos de APP-10
- [x] Filtros combinados com E entre parâmetros e OU dentro de cada lista; `q` casa empresa, título ou skill (inclusive por apelido), sem acento e caixa
- [x] Testes `APP-09` a `APP-13` e `APP-17` passam com duas contas e dados variados
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): list and filter applications`

---

### T9: Lista: ordem, cursor, contadores e total

**What**: Ordem por grupo do funil e `sort`, cursor sem repetir nem pular, `counts` e `GET /applications/count`.
**Where**: `apps/api/src/modules/applications/application/applications.service.ts`
**Depends on**: T8
**Reuses**: `domain/funnel.ts`, `domain/cursor.ts`
**Requirement**: APP-14, APP-15, APP-16

**Done when**:

- [x] Ordem por posição no funil e, no grupo, `last_activity_at` desc (ou `created_at` desc com `sort=created`), desempate por id
- [x] Com 60 candidaturas, as duas páginas somam todas sem repetição, inclusive com empates de data
- [x] `counts` respeita nível, modelo e busca e ignora aba, status e cursor; `GET /applications/count` devolve `{ total }` da sessão
- [x] Testes `APP-14` a `APP-16` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): order, page and count applications`

---

### T10: Editar a vaga

**What**: `PATCH /applications/:id/job-posting`.
**Where**: `apps/api/src/modules/applications/application/applications.service.ts`
**Depends on**: None (Phase 2 concluída)
**Reuses**: `updateJobPostingRequestSchema`, `searchTextOf`
**Requirement**: APP-28, APP-29, APP-31

**Done when**:

- [x] Só os campos enviados mudam; `null` limpa `url`, `location`, `description` e `workModel`; `search_text` recalculado; `last_activity_at` igual
- [x] Corpo vazio ou inválido → `400`
- [x] Testes `APP-28`, `APP-29` e `APP-31` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): edit a job posting`

---

### T11: Substituir as skills da vaga

**What**: `PUT /applications/:id/skills`.
**Where**: `apps/api/src/modules/applications/infra/applications.repository.ts`
**Depends on**: T10
**Reuses**: `SkillsCatalog.visibleIds`, `InvalidSkillsError`
**Requirement**: APP-30, APP-31

**Done when**:

- [x] A lista enviada substitui a anterior numa transação, na ordem enviada; `last_activity_at` igual
- [x] Skill inválida → `422` sem alterar nada
- [x] Testes `APP-30` e `APP-31` (lado do `PUT`) passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): replace the skills of a job posting`

---

### T12: Mudar status

**What**: `POST /applications/:id/status` com evento e trava da candidatura.
**Where**: `apps/api/src/modules/applications/application/applications.service.ts`
**Depends on**: T11
**Reuses**: `CLOCK`, `findOwned(…, { forUpdate: true })`
**Requirement**: APP-20, APP-21, APP-22, APP-27

**Done when**:

- [x] Status diferente: muda, grava `status_changed` com `from_status`, `to_status`, nota opcional e `occurred_at` do relógio, e atualiza `last_activity_at`
- [x] Mesmo status: `200` sem evento e sem mexer na atividade
- [x] Teste `APP-21` percorre transições para frente, para trás e entre finais
- [x] Teste `APP-27`: duas mudanças paralelas geram dois eventos encadeados
- [x] Testes `APP-20` a `APP-22` e `APP-27` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): change the status of an application`

---

### T13: Etapas e notas

**What**: `POST /applications/:id/events` para `stage` e `note`.
**Where**: `apps/api/src/modules/applications/http/applications.controller.ts`
**Depends on**: T12
**Reuses**: `createEventRequestSchema`, `CLOCK`
**Requirement**: APP-23, APP-24, APP-25, APP-26

**Done when**:

- [x] `occurredAt` informado ou o relógio; mais de 5 min no futuro → `400`; `kind` `status_changed` → `400`
- [x] `last_activity_at = greatest(atual, occurred_at)`: uma etapa com data passada não move a atividade
- [x] Teste `APP-26`: nenhuma rota `PATCH` ou `DELETE` de evento existe (rota inexistente responde `404`)
- [x] Testes `APP-23` a `APP-26` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): record stages and notes`

---

### T14: Sugestão de sem retorno e adiamento

**What**: `ghostSuggested` na lista e no detalhe e `POST /applications/:id/ghost-snooze`.
**Where**: `apps/api/src/modules/applications/application/applications.service.ts`
**Depends on**: T13
**Reuses**: `isGhostSuggested`, `CLOCK`
**Requirement**: APP-32, APP-33, APP-34, APP-35

**Done when**:

- [x] Com o relógio movido: 504 h − 1 min dá `false`, 504 h dá `true`, outro status dá `false`
- [x] Adiar grava `ghost_snoozed_until = agora + 21 dias` sem evento e sem mexer na atividade; a sugestão volta quando o adiamento vence
- [x] Teste `APP-34`: avançar o relógio 60 dias e ler não muda o status
- [x] Testes `APP-32` a `APP-35` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): suggest ghosted applications and snooze the suggestion`

---

### T15: Excluir candidatura

**What**: `DELETE /applications/:id`.
**Where**: `apps/api/src/modules/applications/infra/applications.repository.ts`
**Depends on**: T14
**Reuses**: cascata do schema
**Requirement**: APP-36, APP-37

**Done when**:

- [x] `204`; nenhuma linha das quatro tabelas sobra com aqueles ids; repetir dá `404`
- [x] Testes `APP-36` e `APP-37` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): delete an application`

---

### T16: Acesso, `404` alheio e logs

**What**: Varredura de todas as rotas por sessão, papel e dono, e os eventos de log.
**Where**: `apps/api/src/modules/applications/http/applications-access.int.test.ts`
**Depends on**: T15
**Reuses**: `apps/api/src/modules/identity/http/route-access.int.test.ts`, `apps/api/src/modules/skills/http/skills-logging.int.test.ts`
**Requirement**: APP-19, APP-38, APP-39, APP-40, APP-41

**Done when**:

- [x] Cada rota de `/applications`: sem sessão `401`, admin `403`, outro member `404` sem alterar nada
- [x] O teste de arquitetura de AD-006 passa com as rotas novas
- [x] Cada escrita registra `{ event, applicationId, actorId }`; um teste com texto marcador em empresa, título, link, local, descrição e nota não acha o marcador nos logs
- [x] Testes `APP-19` e `APP-38` a `APP-41` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `test(api): cover access and logs of the applications routes`

---

### T17: Contagem de vagas no catálogo do admin

**What**: Porta `SKILL_USAGE`, `ApplicationsSkillUsage` no módulo global e `postingCount` em `GET /admin/skills`.
**Where**: `apps/api/src/modules/applications/application/applications-skill-usage.ts`
**Depends on**: None (Phase 3 concluída)
**Reuses**: `SkillsAdminService.list`, `apps/api/src/modules/skills/index.ts`
**Requirement**: APP-85, APP-86, APP-87

**Done when**:

- [x] `modules/skills/domain/skill-usage.ts` declara `SkillUsage.countFor(ids)` e `SKILL_USAGE`; `index.ts` os exporta
- [x] `ApplicationsSkillUsageModule` (`@Global`) registra a implementação; o `AppModule` o importa; `modules/skills` não importa nada de `modules/applications` (teste de arquitetura)
- [x] `SkillsAdminService.list` acrescenta `postingCount` aos itens da página; ordem, cursor e `counts` iguais; os testes existentes do catálogo passam sem edição de asserção
- [x] Testes `APP-85` (API: contagens de duas contas em duas páginas, 0 sem vagas), `APP-86` (resposta sem dono nem dado de vaga) e `APP-87` (contagem muda ao trocar skills e ao excluir) passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): count job postings per skill in the admin catalog`

---

### T18: `Dialog` de 640 px

**What**: `Dialog.Content` aceita `size="lg"`.
**Where**: `packages/ui/src/components/dialog/dialog.tsx`
**Depends on**: None (Phase 4 concluída)
**Reuses**: o próprio `Dialog`
**Requirement**: APP-57

**Done when**:

- [x] `size="lg"` dá largura máxima de 640 px; o padrão continua 440 px
- [x] Story nova; testes do componente passam sem edição dos existentes
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the large dialog size`

---

### T19: Submenus e itens de escolha no `DropdownMenu`

**What**: `Sub`, `SubTrigger`, `SubContent`, `RadioGroup` e `RadioItem`.
**Where**: `packages/ui/src/components/dropdown-menu/dropdown-menu.tsx`
**Depends on**: T18
**Reuses**: `@radix-ui/react-dropdown-menu`
**Requirement**: APP-50, APP-68

**Done when**:

- [x] Submenu abre com seta para a direita e fecha com seta para a esquerda; o item escolhido aparece marcado
- [x] Story e testes de navegador (teclado e foco) passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add submenus and radio items to the dropdown menu`

---

### T20: `ContextMenu`

**What**: Menu de clique direito com o visual e as partes do `DropdownMenu`.
**Where**: `packages/ui/src/components/context-menu/context-menu.tsx`
**Depends on**: T19
**Reuses**: estilos de `dropdown-menu.tsx`; dependência `@radix-ui/react-context-menu`
**Requirement**: APP-50

**Done when**:

- [x] Abre no clique direito e com `Shift+F10`; submenus e itens de escolha como no T19
- [x] Exportado por `packages/ui/src/index.ts`; story e testes de navegador passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the context menu`

---

### T21: `ChoiceChips`

**What**: Chips de escolha única com `role="radiogroup"`.
**Where**: `packages/ui/src/components/choice-chips/choice-chips.tsx`
**Depends on**: T20
**Reuses**: visual do `FilterChip`
**Requirement**: APP-57, APP-72

**Done when**:

- [x] Setas movem e escolhem; um clique escolhe; o escolhido tem `aria-checked="true"`; aceita estado inválido de `Field.Root`
- [x] Story e testes passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add choice chips`

---

### T22: `TagField`

**What**: Tags removíveis seguidas de um `Combobox`, numa caixa só.
**Where**: `packages/ui/src/components/tag-field/tag-field.tsx`
**Depends on**: T21
**Reuses**: `Combobox`, `SkillTag`
**Requirement**: APP-59

**Done when**:

- [x] `Backspace` com o campo vazio remove a última tag; o "×" de cada tag tem nome acessível vindo de quem chama; o foco volta ao campo
- [x] Story e testes de navegador passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the tag field`

---

### T23: `Timeline`

**What**: Lista com ícone, linha entre itens e data em `mono`.
**Where**: `packages/ui/src/components/timeline/timeline.tsx`
**Depends on**: T22
**Reuses**: `Icon`, tokens do Prumo
**Requirement**: APP-70

**Done when**:

- [x] `ol` semântico; ícone decorativo; data em `font-mono`; a linha não aparece depois do último item
- [x] Story e testes passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the timeline`

---

### T24: `InlineEdit`

**What**: Valor que vira campo ao clicar; `Enter` ou sair grava, `Esc` cancela.
**Where**: `packages/ui/src/components/inline-edit/inline-edit.tsx`
**Depends on**: T23
**Reuses**: `Field.Control`
**Requirement**: APP-68

**Done when**:

- [x] O botão de exibição tem nome acessível vindo de quem chama; `Esc` devolve o valor anterior e o foco ao botão; gravar chama `onCommit` uma vez
- [x] Story e testes de navegador passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add inline edit`

---

### T25: Ação no cabeçalho de grupo do `ListPage`

**What**: `ListPage.Group` aceita `action`.
**Where**: `packages/ui/src/layouts/list-page/list-page.tsx`
**Depends on**: T24
**Reuses**: o próprio `ListPage`
**Requirement**: APP-45

**Done when**:

- [x] Com `action`, o cabeçalho é um `div` com o `h2` e a ação à direita; o nome do `h2` não inclui a ação; sem `action`, o HTML é o de hoje
- [x] Story e testes passam sem edição dos existentes
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add an action to list page groups`

---

### T26: Server functions de candidaturas

**What**: Uma server function por rota de `/applications`.
**Where**: `apps/web/src/features/applications/api/server-functions.ts`
**Depends on**: None (Phase 5 concluída)
**Reuses**: `apps/web/src/features/skills/api/server-functions.ts`, `lib/bff.ts`, `lib/call-api.ts`
**Requirement**: APP-42, APP-66

**Done when**:

- [x] Dez funções (tabela de rotas do design), cada uma validando a resposta pelo contrato; `2xx` fora do contrato vira `503`
- [x] Testes do caminho, método, query e corpo de cada função passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the applications server functions`

---

### T27: Server functions de busca e criação de skill

**What**: `searchSkills` e `createSkill` na feature `skills`.
**Where**: `apps/web/src/features/skills/api/server-functions.ts`
**Depends on**: T26
**Reuses**: as funções do admin no mesmo arquivo
**Requirement**: APP-59, APP-60

**Done when**:

- [x] `GET /skills?q=` e `POST /skills` com resposta validada; exportadas por `features/skills/index.ts`
- [x] Testes passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add skill search and creation for members`

---

### T28: Rótulos e filtros da URL

**What**: `model/labels.ts` e `model/filters.ts`.
**Where**: `apps/web/src/features/applications/model/filters.ts`
**Depends on**: T27
**Reuses**: `apps/web/src/features/skills/model/filters.ts`
**Requirement**: APP-44, APP-46

**Done when**:

- [x] Rótulos singular e plural dos oito status, níveis, modelos e etapas como no spec
- [x] `parseApplicationsSearch` ignora valor desconhecido; `searchOf` omite o padrão; `new=1` sobrevive ao parse
- [x] Testes passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add application labels and URL filters`

---

### T29: Grupos, datas e textos derivados

**What**: `groups.ts`, `dates.ts`, `ghost-message.ts` e `stage-date.ts`.
**Where**: `apps/web/src/features/applications/model/dates.ts`
**Depends on**: T28
**Reuses**: `counts.byStatus` do contrato
**Requirement**: APP-44, APP-45, APP-70, APP-72, APP-80

**Done when**:

- [x] `relativeDays`: "hoje" abaixo de 24 h, "há N d" acima, em `America/Sao_Paulo`, com `now` injetado; `shortDate` dá "20 out"
- [x] `groups` corta a lista na ordem recebida e usa o número de `counts.byStatus`
- [x] Texto do Alert em Enviada e em Em entrevistas como no spec; data de etapa de hoje vira o `now`, outro dia vira 12:00 de São Paulo
- [x] Testes passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): derive groups, dates and the ghost message`

---

### T30: `SkillsField`

**What**: Campo de skills com sugestão, criação de privada com categoria e troca entre obrigatórias e desejáveis.
**Where**: `apps/web/src/features/skills/components/SkillsField.tsx`
**Depends on**: T29
**Reuses**: `TagField`, `Combobox`, `SkillTag`, `model/categories.ts`
**Requirement**: APP-59, APP-60, APP-61

**Done when**:

- [x] Sugestões com nome oficial e categoria e a dica "Busque por nome ou apelido: “node”, “nodejs” e “Node.js” são a mesma skill."
- [x] "Criar “{texto}” como skill privada" só quando o texto não é o nome oficial de uma sugestão; abre as sete categorias; a tag nova tem a marca de privada
- [x] Skill já no outro campo é movida, sem repetir
- [x] Testes `APP-59` a `APP-61` passam
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the skills field`

---

### T31: Linha da lista

**What**: `ApplicationRow` com status, empresa, título, "sem retorno?", duas skills, nível, modelo e atividade.
**Where**: `apps/web/src/features/applications/components/ApplicationRow.tsx`
**Depends on**: None (Phase 6 concluída)
**Reuses**: `ListPage.Row`, `PipelineStatus` `iconOnly`, `SkillTag`
**Requirement**: APP-44, APP-56

**Done when**:

- [ ] Duas obrigatórias na ordem recebida ou, sem elas, duas desejáveis; modelo ausente "—"
- [ ] Abaixo de `md` só status, empresa, título e atividade
- [ ] Teste `APP-44` passa
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the application row`

---

### T32: Lista: topbar, grupos e estados

**What**: `ApplicationsList` com título e total, grupos com "+", "Carregar mais", vazio, filtros sem resultado e erro.
**Where**: `apps/web/src/features/applications/components/ApplicationsList.tsx`
**Depends on**: T31
**Reuses**: `ListPage`, `EmptyState`, `Alert`, `apps/web/src/features/skills/components/SkillsCatalog.tsx`
**Requirement**: APP-42, APP-45, APP-51, APP-52, APP-53, APP-54

**Done when**:

- [ ] Textos da carta e do spec: "Candidaturas", "Nova candidatura" com `C`, "Ativas", "Encerradas", "Nível", "Modelo", "Filtro", "Empresa, título ou skill", "Nenhuma candidatura ainda.", "Nenhuma candidatura com esses filtros.", "Limpar filtros", "Não foi possível carregar as candidaturas.", "Tentar de novo"
- [ ] Botão "+" de cada grupo com nome "Nova candidatura em {status}"
- [ ] Testes `APP-42` (composição), `APP-45` e `APP-51` a `APP-54` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the applications list`

---

### T33: Filtros, busca e ordenação na URL

**What**: Chips, menus de Nível, Modelo e Filtro, busca com 300 ms e botão de ordenação.
**Where**: `apps/web/src/features/applications/components/ApplicationsFilters.tsx`
**Depends on**: T32
**Reuses**: `FilterChip`, `DropdownMenu`, `SearchInput`, `model/filters.ts`
**Requirement**: APP-46, APP-47, APP-48

**Done when**:

- [ ] Cada controle grava na URL e a lista recarrega; recarregar mantém
- [ ] "Filtro" mostra só os quatro status da aba; trocar de aba limpa `status`
- [ ] Ordenação alterna "Última atividade" e "Cadastro"
- [ ] Testes `APP-46` a `APP-48` passam (debounce com relógio falso)
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): filter, search and sort applications`

---

### T34: Menu da linha

**What**: Botão "⋯" "Ações de {empresa}" e clique direito com "Status" e "Nível".
**Where**: `apps/web/src/features/applications/components/RowActions.tsx`
**Depends on**: T33
**Reuses**: `DropdownMenu` (T19), `ContextMenu` (T20)
**Requirement**: APP-50, APP-55

**Done when**:

- [ ] Escolher grava; a linha muda de grupo ou sai da aba e os números se atualizam pela resposta da API
- [ ] Falha mantém a linha e mostra o `Alert` `danger`
- [ ] Testes `APP-50` e `APP-55` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): change status and level from the row`

---

### T35: Diálogo de cadastro

**What**: `ApplicationFormDialog` no modo de criação.
**Where**: `apps/web/src/features/applications/components/ApplicationFormDialog.tsx`
**Depends on**: T34
**Reuses**: `Dialog` `size="lg"`, `ChoiceChips`, `Field`, `SkillsField`, `Kbd`, `Alert`
**Requirement**: APP-57, APP-58, APP-62, APP-63, APP-64, APP-65

**Done when**:

- [ ] Campos e textos da carta `PageNewApplication`; "Entra como {status}." conforme o "+" usado
- [ ] `⌘↵`/`Ctrl+↵` cria; botão desabilitado durante a requisição; erros locais abaixo do campo; falha da API mantém o que foi digitado
- [ ] "Cancelar", `Esc` e "esc" fecham sem gravar
- [ ] Testes `APP-57` (composição), `APP-58` e `APP-62` a `APP-65` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the new application dialog`

---

### T36: Rota `/applications` e sidebar

**What**: Rota com loader e `validateSearch`, atalho `C`, clique na linha e o item "Candidaturas" com total.
**Where**: `apps/web/src/routes/_member/applications/index.tsx`
**Depends on**: T35
**Reuses**: `apps/web/src/routes/admin/_protected/skills.tsx`, `apps/web/src/routes/_member.tsx`
**Requirement**: APP-43, APP-49, APP-57, APP-83

**Done when**:

- [ ] `C` fora de um campo abre o diálogo; `new=1` abre o diálogo ao carregar e sai da URL ao fechar
- [ ] Clique na linha abre `/applications/$id`
- [ ] Sidebar: "Candidaturas" depois de "Início", total em `mono`, `aria-current="page"` na lista e no detalhe
- [ ] Testes `APP-43` e `APP-49` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the applications route and sidebar item`

---

### T37: Detalhe: conteúdo, descrição e não encontrada

**What**: `ApplicationDetail` com breadcrumb, "Abrir vaga", empresa e título, seções, sidebar e "Candidatura não encontrada.".
**Where**: `apps/web/src/features/applications/components/ApplicationDetail.tsx`
**Depends on**: None (Phase 7 concluída)
**Reuses**: `DetailPage`, `AppShell.Topbar`
**Requirement**: APP-66, APP-67, APP-76, APP-77, APP-79

**Done when**:

- [ ] Textos da carta `PageApplicationDetail` sem a seção "Currículo" (AD-017)
- [ ] "Abrir vaga" só com link, nova aba, `rel="noopener noreferrer"`
- [ ] Descrição com seis linhas e "Ver texto completo"; seção ausente sem descrição
- [ ] Testes `APP-66` (composição), `APP-67`, `APP-76` e `APP-77` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the application detail`

---

### T38: Propriedades editáveis

**What**: Status, Nível e Modelo por menu; Local e Vaga por `InlineEdit`; Cadastrada e Atividade só leitura.
**Where**: `apps/web/src/features/applications/components/PropertiesSidebar.tsx`
**Depends on**: T37
**Reuses**: `DropdownMenu`, `InlineEdit`, `PipelineStatus`
**Requirement**: APP-68, APP-78

**Done when**:

- [ ] Cada escolha chama a server function certa; Modelo oferece "—"; `Enter`/sair grava e `Esc` cancela
- [ ] Falha mantém o valor e mostra o `Alert` `danger`
- [ ] Testes `APP-68` e `APP-78` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): edit application properties in place`

---

### T39: Linha do tempo e nota

**What**: `ApplicationTimeline` e `NoteComposer`.
**Where**: `apps/web/src/features/applications/components/ApplicationTimeline.tsx`
**Depends on**: T38
**Reuses**: `Timeline`, `Field.Textarea`, `PipelineStatus`, `model/dates.ts`
**Requirement**: APP-69, APP-70, APP-71

**Done when**:

- [ ] "Status {de} → {para}", "Status → {para}", "Etapa {tipo}" e "· {nota}", "Nota · {nota}" e "Vaga cadastrada" por último
- [ ] "Adicionar nota" aparece com texto; `⌘↵`/`Ctrl+↵` grava, limpa e põe a nota no topo
- [ ] Testes `APP-69` a `APP-71` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): show the timeline and add notes`

---

### T40: Diálogo de etapa

**What**: "+ Etapa" com tipo, data e nota.
**Where**: `apps/web/src/features/applications/components/StageDialog.tsx`
**Depends on**: T39
**Reuses**: `Dialog`, `ChoiceChips`, `Field`, `model/stage-date.ts`
**Requirement**: APP-72

**Done when**:

- [ ] Tipos "Triagem", "RH", "Técnica", "Case", "Outra"; data padrão hoje e sem futuro; nota opcional
- [ ] A etapa entra na posição da sua data
- [ ] Teste `APP-72` passa
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): record a stage`

---

### T41: Skills da vaga no detalhe

**What**: "Obrigatórias" e "Desejáveis" com "×" por tag e "+ Skill".
**Where**: `apps/web/src/features/applications/components/SkillsSection.tsx`
**Depends on**: T40
**Reuses**: `SkillsField`, `SkillTag`
**Requirement**: APP-73

**Done when**:

- [ ] Acrescentar ou remover grava a lista inteira pelo `PUT`
- [ ] Teste `APP-73` passa
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): edit the skills of a job posting`

---

### T42: Editar vaga e excluir

**What**: Menu "⋯" da topbar, diálogo no modo de edição e `ConfirmDialog` de exclusão.
**Where**: `apps/web/src/features/applications/components/DetailActions.tsx`
**Depends on**: T41
**Reuses**: `ApplicationFormDialog`, `ConfirmDialog`, `DropdownMenu`
**Requirement**: APP-74, APP-75

**Done when**:

- [ ] "Editar vaga" abre o diálogo preenchido, título "Editar vaga", sem "Entra como", botão "Salvar"; grava pelo `PATCH` e pelo `PUT`
- [ ] "Excluir candidatura?" com "Excluir" em `danger`; confirmar exclui e abre `/applications`
- [ ] Testes `APP-74` e `APP-75` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): edit and delete an application`

---

### T43: Alert de sem retorno

**What**: `GhostAlert` com "Ainda não" e "Marcar sem retorno".
**Where**: `apps/web/src/features/applications/components/GhostAlert.tsx`
**Depends on**: T42
**Reuses**: `Alert`, `model/ghost-message.ts`
**Requirement**: APP-80, APP-81, APP-82

**Done when**:

- [ ] Aparece só com `ghostSuggested`; "Atividade" em `warning` junto
- [ ] "Marcar sem retorno" muda o status; "Ainda não" chama o adiamento; os dois escondem o Alert
- [ ] Testes `APP-80` a `APP-82` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): suggest marking an application as ghosted`

---

### T44: Rota `/applications/$id`

**What**: Rota do detalhe com loader, `404` e sessão expirada.
**Where**: `apps/web/src/routes/_member/applications/$id.tsx`
**Depends on**: T43
**Reuses**: `useExpiredSessionRedirect`
**Requirement**: APP-66, APP-77

**Done when**:

- [ ] Loader busca o detalhe e o `now`; `404` renderiza "Candidatura não encontrada."
- [ ] Teste de rota passa
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the application detail route`

---

### T45: Passo 03 da home

**What**: "Nova candidatura" no passo 03 e "Concluído" com uma candidatura.
**Where**: `apps/web/src/routes/_member/index.tsx`
**Depends on**: None (Phase 8 concluída)
**Reuses**: total de `GET /applications/count` do layout
**Requirement**: APP-83, APP-84

**Done when**:

- [ ] O botão abre `/applications?new=1`
- [ ] Testes `APP-83` e `APP-84` passam
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): link the home step to a new application`

---

### T46: "N vagas" na linha do catálogo

**What**: `SkillRow` mostra "0 vagas", "1 vaga" ou "{N} vagas".
**Where**: `apps/web/src/features/skills/components/SkillRow.tsx`
**Depends on**: T45
**Reuses**: o próprio `SkillRow`
**Requirement**: APP-85

**Done when**:

- [ ] Número em `font-mono`, alinhado como coluna; testes existentes de `SkillRow` passam sem edição de asserção
- [ ] Teste `APP-85` (web) passa
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): show how many job postings use each skill`

---

### T47: E2E de candidaturas e imagens das telas

**What**: Jornada no navegador contra a stack, axe, teclado, larguras e as imagens `captures/*.running.png`.
**Where**: `tests/e2e/specs/browser/applications.spec.ts`
**Depends on**: None (Phase 9 concluída)
**Reuses**: `tests/e2e/specs/browser/skills.spec.ts`, `tests/e2e/support/identity.ts`
**Requirement**: APP-42, APP-56, APP-57, APP-66, APP-79

**Done when**:

- [ ] Jornada do Success Criteria: cadastrar com quatro skills (uma privada nova) só pelo teclado, mudar status pela lista, registrar etapa e nota no detalhe, excluir
- [ ] Teste `APP-56` e `APP-79`: sem rolagem horizontal a 375 px e 1280 px na lista e no detalhe
- [ ] Axe nos dois temas na lista, vazio, menu da linha, diálogo, detalhe, Alert de sem retorno, diálogo de etapa e confirmação de exclusão
- [ ] `PageApplications.running.png`, `PageNewApplication.running.png` e `PageApplicationDetail.running.png` salvas em `.specs/features/application/captures/` a 1280 × 800, com dados fictícios equivalentes aos da carta
- [ ] Gate check passes: `pnpm test:e2e`

**Tests**: e2e
**Gate**: e2e

**Commit**: `test(e2e): cover applications`

---

### T48: Documentos

**What**: `.design`, guia de teste manual e páginas do design refletem a feature.
**Where**: `.design/application-manager.md`
**Depends on**: T47
**Reuses**: `docs/guia-teste-manual.md`, `docs/design/principles.md`
**Requirement**: APP-35, APP-85

**Done when**:

- [ ] Seção Application lista as rotas e colunas acrescentadas (`ghost-snooze`, `count`, `position`, `search_text`, `ghost_snoozed_until`) e passa a "done"; seção Skill registra `postingCount`
- [ ] `docs/guia-teste-manual.md` ensina o cadastro e a sugestão de sem retorno; `docs/design/principles.md` move `PageApplications`, `PageNewApplication` e `PageApplicationDetail` para as páginas atuais
- [ ] Gate check passes: `pnpm build && pnpm typecheck && pnpm lint && pnpm test`

**Tests**: none
**Gate**: build

**Commit**: `docs: record the applications feature`

---

## Checks

**C1** - WHEN um member envia `POST /applications` válido THEN a API SHALL gravar a vaga, as skills da vaga e a candidatura numa transação e responder `201` com a candidatura, `status` `saved` e `lastActivityAt` igual à data de cadastro. (APP-01, AC 1)
Proof: run api-integration | ✓ APP-01

**C2** - WHEN o corpo traz `status` THEN a API SHALL criar a candidatura nesse status e gravar um evento `status_changed` sem `from_status`, com `to_status` igual ao informado. (APP-02, AC 2)
Proof: run api-integration | ✓ APP-02

**C3** - WHEN o corpo traz `skills` vazio ou não traz `skills` THEN a API SHALL criar a candidatura sem skills e responder `201`. (APP-03, AC 3)
Proof: run api-integration | ✓ APP-03

**C4** - IF empresa ou título estão vazios ou passam de 200 caracteres, o link não é `http`/`https` ou passa de 2048, a descrição passa de 20 000, o local passa de 120, `level`, `workModel`, `status` ou `requirement` estão fora do enum, ou há mais de 50 skills THEN a API SHALL responder `400` em Problem Details com o campo inválido, sem gravar nada. (APP-04, AC 4)
Proof: run api-integration | ✓ APP-04

**C5** - IF uma skill não existe, é privada de outra pessoa, aparece duas vezes ou tem id que não é uuid THEN a API SHALL responder `422` em Problem Details com os ids recusados, sem gravar nada. (APP-05, AC 5)
Proof: run api-integration | ✓ APP-05

**C6** - The API SHALL take the owner only from the session and SHALL ignore any `userId` sent by the client. (APP-06, AC 6)
Proof: run api-integration | ✓ APP-06

**C7** - The `applications` schema SHALL hold no foreign key to any other schema. (APP-07, AC 7)
Proof: run api-integration | ✓ APP-07

**C8** - The applications module SHALL validate and describe skills only through the public API of the skills module. (APP-08, AC 8)
Proof: run api-unit | ✓ APP-08

**C9** - WHEN um member chama `GET /applications` THEN a API SHALL responder `200` com `{ items, nextCursor, counts }`, só com as candidaturas dele, 50 por página. (APP-09, AC 1)
Proof: run api-integration | ✓ APP-09

**C10** - The list item SHALL carry `id`, `status`, `company`, `title`, `level`, `workModel`, the job posting skills with `id`, `name`, `scope` and `requirement`, `createdAt`, `lastActivityAt` and `ghostSuggested`. (APP-10, AC 2)
Proof: run api-integration | ✓ APP-10

**C11** - WHEN `tab=active` ou ausente THEN a lista SHALL trazer só Salva, Enviada, Em entrevistas e Proposta, e WHEN `tab=closed` THEN só Aceita, Recusada, Desisti e Sem retorno. (APP-11, AC 3)
Proof: run api-integration | ✓ APP-11

**C12** - WHEN `status`, `level` ou `workModel` trazem um ou mais valores separados por vírgula THEN a lista SHALL trazer só as candidaturas com um desses valores em cada parâmetro informado. (APP-12, AC 4)
Proof: run api-integration | ✓ APP-12

**C13** - WHEN `q` é informado THEN a lista SHALL trazer só as candidaturas cuja empresa ou título contém `q` sem diferença de acento e caixa, ou que têm uma skill cujo nome ou apelido contém a chave normalizada de `q`. (APP-13, AC 5)
Proof: run api-integration | ✓ APP-13

**C14** - The list SHALL order items by status group in funnel order (`offer`, `interviewing`, `applied`, `saved`, then `accepted`, `rejected`, `withdrawn`, `ghosted`) and inside a group by `lastActivityAt` descending, or by `createdAt` descending WHEN `sort=created`. (APP-14, AC 6)
Proof: run api-integration | ✓ APP-14

**C15** - WHEN há mais itens THEN `nextCursor` SHALL trazer um cursor que, enviado em `cursor`, devolve a página seguinte sem repetir nem pular itens. (APP-15, AC 7)
Proof: run api-integration | ✓ APP-15

**C16** - The `counts` object SHALL hold `active`, `closed` and the count of each status for the user's applications matching `level`, `workModel` and `q`, ignoring `tab`, `status` and the cursor. (APP-16, AC 8)
Proof: run api-integration | ✓ APP-16

**C17** - IF um parâmetro tem valor fora do enum, `q` passa de 100 caracteres ou o cursor é inválido THEN a API SHALL responder `400` em Problem Details. (APP-17, AC 9)
Proof: run api-integration | ✓ APP-17

**C18** - WHEN um member chama `GET /applications/:id` de uma candidatura dele THEN a API SHALL responder `200` com a vaga completa, as skills, o status, `createdAt`, `lastActivityAt`, `ghostSuggested` e `events` do mais recente ao mais antigo. (APP-18, AC 1)
Proof: run api-integration | ✓ APP-18

**C19** - IF `:id` não é uuid, não existe ou é de outra pessoa THEN `GET`, `PATCH`, `PUT`, `POST` e `DELETE` em `/applications/:id` e sub-rotas SHALL responder `404` em Problem Details, sem alterar nada. (APP-19, AC 2)
Proof: run api-integration | ✓ APP-19

**C20** - WHEN o member envia `POST /applications/:id/status` com um status diferente do atual THEN a API SHALL mudar o status, gravar um evento `status_changed` com `from_status`, `to_status`, a nota opcional e `occurred_at` agora, atualizar `last_activity_at` e responder `200`. (APP-20, AC 3)
Proof: run api-integration | ✓ APP-20

**C21** - The API SHALL accept a change from any status to any other status. (APP-21, AC 4)
Proof: run api-integration | ✓ APP-21

**C22** - WHEN o status enviado é igual ao atual THEN a API SHALL responder `200` sem gravar evento e sem mudar `last_activity_at`. (APP-22, AC 5)
Proof: run api-integration | ✓ APP-22

**C23** - WHEN o member envia `POST /applications/:id/events` com `kind` `stage` (com `stage`) ou `note` (com `note`) THEN a API SHALL gravar o evento com o `occurredAt` informado ou agora, e responder `201`. (APP-23, AC 6)
Proof: run api-integration | ✓ APP-23

**C24** - WHEN um evento é gravado THEN `last_activity_at` SHALL passar a ser o maior entre o valor anterior e o `occurred_at` do evento. (APP-24, AC 7)
Proof: run api-integration | ✓ APP-24

**C25** - IF `kind` é `status_changed`, `stage` falta ou está fora do enum num evento `stage`, `note` falta num evento `note`, a nota passa de 2 000 caracteres ou `occurredAt` está mais de 5 min no futuro THEN a API SHALL responder `400` em Problem Details, sem gravar nada. (APP-25, AC 8)
Proof: run api-integration | ✓ APP-25

**C26** - The API SHALL offer no route that edits or deletes an event. (APP-26, AC 9)
Proof: run api-integration | ✓ APP-26

**C27** - WHEN duas mudanças de status chegam ao mesmo tempo THEN a API SHALL gravar os dois eventos em sequência, o `from_status` de cada um igual ao status que encontrou. (APP-27, AC 10)
Proof: run api-integration | ✓ APP-27

**C28** - WHEN o member envia `PATCH /applications/:id/job-posting` com um ou mais campos da vaga THEN a API SHALL alterar só esses campos e responder `200` com a candidatura, sem mudar `last_activity_at`. (APP-28, AC 1)
Proof: run api-integration | ✓ APP-28

**C29** - WHEN o PATCH traz `url`, `location`, `description` ou `workModel` como `null` THEN a API SHALL limpar o campo. (APP-29, AC 2)
Proof: run api-integration | ✓ APP-29

**C30** - WHEN o member envia `PUT /applications/:id/skills` THEN a API SHALL substituir todas as skills da vaga pela lista enviada, na ordem enviada, e responder `200`, sem mudar `last_activity_at`. (APP-30, AC 3)
Proof: run api-integration | ✓ APP-30

**C31** - IF o PATCH vem vazio ou com campo inválido, ou o PUT tem skill inválida THEN a API SHALL responder `400` ou `422` com as mesmas regras do cadastro, sem alterar nada. (APP-31, AC 4)
Proof: run api-integration | ✓ APP-31

**C32** - WHILE o status é `applied` ou `interviewing`, passaram 504 horas ou mais desde `last_activity_at` e `ghost_snoozed_until` é nulo ou já passou, a API SHALL devolver `ghostSuggested: true` na lista e no detalhe. (APP-32, AC 1)
Proof: run api-integration | ✓ APP-32

**C33** - WHEN passaram menos de 504 horas, o status é outro ou o adiamento está em vigor THEN a API SHALL devolver `ghostSuggested: false`. (APP-33, AC 2)
Proof: run api-integration | ✓ APP-33

**C34** - The API SHALL never change a status because of time alone. (APP-34, AC 3)
Proof: run api-integration | ✓ APP-34

**C35** - WHEN o member envia `POST /applications/:id/ghost-snooze` THEN a API SHALL gravar `ghost_snoozed_until` igual a agora mais 21 dias, sem evento e sem mudar `last_activity_at`, e responder `200` com `ghostSuggested: false`. (APP-35, AC 4)
Proof: run api-integration | ✓ APP-35

**C36** - WHEN o member envia `DELETE /applications/:id` THEN a API SHALL apagar vaga, skills da vaga, candidatura e eventos numa transação e responder `204`. (APP-36, AC 1)
Proof: run api-integration | ✓ APP-36

**C37** - WHEN a mesma candidatura é excluída de novo THEN a API SHALL responder `404`. (APP-37, AC 2)
Proof: run api-integration | ✓ APP-37

**C38** - IF a sessão é de um admin THEN toda rota de `/applications` SHALL responder `403` em Problem Details, sem alterar nada. (APP-38, AC 1)
Proof: run api-integration | ✓ APP-38

**C39** - IF não há sessão THEN toda rota de `/applications` SHALL responder `401`. (APP-39, AC 2)
Proof: run api-integration | ✓ APP-39

**C40** - The applications routes SHALL declare their access, so that the route architecture test of AD-006 covers them. (APP-40, AC 3)
Proof: run api-integration | ✓ APP-40

**C41** - WHEN uma escrita de candidatura acontece THEN a API SHALL registrar um log com o id da candidatura e a ação, sem empresa, título, link, local, descrição ou nota. (APP-41, AC 4)
Proof: run api-integration | ✓ APP-41

**C42** - WHEN o member abre `/applications` THEN o web SHALL mostrar a tela em `.specs/features/application/captures/PageApplications.png`: o título "Candidaturas" com o total em `mono`, o botão de ordenação, "Nova candidatura" com `C`, os chips "Ativas" e "Encerradas" com seus números, "Nível", "Modelo", "Filtro", a busca "Empresa, título ou skill" e os grupos por status. (APP-42, AC 1)
Proof: browser captures/PageApplications.running.png

**C43** - WHILE o member está em `/applications` ou `/applications/$id` a sidebar SHALL mostrar "Candidaturas" com o total em `mono` e `aria-current="page"`, logo depois de "Início". (APP-43, AC 2)
Proof: run web | ✓ APP-43

**C44** - The row SHALL show the status icon with the status label as its accessible name, the company, the title, "sem retorno?" in `warning` when `ghostSuggested`, two skills, the level label, the work model label or "—", and the last activity as "hoje" or "há N d". (APP-44, AC 3)
Proof: run web | ✓ APP-44

**C45** - The group header SHALL show the status icon, the plural label, the group count and a "+" button named "Nova candidatura em {status}". (APP-45, AC 4)
Proof: run web | ✓ APP-45

**C46** - WHEN o member usa "Ativas", "Encerradas", um item de "Nível", "Modelo" ou "Filtro", ou digita na busca THEN o web SHALL listar só o que casa e gravar `tab`, `level`, `workModel`, `status` e `q` na URL, mantendo-os ao recarregar; a busca SHALL atualizar 300 ms depois da última tecla. (APP-46, AC 5)
Proof: run web | ✓ APP-46

**C47** - WHEN o member abre "Filtro" THEN o web SHALL oferecer só os quatro status da aba atual, com seleção múltipla, e WHEN troca de aba THEN o web SHALL limpar o filtro de status. (APP-47, AC 6)
Proof: run web | ✓ APP-47

**C48** - WHEN o member usa o botão de ordenação THEN o web SHALL alternar entre "Última atividade" e "Cadastro" e gravar `sort` na URL. (APP-48, AC 7)
Proof: run web | ✓ APP-48

**C49** - WHEN o member clica numa linha THEN o web SHALL abrir `/applications/$id`. (APP-49, AC 8)
Proof: run web | ✓ APP-49

**C50** - WHEN o member usa o botão "⋯" de uma linha, com o nome "Ações de {empresa}", ou clica com o botão direito nela THEN o web SHALL abrir um menu com os submenus "Status" (oito status) e "Nível" (cinco níveis), e WHEN escolhe um item THEN o web SHALL gravar a mudança e mostrar a linha no novo grupo ou fora da aba, com os números atualizados. (APP-50, AC 9)
Proof: run web | ✓ APP-50

**C51** - WHEN há próxima página THEN o web SHALL mostrar "Carregar mais", que acrescenta a página seguinte aos grupos. (APP-51, AC 10)
Proof: run web | ✓ APP-51

**C52** - WHEN o member não tem nenhuma candidatura THEN o web SHALL mostrar um `EmptyState` com "Nenhuma candidatura ainda." e o botão "Nova candidatura". (APP-52, AC 11)
Proof: run web | ✓ APP-52

**C53** - WHEN os filtros não casam com nada THEN o web SHALL mostrar "Nenhuma candidatura com esses filtros." e o botão "Limpar filtros", que remove tudo menos a aba. (APP-53, AC 12)
Proof: run web | ✓ APP-53

**C54** - IF a lista não carrega THEN o web SHALL mostrar um `Alert` `danger` "Não foi possível carregar as candidaturas." com "Tentar de novo". (APP-54, AC 13)
Proof: run web | ✓ APP-54

**C55** - IF uma mudança pelo menu falha THEN o web SHALL manter a linha como estava e mostrar um `Alert` `danger` com a mensagem do erro. (APP-55, AC 14)
Proof: run web | ✓ APP-55

**C56** - WHEN a janela tem 375 px THEN a linha SHALL mostrar só status, empresa, título e última atividade, sem rolagem horizontal da página. (APP-56, AC 15)
Proof: run e2e | ✓ APP-56

**C57** - WHEN o member usa "Nova candidatura" ou tecla `C` fora de um campo THEN o web SHALL abrir o diálogo em `.specs/features/application/captures/PageNewApplication.png`: "Empresa" e "Título" lado a lado, "Link da vaga · opcional", "Nível" e "Modelo" como chips de escolha única, "Skills obrigatórias", "Skills desejáveis", "Descrição · opcional, cole o texto da vaga", "Entra como Salva." com `⌘↵` "para criar", "Cancelar" e "Criar candidatura". (APP-57, AC 1)
Proof: browser captures/PageNewApplication.running.png

**C58** - WHEN o member usa o "+" de um grupo THEN o diálogo SHALL abrir com aquele status e o rodapé SHALL dizer "Entra como {status}.". (APP-58, AC 2)
Proof: run web | ✓ APP-58

**C59** - WHEN o member digita num campo de skills THEN o web SHALL mostrar as skills que casam por nome ou apelido, com o nome oficial e a categoria, e o texto "Busque por nome ou apelido: “node”, “nodejs” e “Node.js” são a mesma skill."; WHEN escolhe uma THEN ela SHALL virar uma tag removível com o nome oficial. (APP-59, AC 3)
Proof: run web | ✓ APP-59

**C60** - WHEN o texto digitado não é o nome oficial de nenhuma sugestão THEN o menu SHALL oferecer "Criar “{texto}” como skill privada", e WHEN o member o escolhe THEN o menu SHALL mostrar as sete categorias, e WHEN escolhe uma THEN o web SHALL criar a skill e acrescentá-la como tag com a marca de privada. (APP-60, AC 4)
Proof: run web | ✓ APP-60

**C61** - IF a skill escolhida já está no outro campo de skills THEN o web SHALL movê-la para o campo atual, sem repetir. (APP-61, AC 5)
Proof: run web | ✓ APP-61

**C62** - WHEN o member usa "Criar candidatura" ou `⌘↵`/`Ctrl+↵` com empresa, título e nível preenchidos THEN o web SHALL criar a candidatura, fechar o diálogo e mostrar a nova linha no seu grupo; o botão SHALL ficar desabilitado enquanto a requisição corre. (APP-62, AC 6)
Proof: run web | ✓ APP-62

**C63** - IF empresa, título ou nível faltam, ou o link não começa com `http://` ou `https://` THEN o web SHALL não enviar e SHALL mostrar o erro abaixo do campo. (APP-63, AC 7)
Proof: run web | ✓ APP-63

**C64** - IF a API recusa o cadastro THEN o diálogo SHALL continuar aberto com o que foi digitado e um `Alert` `danger` com a mensagem. (APP-64, AC 8)
Proof: run web | ✓ APP-64

**C65** - WHEN o member usa "Cancelar", `Esc` ou o "esc" do cabeçalho THEN o web SHALL fechar o diálogo sem gravar. (APP-65, AC 9)
Proof: run web | ✓ APP-65

**C66** - WHEN o member abre `/applications/$id` THEN o web SHALL mostrar a tela em `.specs/features/application/captures/PageApplicationDetail.png`, sem a seção "Currículo": breadcrumb "Candidaturas › {empresa}", empresa e título, "Skills da vaga" com "Obrigatórias" e "Desejáveis", "Linha do tempo" com "+ Etapa" e o campo "Adicionar nota…", e a sidebar com "Status", "Nível", "Modelo", "Local", "Vaga", "Cadastrada", "Atividade", "Descrição da vaga" e "Excluir candidatura". (APP-66, AC 1)
Proof: browser captures/PageApplicationDetail.running.png

**C67** - WHEN a vaga tem link THEN a topbar SHALL mostrar o botão "Abrir vaga", que abre o link numa nova aba com `rel="noopener noreferrer"`, e WHEN não tem THEN o botão SHALL não aparecer. (APP-67, AC 2)
Proof: run web | ✓ APP-67

**C68** - WHEN o member usa "Status", "Nível" ou "Modelo" na sidebar THEN o web SHALL abrir um menu com as opções (em Modelo, também "—") e gravar a escolhida; WHEN usa "Local" ou "Vaga" THEN o web SHALL mostrar um campo no lugar que grava com `Enter` ou ao sair e cancela com `Esc`. (APP-68, AC 3)
Proof: run web | ✓ APP-68

**C69** - WHEN o status muda THEN a linha do tempo SHALL mostrar no topo "Status {de} → {para}" com os ícones e a data. (APP-69, AC 4)
Proof: run web | ✓ APP-69

**C70** - The timeline SHALL show each event with its date as "dd mmm": status changes as "Status {de} → {para}" (or "Status → {para}" without `from_status`), stages as "Etapa {tipo}" followed by "· {nota}" when present, notes as "Nota · {nota}", and as the last entry "Vaga cadastrada" on the creation date. (APP-70, AC 5)
Proof: run web | ✓ APP-70

**C71** - WHEN o member digita no campo de nota THEN o web SHALL mostrar "Adicionar nota", e WHEN o usa ou tecla `⌘↵`/`Ctrl+↵` THEN o web SHALL gravar a nota, limpar o campo e mostrá-la no topo da linha do tempo. (APP-71, AC 6)
Proof: run web | ✓ APP-71

**C72** - WHEN o member usa "+ Etapa" THEN o web SHALL abrir um diálogo com os tipos "Triagem", "RH", "Técnica", "Case" e "Outra", a data (padrão hoje, sem datas futuras) e a nota opcional, e WHEN confirma THEN a etapa SHALL aparecer na linha do tempo na posição da sua data. (APP-72, AC 7)
Proof: run web | ✓ APP-72

**C73** - WHEN o member usa "+ Skill" ou o "×" de uma tag THEN o web SHALL acrescentar ou remover a skill com o mesmo seletor do diálogo e gravar a lista. (APP-73, AC 8)
Proof: run web | ✓ APP-73

**C74** - WHEN o member usa "⋯" na topbar THEN o web SHALL mostrar "Editar vaga" e "Excluir candidatura", e WHEN usa "Editar vaga" THEN o web SHALL abrir o diálogo de cadastro preenchido, com o título "Editar vaga", sem a linha "Entra como", e o botão "Salvar". (APP-74, AC 9)
Proof: run web | ✓ APP-74

**C75** - WHEN o member usa "Excluir candidatura" THEN o web SHALL pedir confirmação num `ConfirmDialog` "Excluir candidatura?" com "Excluir" em `danger`, e WHEN confirma THEN o web SHALL excluir e abrir `/applications`. (APP-75, AC 10)
Proof: run web | ✓ APP-75

**C76** - WHEN a descrição passa de seis linhas THEN a sidebar SHALL mostrar as seis primeiras e "Ver texto completo", que mostra o texto todo; WHEN não há descrição THEN a seção SHALL não aparecer. (APP-76, AC 11)
Proof: run web | ✓ APP-76

**C77** - IF a candidatura não existe ou é de outra pessoa THEN o web SHALL mostrar "Candidatura não encontrada." com o link "Voltar para Candidaturas". (APP-77, AC 12)
Proof: run web | ✓ APP-77

**C78** - IF uma gravação no detalhe falha THEN o web SHALL manter o valor anterior e mostrar um `Alert` `danger` com a mensagem. (APP-78, AC 13)
Proof: run web | ✓ APP-78

**C79** - WHEN a janela tem 375 px THEN a sidebar de propriedades SHALL ficar abaixo do conteúdo, sem rolagem horizontal da página. (APP-79, AC 14)
Proof: run e2e | ✓ APP-79

**C80** - WHILE `ghostSuggested` é verdadeiro o detalhe SHALL mostrar no topo do conteúdo um `Alert` `warning` com o texto da tabela de assumptions, "Ainda não" e "Marcar sem retorno", e a data de "Atividade" em `warning`. (APP-80, AC 1)
Proof: run web | ✓ APP-80

**C81** - WHEN o member usa "Marcar sem retorno" THEN o web SHALL mudar o status para Sem retorno e esconder o `Alert`. (APP-81, AC 2)
Proof: run web | ✓ APP-81

**C82** - WHEN o member usa "Ainda não" THEN o web SHALL adiar a sugestão e esconder o `Alert` e o "sem retorno?" da linha na lista. (APP-82, AC 3)
Proof: run web | ✓ APP-82

**C83** - The member home step 03 SHALL show the button "Nova candidatura", and WHEN the member uses it THEN the web SHALL open `/applications` with the new application dialog open. (APP-83, AC 1)
Proof: run web | ✓ APP-83

**C84** - WHEN o member tem ao menos uma candidatura THEN o passo 03 SHALL aparecer como "Concluído". (APP-84, AC 2)
Proof: run web | ✓ APP-84

**C85** - WHEN o admin abre `/admin/skills` THEN cada linha SHALL mostrar "1 vaga" ou "{N} vagas" ("0 vagas" quando nenhuma), o número de vagas de todas as pessoas que têm a skill, e a lista SHALL manter a ordem alfabética, os filtros e a paginação de antes. (APP-85, AC 3)
Proof: run web | ✓ APP-85

**C86** - The admin catalog SHALL never show who owns a job posting or any posting data other than the count. (APP-86, AC 4)
Proof: run api-integration | ✓ APP-86

**C87** - WHEN uma vaga ganha, perde ou é excluída com uma skill THEN a contagem dessa skill SHALL mudar na leitura seguinte do catálogo. (APP-87, AC 5)
Proof: run api-integration | ✓ APP-87

**C88** - IF uma skill usada numa vaga é promovida THEN a vaga SHALL continuar com o mesmo id e passar a mostrar a skill como global. (APP-88, edge 1)
Proof: run api-integration | ✓ APP-88

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-08 - user: "Executar todas as task usando sub-agenta com o sonnet 5.5 médium, vó orquestra e garante a qualidade das entregas. Só me chame em dúvidas críticas que você não consegue resolver só"
**Dispatched:** B1 (T1–T9, Sonnet 5.5 medium) at HEAD 447964d, 2026-11-08 17:26 - returned; accepted at 3960e63 with no fix round (gates green: contracts, api unit, api integration, web, ui, guardrails) | B2 (T10–T17, Sonnet 5.5 medium) at HEAD 3960e63, 2026-11-08 17:46 - returned; accepted at f8720fe with no fix round (gates green; api integration 270) | B3 (T18–T25, Sonnet 5.5 medium) at HEAD f8720fe, 2026-11-08 18:09 - returned; accepted at f377d51 with no fix round (quick gates green; ui 579) | B4 (T26–T30, Sonnet 5.5 medium) at HEAD f377d51, 2026-11-08 18:27
**Orchestrator decisions:** 2026-11-08 B2/T17: `postingCount` became required, so two existing assertions changed by adding the field, not by loosening: `skills-admin-list.int.test.ts` SKL-33 still checks the exact keys, now including `postingCount`; `applications.test.ts` turned "accepts a row without the count" (a T1 stopgap) into "refuses a row without the count". The T17 `Done when` item "sem edição de asserção" holds in intent only for these two; accepted.
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → ... → Phase 10

Phase 1:  T1 ------→ T2 ------→ T3 ------→ T4
Phase 2:  T5 ------→ T6 ------→ T7 ------→ T8 ------→ T9
Phase 3:  T10 ------→ T11 ------→ T12 ------→ T13 ------→ T14 ------→ T15 ------→ T16
Phase 4:  T17
Phase 5:  T18 ------→ T19 ------→ T20 ------→ T21 ------→ T22 ------→ T23 ------→ T24 ------→ T25
Phase 6:  T26 ------→ T27 ------→ T28 ------→ T29 ------→ T30
Phase 7:  T31 ------→ T32 ------→ T33 ------→ T34 ------→ T35 ------→ T36
Phase 8:  T37 ------→ T38 ------→ T39 ------→ T40 ------→ T41 ------→ T42 ------→ T43 ------→ T44
Phase 9:  T45 ------→ T46
Phase 10: T47 ------→ T48
```

Execução estritamente sequencial. Com 48 tasks, as fases se agrupam em lotes de cerca de 7 tasks para workers, mediante oferta ao usuário no início do Execute.
