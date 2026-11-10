# Master Resume Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, the Verifier and the screens sub-agent). Neste projeto o fechamento segue `docs/workflow.md#gates-e-tempo`: sem `check_proofs.py` nem `validate_verification.py`.

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/master-resume/design.md`
**Status**: Approved
**Approved**: 2026-11-10 - user: "esse chat vai orquestar os subagents e garantir a qualidade. Utilizar o modelo sonnet 5.5 medium como sub-agente. Para a verificação final usar o opus 5.5"
**Build**: `pnpm build; pnpm typecheck; pnpm lint`
**Run api-unit**: `pnpm --filter @am/api exec vitest run --project unit --reporter=verbose`
**Run api-integration**: `pnpm --filter @am/api exec vitest run --project integration --reporter=verbose`
**Run ui**: `pnpm --filter @am/ui exec vitest run --reporter=verbose`
**Run web**: `pnpm --filter @am/web exec vitest run --reporter=verbose`
**Run e2e**: `pnpm test:e2e`

Ambiente: `nvm use 24` antes de qualquer comando, Docker rodando para os testes de integração e para o E2E, e `.env` copiado de `.env.example`.

Convenção dos testes: o nome de cada teste que prova um check começa pelo id do requisito, como `RES-05 ...`, e a linha esperada de cada proof é `✓ RES-05`. Na primeira execução real cada linha é conferida com a saída e ajustada só na forma; a afirmação do check nunca muda. Os testes usam só dados fictícios: pessoas como `Pessoa Fictícia Alfa`, empresas como `Empresa Fictícia Alfa`, e-mails em `@exemplo.com`, links em `https://exemplo.com/`, e skills do seed ou privadas com nomes fora do seed (`Skill Fictícia Alfa`).

Leituras (AD-028): nenhuma task acrescenta leitura fora da tabela `## Data Reads` do design. Uma leitura nova, ou uma resposta maior que a da tabela, volta ao design antes do código.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `docs/engineering-guidelines.md`, `docs/design/principles.md`, `docs/design/system/prumo.md`, `docs/workflow.md`, `apps/api/vitest.config.ts`, `packages/ui/vitest.config.ts`, `apps/web/vitest.config.ts`, `tooling/guardrails/src/code-patterns.test.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Contratos (`packages/contracts`) | unit | Cada forma válida aceita e cada limite rejeitado, nas duas bordas | `packages/contracts/src/**/*.test.ts` | `pnpm --filter @am/contracts test` |
| API: domínio (funções puras) | unit | Todos os ramos; 1:1 com os critérios | `apps/api/src/**/*.test.ts` | `pnpm --filter @am/api test` |
| API: HTTP, serviço, repositório, schema, migração | integration (Testcontainers, PG 18) | Toda rota: sucesso e cada erro da spec; isolamento entre duas contas member; concorrência com requisições paralelas; sem mock de banco | `apps/api/src/**/*.int.test.ts` | `pnpm --filter @am/api test:integration` |
| Componentes de UI (`packages/ui`) | unit (jsdom) + browser (Chromium) + storybook | Cada variante; arrastar, teclado e foco no navegador; story nos dois temas; sem texto de produto | `packages/ui/src/**/*.test.tsx`, `*.browser.test.tsx`, `*.stories.tsx` | `pnpm --filter @am/ui test` |
| Web: model, BFF, hooks, componentes e rotas | unit (Testing Library, API falsa) | Cada texto e estado de tela da spec; todo ramo das funções puras e dos hooks | `apps/web/src/**/*.test.ts(x)` | `pnpm --filter @am/web test` |
| Jornada, arrastar, axe, larguras e captura | e2e (Playwright + compose) | A jornada do Success Criteria, arrastar e teclado persistidos, as larguras e `captures/PageMasterResume.running.png` | `tests/e2e/specs/browser/**/*.spec.ts` | `pnpm test:e2e` |
| Documentos e migração gerada | none | build gate only | - | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tasks de contratos, domínio, UI e web | `pnpm lint && pnpm typecheck && pnpm test` |
| Full | Tasks com testes de integração | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration` |
| E2E | T35 | `pnpm test:e2e` (local; o CI roda pelo escopo do PR) |
| Build | Fim de fase e tasks de documento | `pnpm build && pnpm typecheck && pnpm lint && pnpm test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Contratos, domínio e schema

```
T1 → T2 → T3 → T4
```

### Phase 2: API de leitura, perfil e resumo

```
T5 → T6 → T7
```

### Phase 3: API dos itens

```
T8 → T9 → T10 → T11
```

### Phase 4: API dos bullets e acesso

```
T12 → T13 → T14 → T15
```

### Phase 5: Componentes de UI

```
T16 → T17 → T18 → T19
```

### Phase 6: Base do web

```
T20 → T21 → T22 → T23 → T24
```

### Phase 7: Página, índice e perfil

```
T25 → T26 → T27
```

### Phase 8: Itens e bullets na tela

```
T28 → T29 → T30 → T31 → T32 → T33
```

### Phase 9: Home e fechamento

```
T34 → T35 → T36
```

---

## Model Assignment

Plano de execução pedido pelo usuário: o orquestrador (Opus 5.5, este chat) não implementa; **todas as tasks são executadas por sub-agentes Sonnet 5.5 com esforço médio**, um lote por vez, em sequência, despachados por `delegate_task` no checkout principal. O orquestrador confere os gates por conta própria, lê o diff e os testes de cada lote e devolve defeitos a um worker. O Verifier e o sub-agente de telas rodam em Opus 5.5 depois da T36.

| Lote | Fases | Tasks |
| ---- | ----- | ----- |
| B1 | 1 e 2 | T1–T7 (7) |
| B2 | 3 e 4 | T8–T15 (8) |
| B3 | 5 e 6 | T16–T24 (9) |
| B4 | 7 e 8 | T25–T33 (9) |
| B5 | 9 | T34–T36 (3) |

---

## Task Breakdown

### T1: Contratos do currículo

**What**: Schemas zod de `/resume`: seções, mês, nível de idioma, perfil, corpos de cada seção (criar e editar), bullet, dicionário de skills, respostas (`MasterResume`, `{ bullet, skills }`, `{ ids }`, `{ ready }`) e as constantes de limite.
**Where**: `packages/contracts/src/resume.ts`
**Depends on**: None
**Reuses**: `packages/contracts/src/applications.ts` (`noControl`, que passa a um helper do pacote, e `invalidSkillsProblemSchema`), `skillScopeSchema`
**Requirement**: RES-05, RES-11, RES-19, RES-23

**Done when**:

- [x] Exportados por `packages/contracts/src/index.ts`, com `RESUME_ITEMS_MAX = 50`, `BULLETS_PER_ITEM_MAX = 30`, `SKILLS_PER_BULLET_MAX = 20`, `PROFILE_LINKS_MAX = 5`, `BULLET_TEXT_MAX_LENGTH = 500` e os limites de campo da spec
- [x] Perfil aceita textos vazios, recusa e-mail preenchido fora do formato, mais de 5 links, link sem rótulo ou com URL que não é `http`/`https`, e `locale` diferente de `pt-BR`
- [x] `monthSchema` aceita `2023-03` e recusa `2023-13`, `2023-3` e `2023-03-01`; fim antes do início recusado em experiência e formação, também no corpo de edição quando os dois vêm
- [x] Bullet recusa texto vazio depois de aparado, 501 caracteres e 21 skills; aceita 500 e 20
- [x] `noControl` movido sem mudar os testes de `applications.test.ts`
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(contracts): add the master resume contract`

---

### T2: Meses no banco

**What**: `toMonthDate('2023-03')` → `2023-03-01` e `fromMonthDate(date)` → `'2023-03'`, sem fuso.
**Where**: `apps/api/src/modules/resume/domain/months.ts`
**Depends on**: T1
**Reuses**: `monthSchema` de `@am/contracts`
**Requirement**: RES-11, RES-12

**Done when**:

- [x] Ida e volta iguais para janeiro, dezembro e um ano bissexto; nenhum dia muda em `America/Sao_Paulo` nem em UTC
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): add the month conversion of the resume`

---

### T3: Conferência da ordem

**What**: `isExactOrder(sent, existing)`: verdadeiro só quando `sent` tem exatamente os ids de `existing`, cada um uma vez.
**Where**: `apps/api/src/modules/resume/domain/order.ts`
**Depends on**: T2
**Reuses**: `apps/api/src/modules/applications/domain/ids.ts` (forma de `isUuid`, copiada para `resume/domain/ids.ts`)
**Requirement**: RES-27

**Done when**:

- [x] Recusa um id a menos, um a mais, um repetido, um estranho e um que não é uuid; aceita qualquer permutação; lista vazia com seção vazia é exata
- [x] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(api): add the exact order check of the resume`

---

### T4: Schema `resume` e migração 0005

**What**: As sete tabelas e o enum `language_level` do design, reexportados em `infra/database/schema.ts`, e a migração gerada por `drizzle-kit generate`.
**Where**: `apps/api/src/modules/resume/infra/schema.ts`
**Depends on**: T3
**Reuses**: `apps/api/src/modules/applications/infra/schema.ts` (`id()`, `instant()`), `apps/api/src/modules/applications/infra/schema.int.test.ts`
**Requirement**: RES-06, RES-31

**Done when**:

- [ ] `apps/api/drizzle/0005_resume_schema.sql` gerada, aplicada pelo teste de migrações
- [ ] Teste `RES-31`: nenhuma FK sai do schema `resume`; FKs de `bullets` só para `experiences` e `projects`, com `on delete cascade`
- [ ] Teste: `profiles.user_id` único; `bullets` com `experience_id` e `project_id` juntos, ou nenhum dos dois, é recusado pelo `check`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add the resume schema`

---

### T5: Ler o currículo

**What**: `ResumeModule` (repositório `readAll`, serviço `get`, controller `GET /resume`) registrado no `AppModule`, e o helper `apps/api/test/resume.ts`.
**Where**: `apps/api/src/modules/resume/application/resume.service.ts`
**Depends on**: None (Phase 1 concluída)
**Reuses**: `apps/api/src/modules/applications/` (formato do módulo), `apps/api/test/applications.ts`
**Requirement**: RES-01, RES-02

**Done when**:

- [ ] Teste `RES-01`: conta nova responde o perfil vazio com `locale` `pt-BR`, as cinco seções vazias e `skills` vazio, e nenhuma linha é gravada em `resume.*`
- [ ] Teste `RES-02` (parte das seções): itens semeados por SQL voltam na ordem de `position`, com datas `YYYY-MM` e `endDate` nulo
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): read the master resume`

---

### T6: Salvar o perfil

**What**: `PUT /resume/profile` com `upsert` por `user_id`.
**Where**: `apps/api/src/modules/resume/http/resume.controller.ts`
**Depends on**: T5
**Reuses**: `zodBody`, `problemFor`
**Requirement**: RES-03, RES-04, RES-05, RES-06

**Done when**:

- [ ] Testes `RES-03` a `RES-06`: primeira gravação cria, segunda atualiza a mesma linha; textos aparados; campos vazios aceitos; cada recusa do `RES-05` responde `400` com o `path` e não grava
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): save the resume profile`

---

### T7: Resumo do currículo

**What**: `GET /resume/summary` → `{ ready }`, com `ResumeRepository.isReady` em uma consulta `EXISTS`, sem chamar o módulo `skills`.
**Where**: `apps/api/src/modules/resume/infra/resume.repository.ts`
**Depends on**: T6
**Reuses**: helper de T5
**Requirement**: RES-86

**Done when**:

- [ ] Teste `RES-86`: conta nova `false`; só nome `false`; só bullet com skill `false`; nome e bullet sem skill `false`; nome e bullet com skill `true`; nada é gravado
- [ ] Teste: `SkillsCatalog` não é chamado (espião no provider)
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): add the resume summary`

---

### T8: Criar item

**What**: `POST /resume/:section` para as cinco seções, no topo (`min(position) - 1`), com o limite de 50 sob `pg_advisory_xact_lock` do usuário.
**Where**: `apps/api/src/modules/resume/application/resume.service.ts`
**Depends on**: None (Phase 2 concluída)
**Reuses**: `domain/months.ts`, os schemas de T1
**Requirement**: RES-07, RES-11, RES-12, RES-13

**Done when**:

- [ ] Teste `RES-07`: um item de cada seção responde `201` e aparece primeiro em `GET /resume`; a resposta de experiência e projeto não traz `bullets`
- [ ] Teste `RES-11`: cada recusa da spec responde `400` sem gravar
- [ ] Teste `RES-12`: experiência e formação sem fim voltam com `endDate` nulo
- [ ] Teste `RES-13`: a 51ª responde `422`; duas criações em paralelo com 49 itens terminam com 50, uma `201` e uma `422`
- [ ] `:section` desconhecido responde `404`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): create resume items`

---

### T9: Editar item

**What**: `PATCH /resume/:section/:id` com o corpo parcial da seção.
**Where**: `apps/api/src/modules/resume/infra/resume.repository.ts`
**Depends on**: T8
**Reuses**: `ResumeNotFoundError` de T8
**Requirement**: RES-08, RES-11, RES-14

**Done when**:

- [ ] Teste `RES-08`: só o campo enviado muda; `endDate: null` torna a experiência atual
- [ ] Teste: fim enviado antes do início já salvo responde `400`
- [ ] Teste `RES-14` (parte do `PATCH`): id de outra conta, inexistente, de outra seção ou não uuid responde `404` sem mudar nada
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): update resume items`

---

### T10: Excluir item

**What**: `DELETE /resume/:section/:id`, levando os bullets pela FK interna.
**Where**: `apps/api/src/modules/resume/http/resume.controller.ts`
**Depends on**: T9
**Reuses**: repositório de T8
**Requirement**: RES-09, RES-10, RES-14

**Done when**:

- [ ] Testes `RES-09` e `RES-10`: `204`; os bullets da experiência apagada somem; os de outra experiência ficam
- [ ] Teste `RES-14` (parte do `DELETE`): `404` sem apagar nada
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): delete resume items`

---

### T11: Ordem dos itens

**What**: `PUT /resume/:section/order` → `{ ids }`, renumerando `0..n-1` sob o lock do usuário.
**Where**: `apps/api/src/modules/resume/application/resume.service.ts`
**Depends on**: T10
**Reuses**: `domain/order.ts`
**Requirement**: RES-25, RES-27

**Done when**:

- [ ] Teste `RES-25`: inverter três experiências responde `{ ids }` na nova ordem e `GET /resume` a mostra
- [ ] Teste `RES-27` (parte dos itens): id a menos, repetido, de outra seção, de outra conta ou não uuid responde `400` e a ordem não muda
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): order resume items`

---

### T12: Criar bullet e dicionário de skills

**What**: `POST /resume/:section/:id/bullets` para experiências e projetos, e o dicionário `skills` em `GET /resume` e nas respostas de bullet.
**Where**: `apps/api/src/modules/resume/application/resume.service.ts`
**Depends on**: None (Phase 3 concluída)
**Reuses**: `SkillsCatalog.visibleIds` e `describe`, `InvalidSkillsProblem` e o `answering()` de applications
**Requirement**: RES-02, RES-15, RES-18, RES-19, RES-20, RES-21, RES-23, RES-24

**Done when**:

- [ ] Teste `RES-15`: `201` com `{ bullet, skills }`, no fim do item
- [ ] Testes `RES-18` a `RES-21`: `skillIds` vazio aceito; `400` nos limites; `422` com `invalidSkillIds` para inexistente, privada alheia, repetida e não uuid; `422` no 31º bullet
- [ ] Teste `RES-23`: `skillIds` na ordem de marcação; cada skill citada uma vez em `skills`, também quando três bullets citam a mesma
- [ ] Teste `RES-24`: uma privada promovida pelo admin volta com o mesmo id e `scope` `global`
- [ ] Teste `RES-02` (parte dos bullets): bullets na ordem de `position` dentro de cada item
- [ ] Rota de bullet em `educations`, `certifications` ou `languages` responde `404`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): create resume bullets`

---

### T13: Editar e excluir bullet

**What**: `PATCH` e `DELETE /resume/:section/:id/bullets/:bulletId`.
**Where**: `apps/api/src/modules/resume/http/resume.controller.ts`
**Depends on**: T12
**Reuses**: serviço de T12
**Requirement**: RES-16, RES-17, RES-22

**Done when**:

- [ ] Teste `RES-16`: só `text`, só `skillIds` e os dois; resposta `{ bullet, skills }`
- [ ] Teste `RES-17`: `204` e o bullet some
- [ ] Teste `RES-22`: item ou bullet de outra conta, bullet de outro item, inexistente e não uuid respondem `404` sem mudar nada
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): update and delete resume bullets`

---

### T14: Ordem dos bullets

**What**: `PUT /resume/:section/:id/bullets/order` → `{ ids }`.
**Where**: `apps/api/src/modules/resume/infra/resume.repository.ts`
**Depends on**: T13
**Reuses**: `domain/order.ts`, lock de T8
**Requirement**: RES-26, RES-27

**Done when**:

- [ ] Teste `RES-26`: inverter três bullets responde `{ ids }` e `GET /resume` mostra a ordem
- [ ] Teste `RES-27` (parte dos bullets): bullet de outro item, a menos, repetido ou de outra conta responde `400` sem mudar a ordem
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `feat(api): order resume bullets`

---

### T15: Acesso, isolamento e logs

**What**: Os testes que percorrem toda rota de `/resume`: sem sessão, admin, outra conta, `userId` no corpo, logs sem dado pessoal, e a fronteira com `skills`.
**Where**: `apps/api/src/modules/resume/http/resume-access.int.test.ts`
**Depends on**: T14
**Reuses**: `applications-access.int.test.ts`, `applications-logging.int.test.ts`, `applications/domain/skills-port-boundary.test.ts`
**Requirement**: RES-28, RES-29, RES-30, RES-32, RES-33

**Done when**:

- [ ] Testes `RES-28` a `RES-30`: cada rota responde `401` sem sessão e `403` ao admin; com ids da conta A, a conta B recebe `404` e o snapshot das sete tabelas não muda; `userId` no corpo é ignorado
- [ ] Teste `RES-32`: nenhum arquivo de `modules/resume` importa de `modules/skills` fora de `index.ts`
- [ ] Teste `RES-33`: uma rodada por todas as escritas registra `event`, id e `actorId`, e nenhuma linha de log contém os textos fictícios usados
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration`

**Tests**: integration
**Gate**: full

**Commit**: `test(api): cover resume access, isolation and logs`

---

### T16: `Sortable`

**What**: `Sortable.List`, `Sortable.Item` e `Sortable.Handle` sobre `@dnd-kit/core` 6.3 e `@dnd-kit/sortable` 10.0, com sensor de ponteiro e de teclado, eixo vertical, anúncios do chamador e `DndContext id` de `useId()` (AD-027).
**Where**: `packages/ui/src/components/sortable/sortable.tsx`
**Depends on**: None (Phase 4 concluída)
**Reuses**: `packages/ui/src/components/inline-edit/` (formato de pasta, testes e story)
**Requirement**: RES-72, RES-73, RES-76

**Done when**:

- [ ] Teste de browser: arrastar pela alça chama `onReorder` com a nova ordem; `Espaço`, setas e `Espaço` movem; `Esc` devolve sem chamar `onReorder`; os anúncios vêm das props
- [ ] Teste: render no servidor e hidratação sem aviso de ids
- [ ] Story nos dois temas; o teste `no-product-copy` passa; `Sortable` exportado em `src/index.ts`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the sortable list`

---

### T17: `InlineEdit` de várias linhas

**What**: Prop `multiline`: um `textarea` que cresce com o texto; `Enter` confirma e não quebra linha; `Esc` desfaz.
**Where**: `packages/ui/src/components/inline-edit/inline-edit.tsx`
**Depends on**: T16
**Reuses**: o próprio `InlineEdit`
**Requirement**: RES-64

**Done when**:

- [ ] Testes do modo `multiline` (confirmar, sair do campo, `Esc`, crescer) e os testes atuais sem mudança
- [ ] Story do modo `multiline`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the multiline inline edit`

---

### T18: Link do índice e item do `FormPage`

**What**: `FormPage.IndexLink` (link com `current` e `count` em `mono`, omitido quando zero) e `FormPage.Item` (caixa `radius-md` com alça, cabeçalho e corpo).
**Where**: `packages/ui/src/layouts/form-page/form-page.tsx`
**Depends on**: T17
**Reuses**: `AppShell.NavItem` (contagem e `aria-current`)
**Requirement**: RES-37

**Done when**:

- [ ] Testes: `aria-current="page"` só no atual; contagem zero ou ausente não aparece
- [ ] Story do `FormPage` atualizada com índice e itens; o README da carta deixa de dizer "ainda não existe em `packages/ui`"
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the form page index link and item`

---

### T19: `Bullet`

**What**: Texto em `body-lg`, área de tags abaixo, alça à esquerda e área à direita (menu ou aviso), como `.am-bullet` da carta.
**Where**: `packages/ui/src/components/bullet/bullet.tsx`
**Depends on**: T18
**Reuses**: `SkillTag`, tokens de `warning`
**Requirement**: RES-60

**Done when**:

- [ ] Testes de composição: alça, texto, tags e área à direita; nada de texto de produto
- [ ] Story com tags e sem tags; exportado em `src/index.ts`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(ui): add the bullet`

---

### T20: Server functions do currículo

**What**: As 11 server functions do design, uma por endpoint (AD-007), com as funções puras testadas.
**Where**: `apps/web/src/features/resume/api/server-functions.ts`
**Depends on**: None (Phase 5 concluída)
**Reuses**: `apps/web/src/features/applications/api/server-functions.ts`, `apps/web/src/lib/bff.ts`
**Requirement**: RES-40, RES-86

**Done when**:

- [ ] Testes: método, caminho e corpo de cada uma; resposta validada pelo schema de contracts; `401`, `404`, `422` e falha de rede viram `Outcome` com a falha
- [ ] `RESUME_ENDPOINTS` lista as 11, e o teste confere que cada uma tem server function
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the resume server functions`

---

### T21: Rótulos, seções e datas

**What**: `model/sections.ts` (rótulos, textos de vazio, botões, títulos de exclusão, `parseSection`), `model/months.ts` (`formatMonth`, `formatRange`) e `model/item-header.ts`.
**Where**: `apps/web/src/features/resume/model/sections.ts`
**Depends on**: T20
**Reuses**: `apps/web/src/features/applications/model/labels.ts`
**Requirement**: RES-36, RES-39, RES-49, RES-50

**Done when**:

- [ ] Testes: `parseSection` volta `profile` para ausente e desconhecido; "mar 2023", "jan 2021 — fev 2023", "mar 2023 — atual"; cabeçalho de cada seção como no RES-49; os cinco textos de vazio
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the resume labels and dates`

---

### T22: Contagens do índice

**What**: `sectionCounts(resume)`, `bulletsWithoutSkill(resume)` e `missingSkillMessage(n)`.
**Where**: `apps/web/src/features/resume/model/counts.ts`
**Depends on**: T21
**Reuses**: tipos de `@am/contracts`
**Requirement**: RES-37, RES-38

**Done when**:

- [ ] Testes: contagem por seção; bullets sem skill somando experiências e projetos; mensagem com 0 (nenhuma), 1 (singular) e 2 (plural), com o texto exato da spec
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the resume index counts`

---

### T23: Salvamento automático

**What**: `useAutosaveField({ saved, validate, save })` e o `SavedAtContext` ("Salvo às HH:MM").
**Where**: `apps/web/src/features/resume/hooks/use-autosave-field.ts`
**Depends on**: T22
**Reuses**: `problemMessage` de `features/identity`
**Requirement**: RES-44, RES-45, RES-47, RES-48

**Done when**:

- [ ] Testes: valor igual ao salvo não chama `save`; inválido mostra o erro e não chama; sucesso avisa o contexto com a hora; falha guarda "Não foi possível salvar. Tente de novo." e mantém o valor; um segundo envio espera o primeiro e manda o último valor
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the resume autosave`

---

### T24: Reordenar no cache

**What**: `useReorder(section, parentId?)`: troca otimista no cache `['resume']`, envia a ordem, desfaz na falha e lê de novo no `400`.
**Where**: `apps/web/src/features/resume/hooks/use-reorder.ts`
**Depends on**: T23
**Reuses**: server functions de T20
**Requirement**: RES-74, RES-75

**Done when**:

- [ ] Testes `RES-74` e `RES-75`: sucesso mantém a nova ordem; falha de rede volta à anterior com "Não foi possível salvar a nova ordem."; `400` chama a leitura e mostra a ordem salva
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the resume reorder`

---

### T25: Rota `/resume`, página e índice

**What**: A rota com `section` na URL e o loader `getResume()`; `ResumePage` com a topbar ("Currículo mestre" e `SavedAt`) e `ResumeIndex` com contagens e o Alert.
**Where**: `apps/web/src/routes/_member/resume.tsx`
**Depends on**: None (Phase 6 concluída)
**Reuses**: `routes/_member/applications/index.tsx`, `UnavailableScreen`, `useExpiredSessionRedirect`
**Requirement**: RES-35, RES-36, RES-37, RES-38, RES-40, RES-41

**Done when**:

- [ ] Testes `RES-35` a `RES-38`, `RES-40` e `RES-41` com a API falsa
- [ ] O loader devolve só o `Outcome` de `GET /resume` (Data Reads)
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the resume page and index`

---

### T26: Item "Currículo mestre" na sidebar

**What**: Grupo "Currículo" com "Currículo mestre" (`FileText`), atual em `/resume`.
**Where**: `apps/web/src/routes/_member.tsx`
**Depends on**: T25
**Reuses**: `AppShell.Section`, `AppShell.NavItem`
**Requirement**: RES-77, RES-81

**Done when**:

- [ ] Teste `RES-77`: o item aparece e só é atual em `/resume`; `RES-81`: sessão de admin em `/resume` vai para `/admin`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): add the master resume to the member sidebar`

---

### T27: Seção Perfil

**What**: `ProfileSection` e `LinksField` com salvamento automático.
**Where**: `apps/web/src/features/resume/components/ProfileSection.tsx`
**Depends on**: T26
**Reuses**: `useAutosaveField`, `Field`
**Requirement**: RES-43, RES-44, RES-45, RES-46, RES-47, RES-48, RES-84, RES-85

**Done when**:

- [ ] Testes `RES-43` a `RES-48`, `RES-84` e `RES-85` com os rótulos exatos da spec
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): edit the resume profile`

---

### T28: Seção de itens e cartão do item

**What**: `ItemsSection` (botão "+", vazio, limite) e `ItemCard` (cabeçalho, expandir e recolher, lápis), para as cinco seções.
**Where**: `apps/web/src/features/resume/components/ItemsSection.tsx`
**Depends on**: None (Phase 7 concluída)
**Reuses**: `FormPage.Section`, `FormPage.Item`, `model/item-header.ts`
**Requirement**: RES-39, RES-49, RES-50, RES-56, RES-82

**Done when**:

- [ ] Testes `RES-39`, `RES-49`, `RES-50`, `RES-56` e `RES-82`; o primeiro item com bullets abre expandido
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): show the resume sections and items`

---

### T29: Campos dos itens e item novo

**What**: `ItemFields` de cada seção, com o rascunho do item novo que só cria quando válido e espera o id antes de editar.
**Where**: `apps/web/src/features/resume/components/ItemFields.tsx`
**Depends on**: T28
**Reuses**: `useAutosaveField`, schemas de T1
**Requirement**: RES-51, RES-52, RES-53, RES-54, RES-55, RES-59

**Done when**:

- [ ] Testes `RES-51` a `RES-55` e `RES-59` em cada seção
- [ ] Teste: dois blurs enquanto o `POST` está em voo criam um item só e o segundo vira `PATCH`
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): edit and create resume items`

---

### T30: Excluir item

**What**: "Excluir {item}" com `ConfirmDialog`, tirando o item do cache.
**Where**: `apps/web/src/features/resume/components/DeleteItem.tsx`
**Depends on**: T29
**Reuses**: `apps/web/src/features/applications/components/DeleteApplication.tsx`
**Requirement**: RES-57, RES-58

**Done when**:

- [ ] Testes `RES-57` e `RES-58`: título e botões exatos; confirmar tira o item e atualiza contagem e Alert; cancelar não envia
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): delete resume items`

---

### T31: Bullets: texto, menu e exclusão

**What**: `BulletList` e `BulletRow`: "+ Bullet", edição do texto, "sem skill", menu "⋯" com "Excluir bullet".
**Where**: `apps/web/src/features/resume/components/BulletRow.tsx`
**Depends on**: T30
**Reuses**: `Bullet`, `InlineEdit multiline`, `DropdownMenu`, `SkillTag`
**Requirement**: RES-60, RES-61, RES-62, RES-63, RES-64, RES-65, RES-68, RES-69, RES-83

**Done when**:

- [ ] Testes `RES-60` a `RES-65`, `RES-68`, `RES-69` e `RES-83`; as tags saem de `skillIds` lidos no dicionário do cache
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): write resume bullets`

---

### T32: Skills do bullet

**What**: "Editar skills" e o clique em "sem skill" abrem o `SkillsField`; cada mudança salva; "Concluir" fecha.
**Where**: `apps/web/src/features/resume/components/BulletSkills.tsx`
**Depends on**: T31
**Reuses**: `SkillsField` de `features/skills`
**Requirement**: RES-66, RES-67

**Done when**:

- [ ] Testes `RES-66` e `RES-67`: incluir uma skill existente, criar uma privada escolhendo a categoria e remover salvam na hora; o dicionário do cache recebe as skills da resposta; "sem skill" e o Alert somem
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): tag resume bullets with skills`

---

### T33: Reordenar na tela

**What**: `Sortable` nos itens de cada seção e nos bullets de cada item, ligado ao `useReorder`, com os anúncios em pt-BR.
**Where**: `apps/web/src/features/resume/components/ItemsSection.tsx`
**Depends on**: T32
**Reuses**: `Sortable`, `useReorder`
**Requirement**: RES-70, RES-71, RES-72, RES-73, RES-74, RES-75

**Done when**:

- [ ] Testes com `onReorder` acionado: a ordem da tela muda e a server function recebe os ids; falha e `400` como em T24
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): reorder resume items and bullets`

---

### T34: Passo 02 da home

**What**: "Abrir currículo" e o "Concluído" pelo `GET /resume/summary`; o loader devolve só `ready`.
**Where**: `apps/web/src/routes/_member/index.tsx`
**Depends on**: None (Phase 8 concluída)
**Reuses**: o passo 03 (APP-84)
**Requirement**: RES-78, RES-79, RES-80

**Done when**:

- [ ] Testes `RES-78` a `RES-80`; falha da leitura deixa o passo sem "Concluído"
- [ ] Teste: o loader devolve `{ ready }` e nenhum campo do currículo
- [ ] Gate check passes: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(web): complete the home step 02 from the resume summary`

---

### T35: E2E do currículo e imagem da tela

**What**: Jornada no navegador contra a stack: preencher, marcar skills, arrastar e reordenar pelo teclado com recarga, larguras, axe e `captures/PageMasterResume.running.png`.
**Where**: `tests/e2e/specs/browser/resume.spec.ts`
**Depends on**: T34
**Reuses**: `tests/e2e/specs/browser/applications.spec.ts`, `tests/e2e/support/identity.ts`
**Requirement**: RES-34, RES-42, RES-70, RES-71, RES-72, RES-73

**Done when**:

- [ ] Jornada do Success Criteria: perfil, duas experiências com seis bullets marcados (uma skill privada nova) e formação, sem botão de salvar
- [ ] Testes `RES-70` a `RES-73`: ordem trocada por arrastar e por teclado persiste depois de recarregar; `Esc` não muda nada
- [ ] Teste `RES-42`: sem rolagem horizontal a 375 px e 1280 px
- [ ] Axe nos dois temas: página, item em edição, campo de skills, menu do bullet e confirmação de exclusão
- [ ] `PageMasterResume.running.png` salva em `.specs/features/master-resume/captures/` a 1280 × 800, em `/resume?section=experiences`, com dados fictícios equivalentes aos da carta
- [ ] Gate check passes: `pnpm test:e2e`

**Tests**: e2e
**Gate**: e2e

**Commit**: `test(e2e): cover the master resume`

---

### T36: Documentos

**What**: Fechar a feature nos documentos: `.specs/STATE.md` (Handoff), `docs/roadmap.md` (MasterResume em uso, revisão de leituras a seguir) e `docs/guia-teste-manual.md` (roteiro do currículo).
**Where**: `.specs/STATE.md`
**Depends on**: T35
**Reuses**: o Handoff da feature application
**Requirement**: RES-34

**Done when**:

- [ ] Handoff com a feature, os gates finais e o próximo passo
- [ ] Gate check passes: `pnpm build && pnpm typecheck && pnpm lint && pnpm test`

**Tests**: none
**Gate**: build

**Commit**: `docs: close the master resume feature`

---

## Checks

**C1** - WHEN um member sem currículo chama `GET /resume` THEN a API SHALL responder `200` com o perfil de campos vazios, links vazios, `locale` `pt-BR` e as cinco seções vazias, sem gravar nenhuma linha. (RES-01, AC 1)
Proof: run api-integration | ✓ RES-01

**C2** - WHEN um member com currículo chama `GET /resume` THEN a API SHALL responder `200` com o perfil, as seções `experiences`, `projects`, `educations`, `certifications` e `languages`, cada uma na ordem salva, os bullets de cada experiência e projeto na ordem salva e o dicionário `skills`. (RES-02, AC 2)
Proof: run api-integration | ✓ RES-02

**C3** - WHEN um member envia `PUT /resume/profile` válido THEN a API SHALL gravar o perfil (criando-o na primeira vez), com os textos aparados, e responder `200` com o perfil salvo. (RES-03, AC 3)
Proof: run api-integration | ✓ RES-03

**C4** - WHEN `PUT /resume/profile` traz nome, título, e-mail, resumo ou local vazios THEN a API SHALL aceitar e responder `200`. (RES-04, AC 4)
Proof: run api-integration | ✓ RES-04

**C5** - IF o perfil traz e-mail preenchido fora do formato, um campo acima do limite, mais de 5 links, link sem rótulo ou com URL que não é `http`/`https`, ou `locale` diferente de `pt-BR` THEN a API SHALL responder `400` em Problem Details com o campo inválido, sem gravar. (RES-05, AC 5)
Proof: run api-integration | ✓ RES-05

**C6** - The API SHALL keep one profile per user. (RES-06, AC 6)
Proof: run api-integration | ✓ RES-06

**C7** - WHEN um member envia `POST /resume/{section}` válido THEN a API SHALL gravar o item no topo da seção e responder `201` com o item. (RES-07, AC 1)
Proof: run api-integration | ✓ RES-07

**C8** - WHEN um member envia `PATCH /resume/{section}/:id` válido THEN a API SHALL gravar só os campos enviados e responder `200` com o item. (RES-08, AC 2)
Proof: run api-integration | ✓ RES-08

**C9** - WHEN um member envia `DELETE /resume/experiences/:id` ou `DELETE /resume/projects/:id` THEN a API SHALL apagar o item e os bullets dele numa transação e responder `204`. (RES-09, AC 3)
Proof: run api-integration | ✓ RES-09

**C10** - WHEN um member envia `DELETE /resume/{educations|certifications|languages}/:id` THEN a API SHALL apagar o item e responder `204`. (RES-10, AC 4)
Proof: run api-integration | ✓ RES-10

**C11** - IF um campo obrigatório está vazio, um campo passa do limite, uma data não é `YYYY-MM`, o fim é anterior ao início, uma URL não é `http`/`https` ou o nível do idioma está fora do enum THEN a API SHALL responder `400` em Problem Details com o campo inválido, sem gravar. (RES-11, AC 5)
Proof: run api-integration | ✓ RES-11

**C12** - WHEN uma experiência ou formação é gravada com `endDate` nulo THEN a API SHALL devolvê-la com `endDate` nulo, que significa atual ou em andamento. (RES-12, AC 6)
Proof: run api-integration | ✓ RES-12

**C13** - IF a seção já tem 50 itens THEN `POST /resume/{section}` SHALL responder `422` em Problem Details, sem gravar. (RES-13, AC 7)
Proof: run api-integration | ✓ RES-13

**C14** - IF o id não existe, é de outra pessoa ou não é uuid THEN `PATCH` e `DELETE` SHALL responder `404` em Problem Details, sem mudar nada. (RES-14, AC 8)
Proof: run api-integration | ✓ RES-14

**C15** - WHEN um member envia `POST /resume/{experiences|projects}/:id/bullets` com `{ text, skillIds }` válido THEN a API SHALL gravar o bullet no fim do item e responder `201` com `{ bullet, skills }`: o bullet com `id`, `text` e `skillIds`, e o dicionário das skills dele. (RES-15, AC 1)
Proof: run api-integration | ✓ RES-15

**C16** - WHEN um member envia `PATCH /resume/{experiences|projects}/:id/bullets/:bulletId` com `text`, `skillIds` ou os dois THEN a API SHALL gravar só o enviado e responder `200` com `{ bullet, skills }`. (RES-16, AC 2)
Proof: run api-integration | ✓ RES-16

**C17** - WHEN um member envia `DELETE /resume/{experiences|projects}/:id/bullets/:bulletId` THEN a API SHALL apagar o bullet e responder `204`. (RES-17, AC 3)
Proof: run api-integration | ✓ RES-17

**C18** - WHEN o bullet é gravado com `skillIds` vazio THEN a API SHALL aceitar e devolvê-lo com a lista de skills vazia. (RES-18, AC 4)
Proof: run api-integration | ✓ RES-18

**C19** - IF o texto está vazio depois de aparado ou passa de 500 caracteres, ou há mais de 20 skills THEN a API SHALL responder `400` em Problem Details, sem gravar. (RES-19, AC 5)
Proof: run api-integration | ✓ RES-19

**C20** - IF uma skill não existe, é privada de outra pessoa, aparece duas vezes ou tem id que não é uuid THEN a API SHALL responder `422` em Problem Details com os ids recusados, sem gravar. (RES-20, AC 6)
Proof: run api-integration | ✓ RES-20

**C21** - IF o item já tem 30 bullets THEN o `POST` SHALL responder `422` em Problem Details, sem gravar. (RES-21, AC 7)
Proof: run api-integration | ✓ RES-21

**C22** - IF o item ou o bullet não existe, é de outra pessoa, o bullet é de outro item ou um id não é uuid THEN a API SHALL responder `404` em Problem Details, sem mudar nada. (RES-22, AC 8)
Proof: run api-integration | ✓ RES-22

**C23** - The bullet in every response SHALL carry `skillIds` in the order they were marked, and the response SHALL carry each cited skill once in `skills`, keyed by id with `name` and `scope`, described only through the public API of the skills module. (RES-23, AC 9)
Proof: run api-integration | ✓ RES-23

**C24** - WHEN uma skill privada marcada num bullet é promovida THEN `GET /resume` SHALL trazê-la no dicionário `skills` com o mesmo id e `scope` `global`. (RES-24, AC 10)
Proof: run api-integration | ✓ RES-24

**C25** - WHEN um member envia `PUT /resume/{section}/order` com todos os ids da seção, cada um uma vez THEN a API SHALL gravar essa ordem e responder `200` com `{ ids }` nela. (RES-25, AC 1)
Proof: run api-integration | ✓ RES-25

**C26** - WHEN um member envia `PUT /resume/{experiences|projects}/:id/bullets/order` com todos os ids dos bullets do item, cada um uma vez THEN a API SHALL gravar essa ordem e responder `200` com `{ ids }` nela. (RES-26, AC 2)
Proof: run api-integration | ✓ RES-26

**C27** - IF a lista falta um id, traz um id repetido, de outra seção, de outro item, de outra pessoa ou que não é uuid THEN a API SHALL responder `400` em Problem Details, sem mudar a ordem. (RES-27, AC 3)
Proof: run api-integration | ✓ RES-27

**C28** - The API SHALL take the owner only from the session and SHALL ignore any `userId` sent by the client. (RES-28, AC 1)
Proof: run api-integration | ✓ RES-28

**C29** - IF quem chama uma rota de `/resume` não tem sessão THEN a API SHALL responder `401`. (RES-29, AC 2)
Proof: run api-integration | ✓ RES-29

**C30** - IF quem chama uma rota de `/resume` é admin THEN a API SHALL responder `403`. (RES-30, AC 3)
Proof: run api-integration | ✓ RES-30

**C31** - The `resume` schema SHALL hold no foreign key to any other schema. (RES-31, AC 4)
Proof: run api-integration | ✓ RES-31

**C32** - The resume module SHALL validate and describe skills only through the public API of the skills module. (RES-32, AC 5)
Proof: run api-unit | ✓ RES-32

**C33** - WHEN uma escrita de `/resume` acontece THEN a API SHALL registrar o id do recurso e a ação, e SHALL NOT registrar nome, e-mail, telefone, local, links, resumo, texto de bullet, descrição ou URL. (RES-33, AC 6)
Proof: run api-integration | ✓ RES-33

**C34** - WHEN o member abre `/resume?section=experiences` THEN o web SHALL mostrar a tela em `.specs/features/master-resume/captures/PageMasterResume.png`: a topbar "Currículo mestre", o índice Perfil, Experiência, Projetos, Formação, Certificações e Idiomas com o número de itens, o Alert de bullets sem skill e a seção Experiência com "+ Experiência", o primeiro item expandido com seus bullets e "+ Bullet", e os demais recolhidos. (RES-34, AC 1)
Proof: browser captures/PageMasterResume.running.png

**C35** - WHEN o member usa um item do índice THEN o web SHALL mostrar a seção dele, marcá-la no índice e pôr `section` na URL. (RES-35, AC 2)
Proof: run web | ✓ RES-35

**C36** - WHEN o member abre `/resume` sem `section` ou com valor desconhecido THEN o web SHALL mostrar a seção Perfil. (RES-36, AC 3)
Proof: run web | ✓ RES-36

**C37** - The index SHALL show the number of items of each section in `mono`, and SHALL omit the number of a section with no item. (RES-37, AC 4)
Proof: run web | ✓ RES-37

**C38** - WHEN há bullets sem skill THEN o índice SHALL mostrar o Alert `warning` "{N} bullets sem skill não entram na ordenação por relevância.", ou "1 bullet sem skill não entra na ordenação por relevância." com um, e WHEN não há THEN SHALL omiti-lo. (RES-38, AC 5)
Proof: run web | ✓ RES-38

**C39** - WHEN uma seção não tem itens THEN o web SHALL mostrar "Nenhuma experiência ainda.", "Nenhum projeto ainda.", "Nenhuma formação ainda.", "Nenhuma certificação ainda." ou "Nenhum idioma ainda." e o botão "+" do cabeçalho. (RES-39, AC 6)
Proof: run web | ✓ RES-39

**C40** - IF a leitura do currículo falha THEN o web SHALL mostrar "Não foi possível carregar o currículo." com "Tentar de novo", que lê de novo. (RES-40, AC 7)
Proof: run web | ✓ RES-40

**C41** - The page SHALL not show "Visualizar PDF". (RES-41, AC 8)
Proof: run web | ✓ RES-41

**C42** - WHILE a largura da janela é 375 px ou 1280 px a página SHALL caber sem rolagem horizontal, com o índice acima da seção a 375 px. (RES-42, AC 9)
Proof: run e2e | ✓ RES-42

**C43** - WHEN o member abre a seção Perfil THEN o web SHALL mostrar "Nome completo", "Título profissional", "E-mail", "Telefone · opcional", "Local · opcional", "Links" com "+ Link" e "Resumo", preenchidos com o perfil salvo. (RES-43, AC 1)
Proof: run web | ✓ RES-43

**C44** - WHEN o member muda um campo do perfil e sai dele THEN o web SHALL salvar o perfil e a topbar SHALL mostrar "Salvo às HH:MM" com a hora do salvamento. (RES-44, AC 2)
Proof: run web | ✓ RES-44

**C45** - WHEN o member sai de um campo sem mudar o valor THEN o web SHALL não enviar nada. (RES-45, AC 3)
Proof: run web | ✓ RES-45

**C46** - WHEN o member usa "+ Link" THEN o web SHALL acrescentar uma linha com "Rótulo" e "URL", que salva ao sair dos dois preenchidos, e o "×" da linha SHALL remover o link e salvar. (RES-46, AC 4)
Proof: run web | ✓ RES-46

**C47** - IF o valor é inválido (e-mail fora do formato, URL que não é `http`/`https`, acima do limite) THEN o web SHALL mostrar o erro no campo e não enviar. (RES-47, AC 5)
Proof: run web | ✓ RES-47

**C48** - IF o salvamento falha THEN o campo SHALL manter o valor digitado e mostrar "Não foi possível salvar. Tente de novo.", e "Salvo às" SHALL não mudar. (RES-48, AC 6)
Proof: run web | ✓ RES-48

**C49** - The item SHALL show, in its header, "{Cargo} · {Empresa}" with "{início} — {fim}" in `mono` and the location for an experience; "{Nome}" and the URL for a project; "{Curso} · {Instituição}" with the dates for an education; "{Nome} · {Emissor}" with the issue month for a certification; and "{Idioma} · {Nível}" for a language. (RES-49, AC 1)
Proof: run web | ✓ RES-49

**C50** - WHEN a experiência ou formação não tem fim THEN o cabeçalho SHALL mostrar "{início} — atual". (RES-50, AC 2)
Proof: run web | ✓ RES-50

**C51** - WHEN o member usa "+ Experiência", "+ Projeto", "+ Formação", "+ Certificação" ou "+ Idioma" THEN o web SHALL abrir um item vazio no topo da seção, com os campos em edição e o foco no primeiro. (RES-51, AC 3)
Proof: run web | ✓ RES-51

**C52** - WHILE um item novo não tem os campos obrigatórios válidos o web SHALL mostrar "Preencha os campos obrigatórios para salvar." e não enviar nada. (RES-52, AC 4)
Proof: run web | ✓ RES-52

**C53** - WHEN o member sai de um campo e o item novo tem os obrigatórios válidos THEN o web SHALL criar o item e mostrar "Salvo às HH:MM". (RES-53, AC 5)
Proof: run web | ✓ RES-53

**C54** - WHEN o member usa o lápis "Editar" de um item THEN o web SHALL mostrar os campos dele, que salvam ao sair de cada um, e o botão "Excluir {experiência|projeto|formação|certificação|idioma}". (RES-54, AC 6)
Proof: run web | ✓ RES-54

**C55** - WHEN o member marca "Trabalho aqui atualmente" ou "Em andamento" THEN o web SHALL esconder o campo de fim e salvar o item sem fim. (RES-55, AC 7)
Proof: run web | ✓ RES-55

**C56** - WHEN o member usa o cabeçalho de um item com bullets THEN o web SHALL alternar entre expandido, com os bullets e "+ Bullet", e recolhido, com o chevron "Expandir". (RES-56, AC 8)
Proof: run web | ✓ RES-56

**C57** - WHEN o member usa "Excluir {item}" THEN o web SHALL abrir o `ConfirmDialog` "Excluir {item}?" com "Excluir" em `danger` e "Cancelar". (RES-57, AC 9)
Proof: run web | ✓ RES-57

**C58** - WHEN o member confirma a exclusão THEN o web SHALL tirar o item da seção e atualizar o número do índice e o Alert de bullets sem skill. (RES-58, AC 10)
Proof: run web | ✓ RES-58

**C59** - IF o fim fica antes do início THEN o web SHALL mostrar "O fim não pode ser antes do início." no campo de fim e não enviar. (RES-59, AC 11)
Proof: run web | ✓ RES-59

**C60** - The bullet SHALL show its text in `body-lg` with its skills as `SkillTag` below, and a bullet with no skill SHALL show "sem skill" in `warning`. (RES-60, AC 1)
Proof: run web | ✓ RES-60

**C61** - WHEN o member usa "+ Bullet" THEN o web SHALL abrir um campo de texto vazio no fim do item, com o foco nele. (RES-61, AC 2)
Proof: run web | ✓ RES-61

**C62** - WHEN o member sai do campo de um bullet novo com texto THEN o web SHALL criar o bullet e abrir o campo de skills dele. (RES-62, AC 3)
Proof: run web | ✓ RES-62

**C63** - WHEN o member sai do campo de um bullet novo sem texto THEN o web SHALL descartar o campo sem enviar nada. (RES-63, AC 4)
Proof: run web | ✓ RES-63

**C64** - WHEN o member clica no texto de um bullet THEN o web SHALL abrir a edição, que salva ao sair do campo, e `Esc` SHALL desfazer a edição. (RES-64, AC 5)
Proof: run web | ✓ RES-64

**C65** - IF o texto editado fica vazio THEN o web SHALL voltar ao texto anterior sem enviar. (RES-65, AC 6)
Proof: run web | ✓ RES-65

**C66** - WHEN o member usa "Editar skills" no menu "⋯" do bullet ou clica em "sem skill" THEN o web SHALL abrir o campo de skills abaixo do texto, com busca no catálogo e "Criar '{texto}' como skill privada" com a escolha da categoria, como no cadastro de vaga. (RES-66, AC 7)
Proof: run web | ✓ RES-66

**C67** - WHEN o member inclui ou remove uma skill no campo THEN o web SHALL salvar o bullet na hora, e "Concluir" SHALL fechar o campo. (RES-67, AC 8)
Proof: run web | ✓ RES-67

**C68** - WHEN o member usa "Excluir bullet" no menu "⋯" THEN o web SHALL apagar o bullet sem confirmação e atualizar o Alert de bullets sem skill. (RES-68, AC 9)
Proof: run web | ✓ RES-68

**C69** - WHEN o member passa o mouse ou foca um bullet THEN o web SHALL mostrar o menu "⋯" dele, inclusive no bullet sem skill. (RES-69, AC 10)
Proof: run web | ✓ RES-69

**C70** - WHEN o member arrasta um item pela alça e solta noutra posição da seção THEN o web SHALL mostrar a nova ordem e salvá-la. (RES-70, AC 1)
Proof: run e2e | ✓ RES-70

**C71** - WHEN o member arrasta um bullet pela alça e solta noutra posição do mesmo item THEN o web SHALL mostrar a nova ordem e salvá-la. (RES-71, AC 2)
Proof: run e2e | ✓ RES-71

**C72** - WHEN o member foca uma alça, pega com `Espaço` ou `Enter`, move com as setas e solta com `Espaço` ou `Enter` THEN o web SHALL mover o item ou bullet e salvar a ordem, anunciando cada passo numa região viva. (RES-72, AC 3)
Proof: run e2e | ✓ RES-72

**C73** - WHEN o member aperta `Esc` com um item pego pelo teclado THEN o web SHALL devolvê-lo à posição de antes sem enviar nada. (RES-73, AC 4)
Proof: run e2e | ✓ RES-73

**C74** - IF o salvamento da ordem falha THEN o web SHALL voltar à ordem anterior e mostrar "Não foi possível salvar a nova ordem.". (RES-74, AC 5)
Proof: run web | ✓ RES-74

**C75** - IF a API recusa a ordem com `400` THEN o web SHALL ler o currículo de novo e mostrar a ordem salva. (RES-75, AC 6)
Proof: run web | ✓ RES-75

**C76** - The sortable list SHALL live in `packages/ui`, with a story, and SHALL ship no product copy: the announcements come from the caller. (RES-76, AC 7)
Proof: run ui | ✓ RES-76

**C77** - The member sidebar SHALL show the group "Currículo" with the item "Currículo mestre", marked as current on `/resume`. (RES-77, AC 1)
Proof: run web | ✓ RES-77

**C78** - WHEN o member usa "Abrir currículo" no passo 02 da home THEN o web SHALL abrir `/resume`. (RES-78, AC 2)
Proof: run web | ✓ RES-78

**C79** - WHEN o perfil tem nome e existe ao menos um bullet com uma skill THEN o passo 02 da home SHALL aparecer como "Concluído". (RES-79, AC 3)
Proof: run web | ✓ RES-79

**C80** - WHILE o perfil não tem nome ou nenhum bullet tem skill o passo 02 SHALL aparecer sem "Concluído". (RES-80, AC 4)
Proof: run web | ✓ RES-80

**C81** - IF o member abre `/resume` com uma sessão de admin THEN o web SHALL levá-lo a `/admin`, como as outras rotas do member (AD-005). (RES-81, AC 1)
Proof: run web | ✓ RES-81

**C82** - WHEN o currículo tem 50 itens numa seção THEN o web SHALL desabilitar o "+" do cabeçalho dela. (RES-82, AC 2)
Proof: run web | ✓ RES-82

**C83** - WHEN o item tem 30 bullets THEN o web SHALL desabilitar "+ Bullet" dele. (RES-83, AC 3)
Proof: run web | ✓ RES-83

**C84** - WHEN o perfil tem 5 links THEN o web SHALL desabilitar "+ Link". (RES-84, AC 4)
Proof: run web | ✓ RES-84

**C85** - IF um texto colado passa do limite do campo THEN o web SHALL mostrar o limite no campo e não enviar. (RES-85, AC 5)
Proof: run web | ✓ RES-85

**C86** - WHEN um member chama `GET /resume/summary` THEN a API SHALL responder `200` com `{ ready: true }` se o perfil dele tem nome e ao menos um bullet dele tem uma skill, e `{ ready: false }` caso contrário, sem gravar nada. (RES-86, AC 5)
Proof: run api-integration | ✓ RES-86

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-10 - user: "esse chat vai orquestar os subagents e garantir a qualidade. Utilizar o modelo sonnet 5.5 medium como sub-agente. Para a verificação final usar o opus 5.5"
**Dispatched:** B1 (T1–T7, Sonnet 5.5 medium) at HEAD 9758237, 2026-11-10
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9

Phase 1:  T1 → T2 → T3 → T4
Phase 2:  T5 → T6 → T7
Phase 3:  T8 → T9 → T10 → T11
Phase 4:  T12 → T13 → T14 → T15
Phase 5:  T16 → T17 → T18 → T19
Phase 6:  T20 → T21 → T22 → T23 → T24
Phase 7:  T25 → T26 → T27
Phase 8:  T28 → T29 → T30 → T31 → T32 → T33
Phase 9:  T34 → T35 → T36
```

Execution is strictly sequential - there is no intra-phase parallelism. Lotes sugeridos para sub-agentes (decididos no Execute): B1 fases 1–2 (7), B2 fases 3–4 (8), B3 fases 5–6 (9), B4 fases 7–8 (9), B5 fase 9 (3).
