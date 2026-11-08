# Prumo Design System Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, the Verifier and the screens sub-agent). Neste projeto o fechamento segue `docs/workflow.md#gates-e-tempo`: sem `check_proofs.py` nem `validate_verification.py`.

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/prumo-design-system/design.md`
**Status**: Approved
**Approved**: 2026-11-08 - user: "Aprovo as tasks"
**Build**: `pnpm build; pnpm typecheck; pnpm lint`
**Run ui**: `pnpm --filter @am/ui exec vitest run --reporter=verbose`
**Run web**: `pnpm --filter @am/web exec vitest run --reporter=verbose`
**Run guardrails**: `pnpm --filter @am/guardrails exec vitest run --reporter=verbose`
**Run e2e**: `pnpm test:e2e`

Ambiente: `nvm use 24` antes de qualquer comando e Docker rodando para o E2E.

Convenção dos testes: cada teste que prova um check leva no nome o id do requisito e o número do critério, como `PRU-02 AC01 ...`; a linha esperada de cada proof é `✓ PRU-02 AC01`. Nas stories, o nome da story leva o mesmo id. Na primeira execução real cada linha é conferida com a saída e ajustada só na forma; a afirmação do check nunca muda.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `docs/engineering-guidelines.md`, `docs/design/principles.md`, `docs/design/system/prumo.md`, `docs/workflow.md`, `packages/ui/vitest.config.ts`, `apps/web/vitest.config.ts`, `packages/config/eslint/design-system.js`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Tokens e base CSS (`packages/ui/src/styles`) | unit | Cobertura contra `tokens.json`, valores e contraste calculados | `packages/ui/src/styles/*.test.ts` | `pnpm --filter @am/ui test` |
| Componentes e arquétipos (`packages/ui`) | unit (jsdom) + browser (Chromium) + storybook | Cada critério da spec; medidas e cores no navegador; story por estado nos dois temas | `packages/ui/src/**/*.test.tsx`, `*.browser.test.tsx`, `*.stories.tsx` | `pnpm --filter @am/ui test` |
| Web: telas, model, rotas | unit (Testing Library, MSW) | Cada texto e estado de tela da spec; funções puras com todos os ramos | `apps/web/src/**/*.test.ts(x)` | `pnpm --filter @am/web test` |
| Regras do repositório | unit (`tooling/guardrails`) | Cada violação barrada com arquivo | `tooling/guardrails/src/**/*.test.ts` | `pnpm --filter @am/guardrails test` |
| Jornadas e larguras | e2e (Playwright + compose) | Jornadas de identity, axe e rolagem horizontal a 360 px | `tests/e2e/specs/**/*.spec.ts` | `pnpm test:e2e` |
| Assets e documentos | none | build gate only | - | build gate |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Toda task de código | `pnpm lint && pnpm typecheck && pnpm test` |
| E2E | T34 | `pnpm test:e2e` (local; fora do CI) |
| Build | Fim de fase | `pnpm build && pnpm typecheck && pnpm lint && pnpm test` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks within a phase execute in order.

### Phase 1: Fundação (tokens, fontes, ícones, Storybook)

```
T1 → T2 → T3 → T4
```

### Phase 2: Componentes existentes e Logo

```
T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
```

### Phase 3: Arquétipos existentes

```
T13 → T14 → T15 → T16
```

### Phase 4: Componentes e arquétipos das fases futuras

```
T17 → T18 → T19 → T20 → T21 → T22
```

### Phase 5: Raiz, acesso, shell e home

```
T23 → T24 → T25 → T26 → T27 → T28
```

### Phase 6: Status, admin, convites e fechamento

```
T29 → T30 → T31 → T32 → T33 → T34
```

---

## Task Breakdown

### T1: Tokens do Prumo, tema e a base de CSS

**What**: Tokens do Prumo, tema e a base de CSS.
**Where**: `packages/ui/src/styles/tokens.css`
**Depends on**: None
**Reuses**: `packages/ui/src/styles/tokens.css` (nomes atuais), `docs/design/system/tokens.json` e `tokens.css`
**Requirement**: PRU-01

**Done when**:

- [x] `tokens.css` define todos os tokens do `tokens.json` nos dois temas, mantém os nomes atuais e o accent do Prumo
- [x] Base: `body` 13/20 em `font-sans`, anel de foco de 2 px, `prefers-reduced-motion` e `tabular-nums` em `font-mono`
- [x] Novo projeto `browser` no `vitest.config.ts` (arquivos `*.browser.test.tsx`, Chromium, `tokens.css` carregado) para provar o que o navegador pinta
- [x] `tokens.test.ts` lê `docs/design/system/tokens.json` e confere cobertura, valores, contraste (OKLCH → sRGB, texto 4.5:1, foco e bordas 3:1) e a base
- [x] O commit também inclui `docs/design/system/` e a mudança de `docs/design/principles.md` (hoje não commitados), porque o teste lê o `tokens.json`
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser
**Gate**: quick
**Commit**: `feat(ui): apply the Prumo tokens`

---

### T2: Fontes Geist e Geist Mono auto-hospedadas

**What**: Fontes Geist e Geist Mono auto-hospedadas.
**Where**: `packages/ui/src/styles/tokens.css`
**Depends on**: T1
**Reuses**: `@fontsource-variable/geist` e `geist-mono`
**Requirement**: PRU-01

**Done when**:

- [x] Dependências adicionadas ao catalog/`packages/ui`; `tokens.css` as importa e `font-sans`/`font-mono` começam por Geist com pilha de fallback
- [x] `fonts.test.ts`: os pacotes resolvem, nenhum `http(s)://` aparece no CSS e a família pedida existe nos `@font-face`
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): self-host Geist and Geist Mono`

---

### T3: Wrapper de ícones Lucide

**What**: Wrapper de ícones Lucide.
**Where**: `packages/ui/src/icons/icon.tsx`
**Depends on**: T2
**Reuses**: `lucide-react`
**Requirement**: PRU-01

**Done when**:

- [x] `Icon` interno aplica traço 1.75, 16 px (padrão) ou 14 px (`size="sm"`) e `currentColor`, `aria-hidden`
- [x] `lucide-react` adicionado a `packages/ui`; importação nomeada por ícone
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): add the Lucide icon wrapper`

---

### T4: Story de tokens e verificação do Storybook

**What**: Story de tokens e verificação do Storybook.
**Where**: `packages/ui/src/styles/Tokens.stories.tsx`
**Depends on**: T3
**Reuses**: `packages/ui/.storybook/preview.ts`, `packages/ui/src/testing/contrast.ts`
**Requirement**: PRU-08

**Done when**:

- [x] Story "Tokens" mostra cores, escala de tipo, espaço, raios, sombra e tamanhos nos dois temas
- [x] Helper `expectContrast` em `testing/` para os plays das stories
- [x] `preview.ts` segue carregando `tokens.css` (com as fontes) e alternando `data-theme`; um teste de story confere a fonte aplicada e o atributo
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: storybook
**Gate**: quick
**Commit**: `feat(ui): add the tokens story`

---

### T5: Button com intent ghost e tamanhos do Prumo

**What**: Button com intent ghost e tamanhos do Prumo.
**Where**: `packages/ui/src/components/button/`
**Depends on**: None
**Reuses**: `button.tsx`, `Button.stories.tsx`
**Requirement**: PRU-02

**Done when**:

- [x] Intents `primary`, `secondary`, `ghost`, `danger`; `h-control-md` / `h-control-sm`; desabilitado a 50 %; texto `on-accent` em `primary` e `danger`; `asChild` mantido
- [x] Testes `button.test.tsx` e `button.browser.test.tsx` (alturas medidas no navegador); stories claro/escuro com contraste e foco
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle Button and add the ghost intent`

---

### T6: Alert com intent warning, ícone e ação

**What**: Alert com intent warning, ícone e ação.
**Where**: `packages/ui/src/components/alert/`
**Depends on**: T5
**Reuses**: `alert.tsx`
**Requirement**: PRU-02

**Done when**:

- [x] Intents `danger`/`info`/`warning` com fundo, ícone e `role` certos; prop `action` à direita
- [x] Testes de papel, ícone e ação; stories dos três intents nos dois temas com contraste
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle Alert and add the warning intent`

---

### T7: Field: Textarea, somente leitura e erro com ícone

**What**: Field: Textarea, somente leitura e erro com ícone.
**Where**: `packages/ui/src/components/field/`
**Depends on**: T6
**Reuses**: `field.tsx`
**Requirement**: PRU-02

**Done when**:

- [x] `Field.Textarea` com a mesma fiação de ids e `aria-*`; altura mínima de 88 px
- [x] `Field.Control` no padrão do Prumo (borda `border-control`, inválido em `danger`, somente leitura em `surface-raised`); `Field.Error` com ícone
- [x] Testes e stories (padrão, dica, erro, somente leitura, textarea) nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle Field and add Textarea`

---

### T8: Field.PasswordControl com mostrar e ocultar

**What**: Field.PasswordControl com mostrar e ocultar.
**Where**: `packages/ui/src/components/field/password-control.tsx`
**Depends on**: T7
**Reuses**: `field.tsx` (`useField`), `Button`, `Icon`
**Requirement**: PRU-03

**Done when**:

- [x] `Field.PasswordControl` com `toggleLabel` (rótulo fixo nos dois estados), começa oculto, `aria-pressed`, mantém valor e cursor, `autoComplete` e `aria-*`; botão `type="button"` que não vai no envio; desabilitado junto com o campo
- [x] Testes unit e de teclado (Tab/Enter/Space) e story "Senha" nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add Field.PasswordControl`

---

### T9: StatusBadge com ponto e fundo transparente

**What**: StatusBadge com ponto e fundo transparente.
**Where**: `packages/ui/src/components/status-badge/`
**Depends on**: T8
**Reuses**: `status-badge.tsx`
**Requirement**: PRU-02

**Done when**:

- [x] Ponto antes do texto, borda e texto na cor do intent, fundo transparente
- [x] Testes e stories dos dois intents nos dois temas com contraste
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle StatusBadge`

---

### T10: CopyField no padrão do Prumo

**What**: CopyField no padrão do Prumo.
**Where**: `packages/ui/src/components/copy-field/`
**Depends on**: T9
**Reuses**: `copy-field.tsx`
**Requirement**: PRU-02

**Done when**:

- [x] Valor em `font-mono` sobre `surface-raised`, seleção no foco, `Check` ao copiar, `Alert danger` na falha mantendo o valor selecionável
- [x] Testes e stories (padrão, copiado, falha) nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle CopyField`

---

### T11: ConfirmDialog no padrão do Prumo

**What**: ConfirmDialog no padrão do Prumo.
**Where**: `packages/ui/src/components/confirm-dialog/`
**Depends on**: T10
**Reuses**: `confirm-dialog.tsx`
**Requirement**: PRU-02

**Done when**:

- [x] Superfície `surface-overlay`, `border-strong`, `radius-lg`, `shadow-overlay`, largura máx. 440 px e véu `backdrop`; `Esc` e foco preservados
- [x] Testes (Esc não confirma, foco preso, medidas no navegador) e stories nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle ConfirmDialog`

---

### T12: Logo (símbolo e logotipo)

**What**: Logo (símbolo e logotipo).
**Where**: `packages/ui/src/components/logo/`
**Depends on**: T11
**Reuses**: `docs/design/system/assets/logos/rumo-mark.svg`
**Requirement**: PRU-05

**Done when**:

- [x] `Logo` com `variant` `mark`/`wordmark`, `tone`, `title` opcional (`aria-hidden` sem ele), espaço de meio símbolo, "rumo" 600 e "carreira" 400 em minúsculas
- [x] Testes e stories do símbolo e do logotipo em todas as cores permitidas sobre `surface`, `surface-raised` e bloco `accent`
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add the Logo component`

---

### T13: AppShell no padrão do Prumo

**What**: AppShell no padrão do Prumo.
**Where**: `packages/ui/src/layouts/app-shell/`
**Depends on**: None
**Reuses**: `app-shell.tsx`, `Logo`, `Icon`
**Requirement**: PRU-04

**Done when**:

- [x] Partes `Sidebar`, `Brand`, `Section`, `NavItem` (ícone, contagem, `current`, `asChild`), `User`, `Topbar` e `Main` (`asChild`); `Root`/`Sidebar`/`NavItem`/`Main` mantêm nome e props
- [x] 232 px, `surface-raised`, `NavItem` de 30 px, topbar de 48 px; abaixo de `md` vira barra superior sem rolagem horizontal
- [x] Testes unit/browser e stories (member, admin, estreito) nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle AppShell`

---

### T14: AuthPage no padrão do Prumo

**What**: AuthPage no padrão do Prumo.
**Where**: `packages/ui/src/layouts/auth-page/`
**Depends on**: T13
**Reuses**: `auth-page.tsx`, `Logo`
**Requirement**: PRU-04

**Done when**:

- [x] Coluna de 360 px um pouco acima do centro, sem card; `Header` com símbolo de 20 px, `Form` com gap 16 px, `Footer` com filete; alertas entre header e primeiro campo
- [x] Testes e stories (entrar, convite, acesso) nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle AuthPage`

---

### T15: ListPage com cabeçalho de grupo e linhas do Prumo

**What**: ListPage com cabeçalho de grupo e linhas do Prumo.
**Where**: `packages/ui/src/layouts/list-page/`
**Depends on**: T14
**Reuses**: `list-page.tsx`
**Requirement**: PRU-04

**Done when**:

- [x] `Header` (título, contagem `font-mono`, ação), `Filters` (`role=search`), `Group` de 36 px, `Row` ≥ 40 px com hover e `selected`, `RowMeta` em coluna fixa; partes atuais mantidas
- [x] Testes e stories (lista, grupos, estreito) nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle ListPage`

---

### T16: DashboardPage com grade de 12 colunas e Widget

**What**: DashboardPage com grade de 12 colunas e Widget.
**Where**: `packages/ui/src/layouts/dashboard-page/`
**Depends on**: T15
**Reuses**: `dashboard-page.tsx`
**Requirement**: PRU-04

**Done when**:

- [x] `Root` com padding 24 px e largura máx. 1120 px, `Header`, `Grid` de 12 colunas e `Widget` com `span`, `Widget.Header`, `Widget.Title`, `Widget.Action`
- [x] `public-api.test.ts` trava os nomes de partes e props que o web usa hoje em seis componentes e quatro arquétipos
- [x] Testes e stories nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): restyle DashboardPage and add Widget`

---

### T17: Kbd

**What**: Kbd.
**Where**: `packages/ui/src/components/kbd/`
**Depends on**: None
**Reuses**: tokens
**Requirement**: PRU-07

**Done when**:

- [x] `<kbd>` mono 11 px, 18 px de altura, borda `border-strong` sobre `surface-raised`; dentro de `Button primary` herda `on-accent`
- [x] Testes e stories nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add Kbd`

---

### T18: EmptyState

**What**: EmptyState.
**Where**: `packages/ui/src/components/empty-state/`
**Depends on**: T17
**Reuses**: tokens, `Button`
**Requirement**: PRU-07

**Done when**:

- [x] Caixa tracejada `border-strong`, `radius-md`, texto `text-muted` do chamador e ação opcional, sem ilustração
- [x] Testes e stories nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add EmptyState`

---

### T19: PipelineStatus

**What**: PipelineStatus.
**Where**: `packages/ui/src/components/pipeline-status/`
**Depends on**: T18
**Reuses**: `Icon`, tokens `status-*`
**Requirement**: PRU-07

**Done when**:

- [x] Oito status, cada um com ícone SVG próprio de 14 px e cor `status-*`; `label` ao lado ou `aria-label` com `iconOnly`
- [x] Teste prova que os oito ícones são distintos entre si; stories dos oito nos dois temas com contraste de 3:1
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add PipelineStatus`

---

### T20: SkillTag

**What**: SkillTag.
**Where**: `packages/ui/src/components/skill-tag/`
**Depends on**: T19
**Reuses**: `Icon`, tokens
**Requirement**: PRU-07

**Done when**:

- [x] Variantes `required`, `nice`, `private`, `match` de 22 px; `onRemove` com `removeLabel` do chamador
- [x] Testes e stories nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add SkillTag`

---

### T21: DetailPage

**What**: DetailPage.
**Where**: `packages/ui/src/layouts/detail-page/`
**Depends on**: T20
**Reuses**: `dashboard-page.tsx` (padrão de `main`)
**Requirement**: PRU-07

**Done when**:

- [x] `Root` (`main`), `Main`, `Sidebar` (`aria-label` obrigatório, 280 px) e `Property` com nome `caption` e valor de 28 px com hover
- [x] Testes e stories nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add DetailPage`

---

### T22: FormPage

**What**: FormPage.
**Where**: `packages/ui/src/layouts/form-page/`
**Depends on**: T21
**Reuses**: `detail-page`
**Requirement**: PRU-07

**Done when**:

- [x] `Root` (`main`), `Index` (`nav` de 200 px, sticky), `Section` (`heading-md` e área de ações) em largura de leitura de 720 px, `Actions`
- [x] `no-product-copy.test.tsx`: nenhum componente futuro renderiza texto próprio sem filhos ou props do chamador
- [x] Testes e stories nos dois temas
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit + browser + storybook
**Gate**: quick
**Commit**: `feat(ui): add FormPage`

---

### T23: Raiz do web: título, favicon e ícone de app

**What**: Raiz do web: título, favicon e ícone de app.
**Where**: `apps/web/src/routes/__root.tsx`
**Depends on**: None
**Reuses**: `docs/design/system/assets/logos/`
**Requirement**: PRU-05

**Done when**:

- [x] `<title>` "Rumo Carreira"; `<link>` do favicon (que segue o tema) e do ícone de app, servidos de `apps/web/public/`
- [x] Teste do `head` da raiz e guard-rail `no-old-name.test.ts` em `tooling/guardrails` que falha se "Application Manager" aparecer no código do web ou de `packages/ui`
- [x] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web) + guardrails
**Gate**: quick
**Commit**: `feat(web): set the Rumo Carreira title, favicon and app icon`

---

### T24: Mensagens e telas de acesso

**What**: Mensagens e telas de acesso.
**Where**: `apps/web/src/features/identity/components/AccessScreens.tsx`
**Depends on**: T23
**Reuses**: `messages.ts`, `AuthPage`, `Alert`, `Button`
**Requirement**: PRU-06

**Done when**:

- [ ] `MESSAGES` troca só as frases que as cartas redizem (sessão expirada, convite inválido, sem acesso, indisponível); os testes de identity mudam só essas frases
- [ ] Telas "Sem acesso" (título, mensagem, "Voltar para o início", "Sair") e "Indisponível" (mensagem, "Tentar novamente") e "Convite inválido" sem formulário em `AuthPage`
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): redo the access screens`

---

### T25: Tela de login

**What**: Tela de login.
**Where**: `apps/web/src/features/identity/components/LoginForm.tsx`
**Depends on**: T24
**Reuses**: `LoginForm.tsx`, `Field.PasswordControl`
**Requirement**: PRU-06

**Done when**:

- [ ] Layout de `PageLogin`: símbolo, "Entrar", linha do produto, alertas acima dos campos, botão de largura total, rodapé; `/admin/login` com o título da administração
- [ ] Campo de senha com mostrar/ocultar (rótulo fixo "Mostrar senha"), estado mantido após erro
- [ ] Testes de `LoginForm` atualizados nas frases e novos para o rodapé e a senha
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): redo the login screen with show and hide password`

---

### T26: Tela de convite

**What**: Tela de convite.
**Where**: `apps/web/src/features/identity/components/AcceptInvitationForm.tsx`
**Depends on**: T25
**Reuses**: `AcceptInvitationForm.tsx`, `formatDate` de `model/dates.ts`
**Requirement**: PRU-06

**Done when**:

- [ ] Layout de `PageInvite`: "Criar conta", "Você recebeu um convite para o Rumo Carreira.", e-mail somente leitura, dica da senha antes do erro, rodapé "O convite vale até {data}."
- [ ] `model/dates.ts` com a formatação pt-BR em `America/Sao_Paulo` (função pura e testada)
- [ ] Senha com mostrar/ocultar; testes atualizados
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): redo the invitation screen`

---

### T27: Shell do member e do admin

**What**: Shell do member e do admin.
**Where**: `apps/web/src/features/identity/components/SessionMenu.tsx`
**Depends on**: T26
**Reuses**: `routes/_member.tsx`, `routes/admin/_protected.tsx`, `AppShell`
**Requirement**: PRU-06

**Done when**:

- [ ] `SessionMenu` vira `AppShell.User` (iniciais, nome, "Sair") com a falha em `Alert`; ausência de nome → sem iniciais
- [ ] `_member.tsx` mostra `Brand` e Início; `_protected.tsx` mostra `Brand` com tag "admin", Painel, Convites e Status do sistema (link para `/status`)
- [ ] Testes de rota e de `SessionMenu` atualizados
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): compose the member and admin shells`

---

### T28: Home do member

**What**: Home do member.
**Where**: `apps/web/src/routes/_member/index.tsx`
**Depends on**: T27
**Reuses**: `DashboardPage`, `EmptyState`
**Requirement**: PRU-06

**Done when**:

- [ ] h1 "Início", "Olá, {nome}", três passos e `EmptyState` sem a dica do ⌘K e sem botões
- [ ] Teste de rota para o nome, os passos e a ausência do nome
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): redo the member home`

---

### T29: Modelo do status com instante de leitura

**What**: Modelo do status com instante de leitura.
**Where**: `apps/web/src/features/system-status/model/system-status.ts`
**Depends on**: None
**Reuses**: `get-system-status.ts`
**Requirement**: PRU-06

**Done when**:

- [ ] `SystemStatus.checkedAt` (ISO) preenchido por `loadSystemStatus` com relógio injetável; veredito e ordem dos itens (degradado: afetado primeiro) em função pura testada
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): stamp the status with the read time`

---

### T30: Página de status e widget de status do painel

**What**: Página de status e widget de status do painel.
**Where**: `apps/web/src/features/system-status/components/StatusPanel.tsx`
**Depends on**: T29
**Reuses**: `StatusPanel.tsx`, `routes/status.tsx`, `Logo`
**Requirement**: PRU-06

**Done when**:

- [ ] `/status` fora do shell: coluna de 560 px, logotipo, h1 "Status", veredito, "Verificado às {hora} de {data}." e linhas com `StatusBadge`; degradado → "Serviço degradado" e item afetado no topo em `danger`
- [ ] Widget de status do painel (`StatusWidgets`) com `StatusBadge`, API, banco e horário
- [ ] Testes de `StatusPanel` e de rota
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): redo the status page`

---

### T31: Painel do admin e widget de convites

**What**: Painel do admin e widget de convites.
**Where**: `apps/web/src/features/identity/components/InvitationSummary.tsx`
**Depends on**: T30
**Reuses**: `InvitationSummary.tsx`, `routes/admin/_protected/index.tsx`
**Requirement**: PRU-06

**Done when**:

- [ ] h1 "Administração", widget "Convites pendentes" com número em `heading-xl`, expiração do mais antigo, "Ver convites" e "Convidar pessoa" (para `/admin/invitations`), sem expiração com 0
- [ ] Falha da API → `StatusBadge unavailable` mantido; testes
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): redo the admin dashboard`

---

### T32: Expiração dos convites como regra testada

**What**: Expiração dos convites como regra testada.
**Where**: `apps/web/src/features/identity/model/expiry.ts`
**Depends on**: T31
**Reuses**: `dates.ts`
**Requirement**: PRU-06

**Done when**:

- [ ] Função pura `daysLeft(expiresAt, now)` (teto dos dias restantes) e `isUrgent(days)` (≤ 2) com relógio injetável; `expiresAt` inválido → sem texto
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): compute invitation expiry`

---

### T33: Tela de convites

**What**: Tela de convites.
**Where**: `apps/web/src/features/identity/components/InvitationsPanel.tsx`
**Depends on**: T32
**Reuses**: `InvitationsPanel.tsx`, `ListPage`, `CopyField`, `ConfirmDialog`, `EmptyState`
**Requirement**: PRU-06

**Done when**:

- [ ] Título "Convites" com "{n} pendentes", formulário na linha de filtros, faixa do link recém-criado com nota, grupo "Pendentes", linhas com expiração (`warning` com ≤ 2 dias), "Revogar" `ghost` com `ConfirmDialog`, `EmptyState` vazio e `Alert danger` na falha
- [ ] Foco, 409, 404 e `401` como hoje; testes atualizados
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test`

**Tests**: unit (web)
**Gate**: quick
**Commit**: `feat(web): redo the invitations screen`

---

### T34: E2E, 360 px e documentos

**What**: E2E, 360 px e documentos.
**Where**: `tests/e2e/specs/browser/identity.spec.ts`
**Depends on**: T33
**Reuses**: `identity.spec.ts`, `docs/design/system/README.md`, `docs/design/principles.md`
**Requirement**: PRU-06

**Done when**:

- [ ] E2E atualizado nas frases que mudaram, com a jornada de mostrar/ocultar senha e a varredura axe e de rolagem horizontal a 360 px nos dois temas
- [ ] `docs/design/system/README.md` e `docs/design/principles.md` passam a dizer que o Prumo está aplicado
- [ ] Gate passa: `pnpm lint && pnpm typecheck && pnpm test` e `pnpm test:e2e` (local)

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(e2e): cover the Prumo screens and update the design docs`

---

## Checks

**C1** - Todo token do `tokens.json` existe em `tokens.css` nos temas claro e escuro (PRU-01, AC 1)
Proof: run ui | ✓ PRU-01 AC01

**C2** - Os 13 nomes de token atuais seguem definidos (PRU-01, AC 2)
Proof: run ui | ✓ PRU-01 AC02

**C3** - `accent` vale `oklch(0.5 0.08 195)` no claro e `oklch(0.74 0.105 195)` no escuro (PRU-01, AC 3)
Proof: run ui | ✓ PRU-01 AC03

**C4** - A paleta padrão do Tailwind continua removida (`--color-*: initial`) (PRU-01, AC 4)
Proof: run ui | ✓ PRU-01 AC04

**C5** - Com `prefers-color-scheme: dark` e sem `data-theme=light` o tema escuro vale (PRU-01, AC 5)
Proof: run ui | ✓ PRU-01 AC05

**C6** - `data-theme` `light` ou `dark` força o tema, qualquer que seja a preferência do sistema (PRU-01, AC 6)
Proof: run ui | ✓ PRU-01 AC06

**C7** - Todo par texto/fundo listado passa 4.5:1 nos dois temas (PRU-01, AC 7)
Proof: run ui | ✓ PRU-01 AC07

**C8** - `focus`, `border-control` e cada `status-*` passam 3:1 sobre as superfícies, nos dois temas (PRU-01, AC 8)
Proof: run ui | ✓ PRU-01 AC08

**C9** - Geist e Geist Mono saem de pacotes locais, sem URL de terceiro no CSS (PRU-01, AC 9)
Proof: run ui | ✓ PRU-01 AC09

**C10** - O texto base é 13/20 e a escala de 8 estilos tem os tamanhos do `tokens.json` (PRU-01, AC 10)
Proof: run ui | ✓ PRU-01 AC10

**C11** - Os ícones usam traço 1.75, 16 px ou 14 px e `currentColor` (PRU-01, AC 11)
Proof: run ui | ✓ PRU-01 AC11

**C12** - Com `prefers-reduced-motion` nenhuma transição ou animação corre (PRU-01, AC 12)
Proof: run ui | ✓ PRU-01 AC12

**C13** - O foco por teclado desenha anel sólido de 2 px em `focus` com 2 px de afastamento (PRU-01, AC 13)
Proof: run ui | ✓ PRU-01 AC13

**C14** - `Button` aceita `primary`, `secondary`, `ghost`, `danger`, com `primary` por padrão (PRU-02, AC 1)
Proof: run ui | ✓ PRU-02 AC01

**C15** - `Button` mede 32 px por padrão e 28 px com `size=sm` (PRU-02, AC 2)
Proof: run ui | ✓ PRU-02 AC02

**C16** - `Button` desabilitado fica a 50 % de opacidade e ignora cliques (PRU-02, AC 3)
Proof: run ui | ✓ PRU-02 AC03

**C17** - `Button` `primary` e `danger` usam `on-accent` no rótulo (PRU-02, AC 4)
Proof: run ui | ✓ PRU-02 AC04

**C18** - `Button asChild` renderiza o filho com as classes e atributos do botão (PRU-02, AC 5)
Proof: run ui | ✓ PRU-02 AC05

**C19** - `Alert` tem os intents `danger`, `info`, `warning` com ícone e fundo próprios (PRU-02, AC 6)
Proof: run ui | ✓ PRU-02 AC06

**C20** - `Alert danger` tem `role=alert` e os demais `role=status` (PRU-02, AC 7)
Proof: run ui | ✓ PRU-02 AC07

**C21** - `Alert` mostra a `action` na extremidade direita (PRU-02, AC 8)
Proof: run ui | ✓ PRU-02 AC08

**C22** - `Field.Textarea` liga ids e `aria-*` como o controle e tem 88 px de altura mínima (PRU-02, AC 9)
Proof: run ui | ✓ PRU-02 AC09

**C23** - Campo inválido tem borda `danger` e `Field.Error` com mensagem e ícone (PRU-02, AC 10)
Proof: run ui | ✓ PRU-02 AC10

**C24** - Controle `readOnly` usa `surface-raised` e texto `text-muted` (PRU-02, AC 11)
Proof: run ui | ✓ PRU-02 AC11

**C25** - `StatusBadge` mostra ponto, borda e texto na cor do intent e fundo transparente (PRU-02, AC 12)
Proof: run ui | ✓ PRU-02 AC12

**C26** - `CopyField` mostra o valor em `font-mono` sobre `surface-raised` e seleciona tudo ao receber foco (PRU-02, AC 13)
Proof: run ui | ✓ PRU-02 AC13

**C27** - `CopyField` com status `copied` mostra `copiedLabel` com `Check` (PRU-02, AC 14)
Proof: run ui | ✓ PRU-02 AC14

**C28** - `CopyField` com status `failed` mostra `Alert danger` e mantém o valor selecionável (PRU-02, AC 15)
Proof: run ui | ✓ PRU-02 AC15

**C29** - `ConfirmDialog` usa `surface-overlay`, `border-strong`, `radius-lg`, `shadow-overlay`, 440 px de largura máxima e véu `backdrop` (PRU-02, AC 16)
Proof: run ui | ✓ PRU-02 AC16

**C30** - `Esc` fecha o `ConfirmDialog` sem chamar `onConfirm` (PRU-02, AC 17)
Proof: run ui | ✓ PRU-02 AC17

**C31** - O foco fica preso no `ConfirmDialog` aberto (PRU-02, AC 18)
Proof: run ui | ✓ PRU-02 AC18

**C32** - Props e partes dos seis componentes que o web usa seguem com os mesmos nomes (PRU-02, AC 19)
Proof: run ui | ✓ PRU-02 AC19

**C33** - `Field.PasswordControl` renderiza o controle e o botão de alternar (PRU-03, AC 1)
Proof: run ui | ✓ PRU-03 AC01

**C34** - A senha começa oculta (`type=password`) (PRU-03, AC 2)
Proof: run ui | ✓ PRU-03 AC02

**C35** - Alternar troca `password`/`text` e mantém o valor e o cursor (PRU-03, AC 3)
Proof: run ui | ✓ PRU-03 AC03

**C36** - O botão é `type=button`, com `aria-pressed` e `aria-label` do chamador (PRU-03, AC 4)
Proof: run ui | ✓ PRU-03 AC04

**C37** - O botão de alternar não vai como campo no envio do formulário (PRU-03, AC 5)
Proof: run ui | ✓ PRU-03 AC05

**C38** - Com a senha visível, `autoComplete`, `aria-describedby` e `aria-invalid` não mudam (PRU-03, AC 6)
Proof: run ui | ✓ PRU-03 AC06

**C39** - Campo desabilitado desabilita o botão de alternar (PRU-03, AC 7)
Proof: run ui | ✓ PRU-03 AC07

**C40** - `/login`, `/admin/login` e `/invite/$token` usam o campo com o rótulo "Mostrar senha" nos dois estados (PRU-03, AC 8)
Proof: run web | ✓ PRU-03 AC08

**C41** - Após um envio com erro o estado do botão e o valor digitado se mantêm (PRU-03, AC 9)
Proof: run web | ✓ PRU-03 AC09

**C42** - O botão é alcançado por `Tab` logo após o campo e opera com `Enter` e `Space` (PRU-03, AC 10)
Proof: run ui | ✓ PRU-03 AC10

**C43** - `AppShell.Sidebar` mede 232 px sobre `surface-raised` com borda direita e `aria-label` do chamador (PRU-04, AC 1)
Proof: run ui | ✓ PRU-04 AC01

**C44** - A sidebar mostra, em ordem, `Logo`, navegação por seção e a pessoa com a ação de sair (PRU-04, AC 2)
Proof: run ui | ✓ PRU-04 AC02

**C45** - `NavItem` mede 30 px, mostra ícone, rótulo e contagem mono, e o atual usa `accent-subtle`/`accent-text` com `aria-current=page` (PRU-04, AC 3)
Proof: run ui | ✓ PRU-04 AC03

**C46** - Com `asChild` o `NavItem` e o `Main` entregam suas classes ao filho e a página mantém um único `main` (PRU-04, AC 4)
Proof: run ui | ✓ PRU-04 AC04

**C47** - Abaixo de `md` a sidebar vira barra no topo, sem rolagem horizontal (PRU-04, AC 5)
Proof: run ui | ✓ PRU-04 AC05

**C48** - A topbar de 48 px tem título à esquerda e ações à direita (PRU-04, AC 6)
Proof: run ui | ✓ PRU-04 AC06

**C49** - `AuthPage.Root` é um `main` de fundo `surface` com coluna de 360 px acima do centro, sem card (PRU-04, AC 7)
Proof: run ui | ✓ PRU-04 AC07

**C50** - `AuthPage` tem `Header` (símbolo de 20 px), `Form` (gap 16 px) e `Footer` (filete e nota), com alertas entre header e primeiro campo (PRU-04, AC 8)
Proof: run ui | ✓ PRU-04 AC08

**C51** - `ListPage.Header` mostra título `heading-md`, contagem mono e a ação primária `sm` à direita (PRU-04, AC 9)
Proof: run ui | ✓ PRU-04 AC09

**C52** - `ListPage.Filters` é `role=search` e exige `aria-label` (PRU-04, AC 10)
Proof: run ui | ✓ PRU-04 AC10

**C53** - `ListPage.Group` mede 36 px sobre `surface-raised` com rótulo e contagem (PRU-04, AC 11)
Proof: run ui | ✓ PRU-04 AC11

**C54** - `ListPage.Row` tem 40 px no mínimo, hover `surface-hover`, selecionada `accent-subtle` e metadados em colunas fixas (PRU-04, AC 12)
Proof: run ui | ✓ PRU-04 AC12

**C55** - `DashboardPage` tem `main` com 24 px de padding e 1120 px de largura máxima, `h1` `heading-lg` e grade de 12 colunas com gap 16 px (PRU-04, AC 13)
Proof: run ui | ✓ PRU-04 AC13

**C56** - `DashboardPage.Widget` tem `surface`, `border`, `radius-md`, padding 16 px, título `heading-sm`, ação `ghost` e os spans 3 a 12 (PRU-04, AC 14)
Proof: run ui | ✓ PRU-04 AC14

**C57** - Os quatro arquétipos seguem com as partes e props que o web usa hoje (PRU-04, AC 15)
Proof: run ui | ✓ PRU-04 AC15

**C58** - `Logo` oferece `mark` em SVG `currentColor` e `wordmark` com "rumo" 600, "carreira" 400, minúsculas (PRU-05, AC 1)
Proof: run ui | ✓ PRU-05 AC01

**C59** - No logotipo "rumo" usa `text`, "carreira" usa `text-muted` e o espaço é meio símbolo (PRU-05, AC 2)
Proof: run ui | ✓ PRU-05 AC02

**C60** - O símbolo usa `accent` e é `aria-hidden` sem rótulo do chamador (PRU-05, AC 3)
Proof: run ui | ✓ PRU-05 AC03

**C61** - Com uma cor única do chamador símbolo e texto a usam (PRU-05, AC 4)
Proof: run ui | ✓ PRU-05 AC04

**C62** - O `head` do web liga o favicon que segue o tema e o ícone de app (PRU-05, AC 5)
Proof: run web | ✓ PRU-05 AC05

**C63** - O `<title>` do documento é "Rumo Carreira" (PRU-05, AC 6)
Proof: run web | ✓ PRU-05 AC06

**C64** - `AuthPage.Header` mostra o símbolo de 20 px, a sidebar e `/status` mostram o logotipo (PRU-05, AC 7)
Proof: run ui | ✓ PRU-05 AC07

**C65** - `/login` mostra a tela de `PageLogin` com o texto da carta (PRU-06, AC 1)
Proof: run web | ✓ PRU-06 AC01

**C66** - `/admin/login` usa o mesmo layout com o título da administração (PRU-06, AC 2)
Proof: run web | ✓ PRU-06 AC02

**C67** - `?reason=expired` mostra `Alert info` "Sua sessão expirou. Entre de novo para continuar." acima dos campos (PRU-06, AC 3)
Proof: run web | ✓ PRU-06 AC03

**C68** - Credencial errada mostra `Alert danger` "E-mail ou senha incorretos." e mantém o digitado (PRU-06, AC 4)
Proof: run web | ✓ PRU-06 AC04

**C69** - Bloqueio 429 mostra o alerta com o tempo de espera no mesmo lugar (PRU-06, AC 5)
Proof: run web | ✓ PRU-06 AC05

**C70** - O botão "Entrar" fica desabilitado enquanto a chamada está aberta (PRU-06, AC 6)
Proof: run web | ✓ PRU-06 AC06

**C71** - `/invite/$token` mostra a tela de `PageInvite` com o e-mail somente leitura, a dica e a data de `expiresAt` (PRU-06, AC 7)
Proof: run web | ✓ PRU-06 AC07

**C72** - Senha fora da regra mostra "A senha precisa ter de 12 a 128 caracteres." sob o campo e mantém a dica (PRU-06, AC 8)
Proof: run web | ✓ PRU-06 AC08

**C73** - Convite expirado, usado, revogado ou desconhecido (410) mostra "Convite inválido" sem formulário (PRU-06, AC 9)
Proof: run web | ✓ PRU-06 AC09

**C74** - Member em `/admin` vê "Sem acesso" com a mensagem da carta, "Voltar para o início" e "Sair" (PRU-06, AC 10)
Proof: run web | ✓ PRU-06 AC10

**C75** - API fora do ar num guard mostra "Indisponível", mantém a URL e oferece "Tentar novamente" (PRU-06, AC 11)
Proof: run web | ✓ PRU-06 AC11

**C76** - `/` mostra o `PageMemberHome` com h1, saudação, três passos e `EmptyState` (PRU-06, AC 12)
Proof: run web | ✓ PRU-06 AC12

**C77** - O shell do member mostra logotipo, Início atual e pessoa com "Sair" (PRU-06, AC 13)
Proof: run web | ✓ PRU-06 AC13

**C78** - `/admin` mostra os widgets de status e de convites pendentes da carta (PRU-06, AC 14)
Proof: run web | ✓ PRU-06 AC14

**C79** - O shell do admin mostra logotipo com "admin", Painel, Convites, Status do sistema e a pessoa (PRU-06, AC 15)
Proof: run web | ✓ PRU-06 AC15

**C80** - `/admin/invitations` mostra o título com a contagem, o formulário, o grupo "Pendentes" e as linhas (PRU-06, AC 16)
Proof: run web | ✓ PRU-06 AC16

**C81** - Criar convite mostra a faixa com a nota e o `CopyField` com o link (PRU-06, AC 17)
Proof: run web | ✓ PRU-06 AC17

**C82** - A linha do convite mostra e-mail, "expira em {n} d" em `warning` com 2 dias ou menos e "Revogar" `ghost` (PRU-06, AC 18)
Proof: run web | ✓ PRU-06 AC18

**C83** - "Revogar" abre o `ConfirmDialog` com o e-mail e só revoga ao confirmar (PRU-06, AC 19)
Proof: run web | ✓ PRU-06 AC19

**C84** - "Convidar pessoa" no widget leva a `/admin/invitations` (PRU-06, AC 20)
Proof: run web | ✓ PRU-06 AC20

**C85** - `/status` mostra a `PageStatus` fora do shell com veredito, "Verificado às" e as linhas (PRU-06, AC 21)
Proof: run web | ✓ PRU-06 AC21

**C86** - Com componente indisponível `/status` diz "Serviço degradado" e põe o afetado no topo em `danger` (PRU-06, AC 22)
Proof: run web | ✓ PRU-06 AC22

**C87** - Nenhuma tela, `<title>` ou componente diz "Application Manager" (PRU-06, AC 23)
Proof: run guardrails | ✓ PRU-06 AC23

**C88** - A lista de convites vazia mostra o `EmptyState` com a ação de convidar (PRU-06, AC 24)
Proof: run web | ✓ PRU-06 AC24

**C89** - Falha ao carregar lista ou widget mostra `Alert danger` e mantém a página (PRU-06, AC 25)
Proof: run web | ✓ PRU-06 AC25

**C90** - Redirecionamentos, guards, formulários, chamadas e status das telas seguem como antes (PRU-06, AC 26)
Proof: run e2e | ✓ PRU-06 AC26

**C91** - A 360 px as telas não têm rolagem horizontal nem controle inalcançável (PRU-06, AC 27)
Proof: run e2e | ✓ PRU-06 AC27

**C92** - `Kbd` é um `kbd` mono 11 px de 18 px de altura com `border-strong` sobre `surface-raised` (PRU-07, AC 1)
Proof: run ui | ✓ PRU-07 AC01

**C93** - `Kbd` dentro de `Button primary` usa `on-accent` no texto e na borda (PRU-07, AC 2)
Proof: run ui | ✓ PRU-07 AC02

**C94** - `EmptyState` tem borda tracejada `border-strong`, `radius-md`, frase do chamador e ação opcional, sem ilustração (PRU-07, AC 3)
Proof: run ui | ✓ PRU-07 AC03

**C95** - `PipelineStatus` aceita os oito status, cada um com ícone próprio de 14 px na cor `status-*` (PRU-07, AC 4)
Proof: run ui | ✓ PRU-07 AC04

**C96** - `PipelineStatus` mostra o rótulo ao lado, ou só o ícone com `aria-label` em `iconOnly` (PRU-07, AC 5)
Proof: run ui | ✓ PRU-07 AC05

**C97** - Os oito status se distinguem sem cor, por ícone e rótulo (PRU-07, AC 6)
Proof: run ui | ✓ PRU-07 AC06

**C98** - `SkillTag` mede 22 px e tem as variantes `required`, `nice`, `private`, `match` (PRU-07, AC 7)
Proof: run ui | ✓ PRU-07 AC07

**C99** - `SkillTag` com `onRemove` mostra o botão com `aria-label` do chamador e chama `onRemove` uma vez (PRU-07, AC 8)
Proof: run ui | ✓ PRU-07 AC08

**C100** - `DetailPage` tem `main`, `Main` e `Sidebar` de 280 px com `aria-label` obrigatório e propriedades de 28 px (PRU-07, AC 9)
Proof: run ui | ✓ PRU-07 AC09

**C101** - `FormPage` tem `main`, índice `nav` de 200 px sticky e `Section` em 720 px (PRU-07, AC 10)
Proof: run ui | ✓ PRU-07 AC10

**C102** - Os componentes futuros não trazem texto de produto (PRU-07, AC 11)
Proof: run ui | ✓ PRU-07 AC11

**C103** - Todo componente e arquétipo de `packages/ui` tem story (PRU-08, AC 1)
Proof: run ui | ✓ PRU-08 AC01

**C104** - O Storybook carrega os tokens e as fontes e alterna claro e escuro por `data-theme` (PRU-08, AC 2)
Proof: run ui | ✓ PRU-08 AC02

**C105** - Toda story de componente ou arquétipo tem uma story de contraste no tema claro e no escuro (PRU-08, AC 3)
Proof: run ui | ✓ PRU-08 AC03

**C106** - Cada componente mostra seus estados como stories (PRU-08, AC 4)
Proof: walk - o Storybook lista, para cada componente tocado, uma story por estado que a spec nomeia

**C107** - Existe a story "Tokens" com cores, escala, espaço, raios, sombra e tamanhos (PRU-08, AC 5)
Proof: run ui | ✓ PRU-08 AC05

**C108** - O `Logo` aparece em todas as cores permitidas sobre `surface`, `surface-raised` e bloco `accent` (PRU-08, AC 6)
Proof: run ui | ✓ PRU-08 AC06

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** 2026-11-08 - user: "se vocer conseguir baixar as fontes, use local as fpntes" - na T34, `docs/design/system/prumo.md` (linha 54) passa a dizer que Geist e Geist Mono são auto-hospedadas via `@fontsource` (AD-012), não Google Fonts. 2026-11-08 - user: "Rótulo fixo" - o botão de mostrar/ocultar senha tem um único rótulo, "Mostrar senha", e o `aria-pressed` diz o estado (PRU-03 AC4 e AC8 e o `design.md` atualizados; `toggleLabel` no lugar de `showLabel`/`hideLabel`).
**Dispatched:** lote 1a (Fase 1, T1–T4, Opus 5.5) from a537d9b - returned 8dc02aa; lote 1b (Fase 2, T5–T12, Opus 5.5) from 8dc02aa - returned a54b165; lote 2 (Fases 3–4, T13–T22, Sonnet 5.5) from a54b165 - returned 8b7b3aa; lote 3 (Fase 5, T23–T28, Sonnet 5.5) from 6d03cbd - 2026-11-08 - pending
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

Phase 1:  T1 ------→ T2 ------→ T3 ------→ T4
Phase 2:  T5 ------→ T6 ------→ T7 ------→ T8 ------→ T9 ------→ T10 ------→ T11 ------→ T12
Phase 3:  T13 -----→ T14 -----→ T15 -----→ T16
Phase 4:  T17 -----→ T18 -----→ T19 -----→ T20 -----→ T21 -----→ T22
Phase 5:  T23 -----→ T24 -----→ T25 -----→ T26 -----→ T27 -----→ T28
Phase 6:  T29 -----→ T30 -----→ T31 -----→ T32 -----→ T33 -----→ T34
```

Execution is strictly sequential. Com 34 tasks o Execute oferece workers por lote de ~7 tasks (fases inteiras): Fase 1 + parte da 2 não se divide, então os lotes saem como Fases 1-2 (12 tasks), Fase 3 + 4 (10), Fases 5-6 (12); o orquestrador reempacota na hora e pede a confirmação.

