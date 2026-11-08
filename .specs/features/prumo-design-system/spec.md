# Prumo Design System Specification

**Approved**: 2026-11-08 - user: "Aprovo a spec"

## Problem Statement

`packages/ui`, o Storybook e as telas de `apps/web` ainda usam tokens provisórios, o nome "Application Manager" e nenhuma marca. O design system **Prumo** do produto **Rumo Carreira** (`docs/design/system/`) já define cor, tipografia, espaço, componentes, arquétipos e o desenho das telas atuais. Esta feature aplica esse design no código, sem mudar regra de negócio, contrato ou API, e deixa prontos os componentes que as fases 1 a 4 vão precisar.

## Goals

- [ ] Todo token de `docs/design/system/tokens.json` existe em `packages/ui/src/styles/tokens.css` nos dois temas, os nomes antigos continuam valendo e todo par texto/fundo passa 4.5:1 e todo anel de foco e borda de controle passa 3:1, medido por teste.
- [ ] Os seis componentes e os quatro arquétipos existentes seguem o guia de `docs/design/system/components/<Nome>/README.md`, e `Logo`, favicon e ícone de app existem.
- [ ] As sete telas atuais (`/login`, `/admin/login`, `/invite/$token`, as três telas de acesso, a home do member, o painel e os convites do admin, `/status`) seguem as cartas `Page*`, e nenhuma delas diz "Application Manager".
- [ ] Os campos de senha têm a ação de mostrar e ocultar.
- [ ] Cada componente e arquétipo tocado ou criado tem story nos dois temas, e os componentes das fases futuras que não dependem de dados existem em `packages/ui` com story.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `CommandMenu` e a busca `⌘K` | Sem busca real hoje; entra com a fatia que a alimenta (AD-008) |
| Botão "Buscar ⌘K" e itens Candidaturas, Currículo mestre, Skills, Insights, Catálogo de skills na sidebar | Aparecem quando a fatia existe (AD-008) |
| Telas `Page*` das fases futuras (`PageApplications`, `PageNewApplication`, `PageApplicationDetail`, `PageMasterResume`, `PageResumeVersion`, `PageSkills`, `PageHomeDashboard`, `PageInsights`, `PageCommandPalette`) | Referência para as fases 1 a 4 |
| Quem convidou ("por você") em cada convite e o widget "Skills privadas aguardando promoção" | A API não entrega o dado e a fatia Skill não existe (AD-009, AD-008) |
| Botões "Começar pelo perfil" e "Nova candidatura" da home | As telas não existem (AD-010) |
| Mudança em API, contratos, banco ou regra de negócio | Feature só de UI |
| Botão de tema no app | O app segue `prefers-color-scheme`; o Storybook alterna o tema |
| Logotipo com o texto contornado em curvas | Pendência registrada no próprio design (`docs/design/system/README.md`); o texto é Geist ao vivo |
| Verificar domínio, INPI ou GitHub do nome Rumo Carreira | Pendência do design, fora do código |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Componentes futuros que entram agora | `Kbd`, `EmptyState`, `PipelineStatus`, `SkillTag` (em `components/`) e `DetailPage`, `FormPage` (em `layouts/`); sem `CommandMenu` | Resposta do usuário: "Presentacionais + arquétipos" | y |
| Sidebar | Só os destinos que existem (AD-008) | Resposta do usuário: "Só o que existe" | y |
| Quem convidou e "Verificado" | Sem "por você"; "Verificado" é o instante da leitura no web (AD-009) | Resposta do usuário | y |
| Home do member | Três passos sem botões, `EmptyState` com a dica ⌘K (AD-010) | Resposta do usuário: "Passos sem ação" | y |
| Saudação e convite | "Olá, {nome}" e "Você recebeu um convite para o Rumo Carreira." (AD-011) | Respostas do usuário | y |
| Fontes e ícones | `@fontsource` auto-hospedado e `lucide-react` (AD-012) | Resposta do usuário: "Auto-hospedadas via @fontsource" | y |
| Dica do ⌘K no `EmptyState` da home | A dica "⌘K abre qualquer coisa de qualquer lugar." não aparece, porque o atalho não existe; volta com o `CommandMenu` | Decorre de AD-008: nenhum texto promete um atalho que não funciona | y (AD-008) |
| Mostrar/ocultar senha | Vale para todo campo de senha do app (`/login`, `/admin/login`, `/invite/$token`); começa oculta; o botão fica na ordem de tabulação logo após o campo e não é enviado com o formulário; o texto do botão e do `aria-label` vem de quem chama | Pedido do usuário; os componentes não trazem texto de produto (guia do Prumo) | y (pedido do usuário; detalhes por padrão da UI) |
| Estado da senha após envio com erro | Continua como a pessoa deixou (visível ou oculta); o valor digitado é mantido como hoje | Não perder o que foi digitado (regra existente do `LoginForm`) | n |
| Rótulos das cartas que anotam a tela ("/invite/$token · 410", "Qualquer rota, API fora do ar", "Fase 1 · aparece quando…", "Quando algo cai") | São anotações do design, não texto de produto; não vão para a tela | Mostram o contexto da carta | n |
| Textos do produto | Os textos das cartas valem como estão, em pt-BR e com as diferenças da tabela abaixo. Onde a carta e `MESSAGES` dizem o mesmo com outras palavras (sessão expirada, convite inválido, sem acesso), vale a carta e os testes que assertam essas frases mudam só a frase; os textos sem carta (inclusive `MESSAGES.unavailable` nos alertas em linha) continuam | A carta é a fonte binding; mudar só a frase preserva o comportamento | n |
| Papel do `main` | O arquétipo continua sendo o único `main` da página; `AppShell.Main` o recebe com `asChild` | Guia do `AppShell` e regra existente | y |
| Iniciais do avatar | Primeira letra do primeiro e do último nome da sessão, em maiúsculas ("Ana Souza" → "AS"); com um nome só, as duas primeiras letras dele; `aria-hidden`, ao lado do nome | Carta mostra "MA Marina Alves"; o nome vem da sessão. Pergunta: "Iniciais do avatar … Qual vale?"; opção escolhida: "Nome e sobrenome" (2026-11-08) | y |
| Mobile | Abaixo de `md` a sidebar vira barra no topo com o mesmo markup (guia do `AppShell`); demais telas funcionam a 360px de largura sem rolagem horizontal | Guia do `AppShell`; as cartas são a 1280px | n |
| Movimento | Transições de 100–200 ms só em cor e opacidade, desligadas com `prefers-reduced-motion` | Princípio 5 do Prumo | y |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Tokens, tipografia e ícones ⭐ MVP

**User Story**: Como quem usa o Rumo Carreira, quero a identidade visual do Prumo em todo o app, nos dois temas e legível, para que a ferramenta tenha uma cara única e consistente.

**Why P1**: Todo componente, arquétipo e tela depende dos tokens.

**Acceptance Criteria**:

1. The system SHALL define in `packages/ui/src/styles/tokens.css` every color, type, spacing, radius, shadow and size token of `docs/design/system/tokens.json`, for the light theme and for the dark theme.  <!-- ubiquitous -->
2. The system SHALL keep every token name that `packages/ui/src/styles/tokens.css` defines today (`surface`, `surface-raised`, `text`, `text-muted`, `border`, `status-operational`, `status-unavailable`, `accent`, `focus`, `on-accent`, `danger`, `radius-sm`, `radius-md`).  <!-- ubiquitous -->
3. The system SHALL set the `accent` token to `oklch(0.5 0.08 195)` in the light theme and `oklch(0.74 0.105 195)` in the dark theme.  <!-- ubiquitous -->
4. The system SHALL keep Tailwind's default palette removed, so that only semantic tokens exist as colors.  <!-- ubiquitous -->
5. WHEN the operating system prefers a dark scheme and `data-theme` is not `light` THEN the system SHALL apply the dark token values.  <!-- event-driven -->
6. WHERE `data-theme` is `light` or `dark` on the root element THE system SHALL apply that theme's values whatever the operating system prefers.  <!-- optional-feature -->
7. The system SHALL render text at least 4.5:1 against every surface it appears on, in both themes, for `text` and `text-muted` over `surface`, `surface-raised`, `surface-hover` and `surface-overlay`, and for `accent-text` over `accent-subtle`, `danger` over `danger-subtle`, `warning` over `warning-subtle`, and `on-accent` over `accent` and over `danger`.  <!-- ubiquitous -->
8. The system SHALL render `focus`, `border-control` and each `status-*` icon color at least 3:1 against the surfaces they sit on, in both themes.  <!-- ubiquitous -->
9. The system SHALL serve Geist as `font-sans` and Geist Mono as `font-mono` from files packaged with the app and with the Storybook, without any request to a third-party host at runtime.  <!-- ubiquitous -->
10. The system SHALL set the base text to 13px with 20px line height, and expose the scale `caption`, `label`, `body`, `body-lg`, `heading-sm`, `heading-md`, `heading-lg` and `heading-xl` with the sizes of `tokens.json`.  <!-- ubiquitous -->
11. The system SHALL draw every icon from `lucide-react` at stroke 1.75, 16px or 14px, in the color of the surrounding text.  <!-- ubiquitous -->
12. WHEN the person prefers reduced motion THEN the system SHALL run no transition or animation.  <!-- event-driven -->
13. The system SHALL show a focus ring of 2px solid `focus` offset 2px on every interactive element reached by keyboard (offset -1px with `focus` border on text fields).  <!-- ubiquitous -->

**Independent Test**: Abrir o Storybook, alternar claro e escuro, e rodar os testes de contraste de `packages/ui`.

---

### P1: Componentes existentes

**User Story**: Como quem constrói telas, quero `Button`, `Alert`, `Field`, `StatusBadge`, `CopyField` e `ConfirmDialog` no padrão do Prumo, para que toda tela herde o visual certo.

**Why P1**: Todas as telas são compostas por eles.

**Acceptance Criteria** (guias em `docs/design/system/components/<Nome>/README.md`):

1. The `Button` SHALL accept the intents `primary`, `secondary`, `ghost` and `danger`, with `primary` as default.  <!-- ubiquitous -->
2. The `Button` SHALL be 32px tall by default and 28px tall with `size="sm"`.  <!-- ubiquitous -->
3. WHILE a `Button` is disabled THE system SHALL render it at 50% opacity and ignore clicks.  <!-- state-driven -->
4. The `Button` SHALL render its label in `on-accent` when the intent is `primary` or `danger`.  <!-- ubiquitous -->
5. WHERE `asChild` is set THE `Button` SHALL render its child element with the button's classes and attributes.  <!-- optional-feature -->
6. The `Alert` SHALL accept the intents `danger`, `info` and `warning`, show the icons `circle-alert`, `info` and `clock` respectively, and fill with `danger-subtle`, `info-subtle` and `warning-subtle`.  <!-- ubiquitous -->
7. The `Alert` with intent `danger` SHALL have `role="alert"` and the others `role="status"`.  <!-- ubiquitous -->
8. WHERE an action is passed to an `Alert` THE system SHALL show it at the right end of the alert.  <!-- optional-feature -->
9. The `Field` SHALL offer `Field.Textarea` with the same border, id wiring and `aria-describedby`/`aria-invalid` as `Field.Control`, with a minimum height of 88px.  <!-- ubiquitous -->
10. WHILE a `Field` is invalid THE `Field.Control` SHALL show a `danger` border and `Field.Error` SHALL show the message with the icon `circle-alert`.  <!-- state-driven -->
11. WHERE a `Field.Control` is `readOnly` THE system SHALL render it on `surface-raised` with `text-muted` text.  <!-- optional-feature -->
12. The `StatusBadge` SHALL render a dot before the text, with border and text in the color of the intent (`operational` or `unavailable`) and a transparent fill.  <!-- ubiquitous -->
13. The `CopyField` SHALL render the value in `font-mono` on `surface-raised` and select the whole value when it receives focus.  <!-- ubiquitous -->
14. WHEN the copy status is `copied` THEN the `CopyField` SHALL show `copiedLabel` with the icon `check`.  <!-- event-driven -->
15. IF the copy status is `failed` THEN the `CopyField` SHALL show a `danger` `Alert` with `failureMessage` below the field and keep the value selectable.  <!-- unwanted-behavior -->
16. The `ConfirmDialog` SHALL render on `surface-overlay` with `border-strong`, `radius-lg`, `shadow-overlay`, a maximum width of 440px and a `backdrop` veil.  <!-- ubiquitous -->
17. WHEN the person presses `Esc` in an open `ConfirmDialog` THEN the system SHALL close it without calling `onConfirm`.  <!-- event-driven -->
18. WHILE a `ConfirmDialog` is open THE system SHALL keep keyboard focus inside it.  <!-- state-driven -->
19. The system SHALL keep every prop, part name and behavior of these six components that the identity feature uses today, so that `apps/web` compiles and its tests pass without changing what they assert.  <!-- ubiquitous -->

**Independent Test**: Stories de cada componente nos dois temas e os testes de cada um.

---

### P1: Mostrar e ocultar a senha

**User Story**: Como quem digita uma senha longa (12 a 128 caracteres), quero ver o que digitei quando eu quiser, para errar menos ao entrar ou criar a conta.

**Why P1**: Pedido do usuário; a senha mínima tem 12 caracteres e o `/invite` não pede confirmação.

**Acceptance Criteria**:

1. The system SHALL offer `Field.PasswordControl`, a `Field` part that renders the control and a toggle button at its right end.  <!-- ubiquitous -->
2. The `Field.PasswordControl` SHALL start with the value hidden (`type="password"`).  <!-- ubiquitous -->
3. WHEN the person activates the toggle THEN the system SHALL switch the control between `type="password"` and `type="text"` and keep the typed value and the caret position.  <!-- event-driven -->
4. The toggle SHALL be a `button` of `type="button"` with `aria-pressed` reflecting whether the value is visible, with one `aria-label` supplied by the caller that stays the same in both states, and icons `eye` and `eye-off`.  <!-- ubiquitous --> <!-- changed 2026-11-08 - user: "Rótulo fixo" (WAI-ARIA toggle button: the label does not change with aria-pressed) -->
5. WHEN the person submits the form with the toggle focused or not THEN the system SHALL NOT send the toggle as a field.  <!-- event-driven -->
6. WHILE the value is visible THE system SHALL keep `autoComplete`, `aria-describedby` and `aria-invalid` of the control unchanged.  <!-- state-driven -->
7. WHERE the field is `disabled` THE system SHALL disable the toggle as well.  <!-- optional-feature -->
8. The system SHALL use `Field.PasswordControl` in the password field of `/login`, `/admin/login` and `/invite/$token`, with the label "Mostrar senha" in both states.  <!-- ubiquitous --> <!-- changed 2026-11-08 - user: "Rótulo fixo" -->
9. IF a submit fails THEN the system SHALL keep the toggle state and the typed value as the person left them.  <!-- unwanted-behavior -->
10. The toggle SHALL be reachable by `Tab` right after the control and operable with `Enter` and `Space`, with the 2px focus ring.  <!-- ubiquitous -->

**Independent Test**: Digitar uma senha em `/login`, ativar o botão, ver o texto, ativar de novo e ver os pontos.

---

### P1: Arquétipos existentes

**User Story**: Como quem constrói telas, quero `AppShell`, `AuthPage`, `ListPage` e `DashboardPage` no padrão do Prumo, para que toda página herde a estrutura certa.

**Why P1**: Toda tela atual usa um deles.

**Acceptance Criteria** (guias de `AppShell`, `AuthPage`, `ListPage`, `DashboardPage`):

1. The `AppShell.Sidebar` SHALL be 232px wide on `surface-raised` with a right border `border` and an `aria-label` the caller supplies.  <!-- ubiquitous -->
2. The `AppShell.Sidebar` SHALL show, in order, the `Logo`, the navigation grouped by section, and the person at the bottom with the sign-out action.  <!-- ubiquitous -->
3. The `AppShell.NavItem` SHALL be 30px tall with a 14px icon, the label and an optional count in `font-mono`, and SHALL show the current item on `accent-subtle` with `accent-text` and `aria-current="page"`.  <!-- ubiquitous -->
4. WHERE `asChild` is set THE `AppShell.NavItem` and `AppShell.Main` SHALL render their child with their own classes, and the page SHALL keep exactly one `main`.  <!-- optional-feature -->
5. WHEN the viewport is narrower than the `md` breakpoint THEN the `AppShell` SHALL turn the sidebar into a bar at the top, with the same markup and no horizontal page scroll.  <!-- event-driven -->
6. The page SHALL open with a 48px topbar holding the title or breadcrumb at the left and the page actions at the right.  <!-- ubiquitous -->
7. The `AuthPage.Root` SHALL be a `main` with `surface` background and a column of 360px, placed a little above the center, without card or hero.  <!-- ubiquitous -->
8. The `AuthPage` SHALL offer `Header` (the `Logo` mark at 20px, a `heading-xl` title and a `text-muted` line), `Form` (gap `space-4`, full-width button) and `Footer` (a `border` rule and a `caption` note in `text-muted`), and alerts SHALL sit between the header and the first field.  <!-- ubiquitous -->
9. The `ListPage.Header` SHALL show the title in `heading-md`, the count in `font-mono` and the primary action `sm` at the right.  <!-- ubiquitous -->
10. The `ListPage.Filters` SHALL be a `role="search"` with a required `aria-label`.  <!-- ubiquitous -->
11. The `ListPage` SHALL offer a group header of 36px on `surface-raised` with label in `heading-sm` and the count.  <!-- ubiquitous -->
12. The `ListPage.Row` SHALL be at least 40px tall, with `surface-hover` on hover, `accent-subtle` when selected, text at the left and metadata in fixed columns at the right (dates in `font-mono`).  <!-- ubiquitous -->
13. The `DashboardPage.Root` SHALL be a `main` without padding that opens with the `AppShell.Topbar` edge to edge, followed by `DashboardPage.Content` with padding `space-6` and maximum width 1120px, the `Header` an `h1` in `heading-lg` with a `text-muted` context line, and the `Grid` 12 columns with gap `space-4`.  <!-- ubiquitous --> <!-- changed 2026-11-08 - user: "Topbar como na carta" -->
14. The `DashboardPage` SHALL offer a `Widget` on `surface` with `border`, `radius-md` and padding `space-4`, whose title is `heading-sm`, with an optional `ghost` action in its header and the span 3, 4, 5, 6, 7, 8 or 12.  <!-- ubiquitous -->
15. The system SHALL keep the prop names and parts these four archetypes expose today that `apps/web` uses, so that its tests pass without changing what they assert.  <!-- ubiquitous -->

**Independent Test**: Stories de cada arquétipo nos dois temas; redimensionar a janela para 360px.

---

### P1: Logo, favicon e ícone de app

**User Story**: Como quem abre o Rumo Carreira, quero ver a marca no app, na aba do navegador e ao instalar, para reconhecer o produto.

**Why P1**: O produto ainda não tem marca e o `<title>` ainda é o nome do repositório.

**Acceptance Criteria**:

1. The system SHALL offer a `Logo` component with the forms `mark` (the 3/4 ring as inline SVG in `currentColor`) and `wordmark` (mark + "rumo" in Geist 600 and "carreira" in Geist 400, lowercase, tracking -0.03em).  <!-- ubiquitous -->
2. The `Logo` wordmark SHALL render "rumo" in `text` and "carreira" in `text-muted`, with the gap between mark and text equal to half the mark.  <!-- ubiquitous -->
3. The `Logo` mark SHALL render in `accent` by default and SHALL be hidden from assistive technology (`aria-hidden`) unless the caller gives it a label.  <!-- ubiquitous -->
4. WHERE the caller sets a single color on the `Logo` THE system SHALL use it for mark and text alike.  <!-- optional-feature -->
5. The system SHALL serve a favicon derived from `docs/design/system/assets/logos/rumo-favicon.svg` that follows the system color scheme, and an app icon derived from `rumo-app-icon.svg`, both linked in the document `<head>` of `apps/web`.  <!-- ubiquitous -->
6. The system SHALL set the document `<title>` to "Rumo Carreira".  <!-- ubiquitous -->
7. The `AuthPage.Header` SHALL show the `Logo` mark at 20px, and the `AppShell.Sidebar` and `/status` SHALL show the wordmark.  <!-- ubiquitous -->

**Independent Test**: Abrir `/login` e ver a aba do navegador, o símbolo e o título da janela.

---

### P1: Telas atuais

**User Story**: Como quem usa o produto, quero que as telas atuais tenham o desenho do Prumo, para entrar, aceitar um convite, convidar pessoas e ver o status numa interface coerente.

**Why P1**: É o que a pessoa vê.

Fontes binding: as cartas `components/Page*/preview.html` (ver `Sources`). Sample data das cartas (nomes, datas, e-mails) não é copiada; rótulos e frases são, salvo `Differences from the source`.

**Acceptance Criteria**:

1. WHEN a person opens `/login` THEN the system SHALL show the screen of `PageLogin`: the `AuthPage` with the `Logo` mark, "Entrar" in `heading-xl`, the line "Rumo Carreira — suas candidaturas e currículos", the fields "E-mail" and "Senha", a full-width "Entrar" button and the footer "O acesso é por convite. Esqueceu a senha? Fale com quem te convidou."  <!-- event-driven -->
2. WHEN a person opens `/admin/login` THEN the system SHALL show the same layout as `/login` with the administration title and no other change.  <!-- event-driven -->
3. WHEN a person opens a login page with `?reason=expired` THEN the system SHALL show an `Alert` `info` above the fields with the text "Sua sessão expirou. Entre de novo para continuar."  <!-- event-driven -->
4. IF the credentials are wrong THEN the login page SHALL show an `Alert` `danger` with "E-mail ou senha incorretos." above the fields and keep what the person typed.  <!-- unwanted-behavior -->
5. IF the login is blocked (429) THEN the login page SHALL show an `Alert` `danger` with the message that says when to try again, in the same place.  <!-- unwanted-behavior -->
6. WHILE a sign-in call is open THE "Entrar" button SHALL be disabled.  <!-- state-driven -->
7. WHEN a person opens `/invite/$token` with a valid token THEN the system SHALL show the screen of `PageInvite`: the title "Criar conta", the line "Você recebeu um convite para o Rumo Carreira.", the invitation e-mail read-only, the fields "Nome" and "Senha", the hint "Use de 12 a 128 caracteres." before any error, a full-width "Criar conta" button and the footer "O convite vale até {data}." with the date of `expiresAt`.  <!-- event-driven -->
8. IF the password breaks the rule at submit THEN the invite page SHALL show the error "A senha precisa ter de 12 a 128 caracteres." under the field, in `danger`, and keep the hint.  <!-- unwanted-behavior -->
9. WHEN the invitation is expired, used, revoked or unknown (410) THEN the system SHALL show the "Convite inválido" screen of `PageAccessStates` in `AuthPage`, with the message "Este convite expirou ou já foi usado. Peça um novo link a quem te convidou." and no form.  <!-- event-driven -->
10. WHEN a member opens an `/admin` page THEN the system SHALL show the "Sem acesso" screen of `PageAccessStates` with the message "Esta área é da administração. Sua conta é de uso do produto.", a primary button "Voltar para o início" that goes to `/`, and a "Sair" action.  <!-- event-driven -->
11. WHEN the API does not answer for a guard THEN the system SHALL show the "Indisponível" screen of `PageAccessStates` with the message "O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.", keep the requested URL and offer "Tentar novamente", which reloads the route.  <!-- event-driven -->
12. WHEN a member opens `/` THEN the system SHALL show the `PageMemberHome` inside the `AppShell`: the h1 "Início", the greeting "Olá, {nome}", the line "Três passos para a primeira candidatura com currículo adaptado.", the steps "01 Conta criada", "02 Preencha o currículo mestre" and "03 Cadastre uma vaga" with their descriptions, and the `EmptyState` "Quando houver candidaturas, aqui aparecem o pipeline, o que precisa de atenção e a atividade recente."  <!-- event-driven -->
13. The member `AppShell` SHALL show the wordmark, the item "Início" as current, and the person's initials, name and "Sair" at the bottom.  <!-- ubiquitous -->
14. WHEN an admin opens `/admin` THEN the system SHALL show the `PageAdminDashboard`: the h1 "Administração", a widget "Status do sistema" with `StatusBadge`, "API", "Banco de dados" and the check time in `font-mono`, and a widget "Convites pendentes" with the count in `heading-xl`, the time until the oldest one expires, the ghost action "Ver convites" and the action "Convidar pessoa".  <!-- event-driven -->
15. The admin `AppShell` SHALL show the wordmark with the tag "admin", the items "Painel", "Convites" and "Status do sistema" (a link to `/status`), and the admin's initials, name and "Sair".  <!-- ubiquitous -->
16. WHEN an admin opens `/admin/invitations` THEN the system SHALL show the `PageAdminInvitations` in a `ListPage`: the title "Convites" with the count "{n} pendentes", the filter row as the form "E-mail a convidar" and "Convidar", and the group "Pendentes" with one row per pending invitation.  <!-- event-driven -->
17. WHEN the admin creates an invitation THEN the system SHALL show above the list a strip on `surface-raised` with "Convite criado para {e-mail}", the note "este link só aparece desta vez. Copie-o agora." and a `CopyField` with the link.  <!-- event-driven -->
18. The invitation row SHALL show the e-mail, the time left ("expira em {n} d"), in `warning` when 2 days or fewer are left, and the `ghost` action "Revogar".  <!-- ubiquitous -->
19. WHEN the admin activates "Revogar" on a row THEN the system SHALL open a `ConfirmDialog` that names the e-mail, and revoke the invitation only on the confirm action.  <!-- event-driven -->
20. WHEN the admin activates "Convidar pessoa" in the dashboard widget THEN the system SHALL open `/admin/invitations`.  <!-- event-driven -->
21. WHEN anyone opens `/status` THEN the system SHALL show the `PageStatus` outside the `AppShell`: a 560px column with the wordmark, the h1 "Status", a verdict in `heading-lg` ("Todos os sistemas operacionais"), the line "Verificado às {hora} de {data}." and the rows "API" and "Banco de dados" with `StatusBadge`.  <!-- event-driven -->
22. IF a component is unavailable THEN `/status` SHALL change the verdict to "Serviço degradado" and put the affected component at the top of the list in `danger`.  <!-- unwanted-behavior -->
23. The system SHALL show no text "Application Manager" in any screen, in the document `<title>`, in `AccessScreens` or in the root route.  <!-- ubiquitous -->
24. WHEN the empty list of pending invitations is shown THEN the system SHALL show an `EmptyState` with a sentence and the action to invite.  <!-- event-driven -->
25. IF loading a list or widget fails THEN the system SHALL show an `Alert` `danger` with the message that exists today and keep the rest of the page.  <!-- unwanted-behavior -->
26. The system SHALL keep the behavior these screens have today (redirects, guards, forms, calls, status codes) so that the tests of identity and system-status pass without changing what they assert, except the sentences that criteria 1 to 25 replace.  <!-- ubiquitous -->
27. WHILE the viewport is 360px wide THE screens SHALL show no horizontal page scroll and keep every control reachable.  <!-- state-driven -->

**Independent Test**: Subir a stack local, percorrer `/login`, `/invite/$token`, `/`, `/admin`, `/admin/invitations` e `/status` nos dois temas.

---

### P2: Componentes das fases futuras

**User Story**: Como quem constrói as fases 1 a 4, quero `Kbd`, `EmptyState`, `PipelineStatus`, `SkillTag`, `DetailPage` e `FormPage` prontos e documentados, para montar as telas futuras sem desenhar componente no meio da fatia.

**Why P2**: `Kbd` e `EmptyState` já são usados pelas telas atuais; os demais só têm consumidor nas fases futuras, mas o design deles está fechado.

**Acceptance Criteria** (guias em `docs/design/system/components/<Nome>/README.md`):

1. The `Kbd` SHALL render a `kbd` element in `font-mono` 11px/500, 18px tall, with `border-strong` on `surface-raised`.  <!-- ubiquitous -->
2. WHERE a `Kbd` sits inside a primary `Button` THE `Kbd` SHALL take `on-accent` for text and border.  <!-- optional-feature -->
3. The `EmptyState` SHALL render a box with a dashed `border-strong` border and `radius-md`, left aligned, with the sentence from the caller in `text-muted` and an optional action, without illustration.  <!-- ubiquitous -->
4. The `PipelineStatus` SHALL accept the eight statuses `saved`, `applied`, `interviewing`, `offer`, `accepted`, `rejected`, `withdrawn` and `ghosted`, each with its own 14px icon (dashed circle, empty circle, half, three quarters, full with check, full with X, with bar, dotted) in its `status-*` color.  <!-- ubiquitous -->
5. The `PipelineStatus` SHALL render the label from the caller in `text` next to the icon, and WHERE `iconOnly` is set SHALL render the icon alone with the label as `aria-label`.  <!-- ubiquitous -->
6. The `PipelineStatus` SHALL tell every status apart without color, by icon and label.  <!-- ubiquitous -->
7. The `SkillTag` SHALL render a 22px `caption` tag in the variants required (`border-strong`, `text`), `nice` (dashed border, `text-muted`), `private` (mark "·") and `match` (`accent-subtle`, `accent-text`, icon `check`).  <!-- ubiquitous -->
8. WHERE `onRemove` is set THE `SkillTag` SHALL show a remove button with the `aria-label` from the caller, and WHEN activated SHALL call `onRemove` once.  <!-- optional-feature -->
9. The `DetailPage` SHALL offer `Root` (`main`), `Main` and `Sidebar` (`aria-label` required, 280px, left border), where each property is a name in `caption` `text-muted` and a value in a row of 28px with `surface-hover` on hover.  <!-- ubiquitous -->
10. The `FormPage` SHALL offer `Root` (`main`), an index `nav` of 200px that sticks while scrolling, `Section` with a `heading-md` title and an actions area, in a reading width of 720px.  <!-- ubiquitous -->
11. The system SHALL give no product text to these components: every label, `aria-label` and message comes from the caller.  <!-- ubiquitous -->

**Independent Test**: Story de cada um nos dois temas e o teste de cada componente.

---

### P1: Storybook

**User Story**: Como quem mantém a interface, quero o Storybook como referência viva do Prumo, para ver e testar cada peça nos dois temas.

**Why P1**: Regra do projeto: componente novo ou tocado só entra com story.

**Acceptance Criteria**:

1. The system SHALL have a story file for every component and archetype of `packages/ui`, touched or new, covered by the existing check that fails on a directory without story.  <!-- ubiquitous -->
2. The Storybook SHALL load the Prumo tokens and fonts, and switch light and dark through `data-theme`.  <!-- ubiquitous -->
3. The system SHALL have, for each touched or new component, a story test run in a real browser that reads the colors in both themes and checks the contrast ratios of criterion 7 and 8 of "Tokens, tipografia e ícones".  <!-- ubiquitous -->
4. The Storybook SHALL show each component's states (default, hover-free variants, disabled, invalid, read-only, loading where it exists) as stories.  <!-- ubiquitous -->
5. The Storybook SHALL show a story "Tokens" with the colors, type scale, spacing, radii, shadow and sizes.  <!-- ubiquitous -->
6. The Storybook SHALL show the `Logo` in every allowed color on `surface`, `surface-raised` and an `accent` block.  <!-- ubiquitous -->

**Independent Test**: `pnpm --filter @am/ui storybook:build` e os testes de story passam.

---

## Edge Cases

- IF the Geist file fails to load THEN the system SHALL fall back to the system sans or mono family without layout shift beyond the fallback metrics.
- IF `lucide-react` icons are not yet loaded on the first paint THEN the system SHALL render them inline (no request), since they are bundled.
- WHEN a name is long (up to 100 characters) THEN the sidebar SHALL truncate it with an ellipsis and keep "Sair" visible.
- WHEN an e-mail in an invitation row is long THEN the row SHALL truncate it with an ellipsis and keep the expiry and "Revogar" visible.
- WHEN the number of pending invitations is 0 THEN the dashboard widget SHALL show "0" and no expiry line.
- IF the person's name is empty in the session THEN the greeting SHALL read "Olá" and the avatar SHALL show no initials.
- WHEN the browser zoom is 200% THEN the screens SHALL still show every control without clipping.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PRU-01 | P1: Tokens, tipografia e ícones | Design | Pending |
| PRU-02 | P1: Componentes existentes | Design | Pending |
| PRU-03 | P1: Mostrar e ocultar a senha | Design | Pending |
| PRU-04 | P1: Arquétipos existentes | Design | Pending |
| PRU-05 | P1: Logo, favicon e ícone de app | Design | Pending |
| PRU-06 | P1: Telas atuais | Design | Pending |
| PRU-07 | P2: Componentes das fases futuras | Design | Pending |
| PRU-08 | P1: Storybook | Design | Pending |

**Coverage:** 8 total, 0 mapped to tasks, 8 unmapped ⚠️

---

## Differences from the source

Cada diferença entre as cartas e o produto, aprovada pelo usuário.

| Source shows | Product shows | Confirmed |
| ------------ | ------------- | --------- |
| Sidebar com "Buscar ⌘K", "Candidaturas 24", "Currículo mestre", "Skills", "Insights" (member) e "Catálogo de skills" (admin) | Só Início (member) e Painel, Convites, Status do sistema (admin) | y - [AD-008] |
| Dica "Dica: ⌘K abre qualquer coisa de qualquer lugar." no `EmptyState` da home | Sem a dica, porque o ⌘K não existe | y - [AD-008] |
| "por você" em cada linha de convite | Linha sem quem convidou | y - [AD-009] |
| "Verificado 08 nov 2026 14:32:07" vindo da verificação | O instante em que o web leu a saúde da API | y - [AD-009] |
| Botões "Começar pelo perfil" e "Nova candidatura" na home | Passos só com texto | y - [AD-010] |
| Widget "Skills privadas aguardando promoção" no painel do admin | Sem o widget (a fatia Skill não existe) | y - [AD-008] |
| "Boa tarde, Marina" | "Olá, {nome}" | y - [AD-011] |
| "Você foi convidada para o Rumo Carreira." | "Você recebeu um convite para o Rumo Carreira." | y - [AD-011] |
| "O mais antigo expira em 2 d." sempre no widget "Convites pendentes" | A linha só aparece quando a primeira página de `GET /invitations` traz todos os pendentes (`nextCursor` nulo, até 20); com mais de uma página ela some, porque o mais antigo está numa página que o painel não lê | y - user: "Aceitar e registrar" (2026-11-08, achado F4) |

## Sources

- [docs/design/system/prumo.md](../../../docs/design/system/prumo.md) - binding - guia do Prumo: princípios, voz, cor, tipografia, espaço, foco, marca, ícones, arquétipos e o que é proibido
- [docs/design/system/tokens.json](../../../docs/design/system/tokens.json) e [tokens.css](../../../docs/design/system/tokens.css) - binding - valores e notas de uso dos tokens
- [components/PageLogin](../../../docs/design/system/components/PageLogin/preview.html) - binding - `/login` e `/admin/login`
- [components/PageInvite](../../../docs/design/system/components/PageInvite/preview.html) - binding - `/invite/$token`
- [components/PageAccessStates](../../../docs/design/system/components/PageAccessStates/preview.html) - binding - convite inválido, sem acesso, indisponível
- [components/PageMemberHome](../../../docs/design/system/components/PageMemberHome/preview.html) - binding - home do member
- [components/PageAdminDashboard](../../../docs/design/system/components/PageAdminDashboard/preview.html) - binding - painel do admin
- [components/PageAdminInvitations](../../../docs/design/system/components/PageAdminInvitations/preview.html) - binding - convites do admin
- [components/PageStatus](../../../docs/design/system/components/PageStatus/preview.html) - binding - `/status`
- [components/Button, Alert, Field, StatusBadge, CopyField, ConfirmDialog, AppShell, AuthPage, ListPage, DashboardPage, Logo, Kbd, EmptyState, PipelineStatus, SkillTag, DetailPage, FormPage](../../../docs/design/system/components/) - binding - README e prévia de cada componente e arquétipo
- [docs/design/system/assets/logos](../../../docs/design/system/assets/logos/README.md) - binding - símbolo, favicon e ícone de app
- Pedido do usuário - mostrar e ocultar a senha, e criar os componentes futuros necessários, não estão no design

---

## Success Criteria

- [ ] `pnpm lint`, `pnpm typecheck` e `pnpm test` passam, e o Storybook compila.
- [ ] Nenhuma tela, `<title>` ou componente diz "Application Manager".
- [ ] Os testes de contraste cobrem texto (4.5:1) e foco/bordas de controle (3:1) nos dois temas.
- [ ] Todos os campos de senha do app têm mostrar/ocultar.
