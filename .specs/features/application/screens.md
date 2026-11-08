# Application screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 1

Pictures retaken by the verifier: compose stack built from this checkout (`docker compose up --build --wait`), test `captures` of `tests/e2e/specs/browser/applications.spec.ts` run alone (`playwright test --project=browser --no-deps -g "captures: PageApplications"`). Its context is `viewport 1280 × 800`, `colorScheme: 'light'`, asserted with `page.viewportSize()` before the first shot and never resized; `page.screenshot` saves without scaling. The three files came out 1280 × 800 and byte-identical to the author's, so git shows no change in them. The stack was removed with its volumes afterwards.

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/PageApplications.running.png` | `captures/PageApplications.png` | matches | 0 rows differ |
| `captures/PageNewApplication.running.png` | `captures/PageNewApplication.png` | diverges | 4 rows differ |
| `captures/PageApplicationDetail.running.png` | `captures/PageApplicationDetail.png` | diverges | 6 rows differ |

### `captures/PageApplications.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| shell: sidebar on the left, list page on the right, full height | same | |
| sidebar header: logo mark and "rumo carreira" | same | |
| sidebar: "Buscar ⌘K", "Currículo" (Currículo mestre, Skills), "Análise" (Insights) | same | absent, as approved (AD-008: only "Início" and "Candidaturas") |
| sidebar: "Início" with icon, then "Candidaturas" selected (teal fill) with the total on the right | same | note: the total is in `mono` (APP-43); the capture draws it in the sans |
| sidebar footer: avatar "MA", "Marina Alves", logout icon, divider above | same | |
| topbar: title "Candidaturas" with the total beside it | same | note: total in `mono` as APP-42 asks |
| topbar right: sort button with icon "Última atividade", primary "+ Nova candidatura" with kbd `C` | same | |
| toolbar: chips "Ativas N" (pressed) and "Encerradas N", vertical divider, "Nível", "Modelo" (icons), dashed "Filtro" | same | |
| toolbar right: search field with icon, placeholder "Empresa, título ou skill" | same | |
| group headers: grey band, status icon, plural label in bold, count, "+" on the right | same | |
| groups in order Propostas, Em entrevistas, Enviadas, Salvas | same | |
| status icons: Proposta purple, Em entrevista orange half, Enviada blue ring, Salva dashed ring | same | |
| row: status icon, company (dark), title (muted) on the left | same | |
| row: two skill chips with border, right-aligned before the level | same | |
| row: level, work model columns | same | |
| row: coverage "4/6" column | same | absent, as approved (AD-017) |
| row: last activity "há N d" on the right | same | |
| row: "⋯" button at the right end | same | not in the capture; required by APP-50 ("Ações de {empresa}") |
| Vento Seguros row: clock icon and "sem retorno?" in warning before the skills | same | note: Vento is last in Enviadas (23 d is the oldest activity under "Última atividade"); order is sample data |
| row separators: thin line under every row and header; empty area below the last group | same | note: rows ~1 px taller |

### `captures/PageNewApplication.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| backdrop: list page dimmed under the dialog, sidebar and topbar visible | same | |
| dialog: white card, centred horizontally, rounded, shadow | same | note: centred vertically (top at 110 px, capture at 72 px) and ~30 px taller because the description textarea is taller |
| header: "Nova candidatura" and kbd "esc" on the right | same | |
| "Empresa" and "Título" side by side, filled | same | |
| "Link da vaga · opcional" with placeholder "https://", full width | same | |
| "Nível" chips Estágio, Júnior, Pleno (pressed), Sênior, Especialista, and "Modelo" chips Remoto (pressed), Híbrido, Presencial, the two groups side by side | same | |
| "Skills obrigatórias": field with tags React, Node.js, PostgreSQL and the typed text "nes" | same | note: tags carry a "×" (removable tag, APP-59); the field shows a teal focus border |
| hint under the required field "Busque por nome ou apelido: “node”, …" (partly visible beside the menu) | differs | not visible: the menu covers it entirely |
| suggestion menu: small popover (~240 px) anchored under the typed text, starting near the caret | differs | a menu as wide as the field (339–941 px) right under it, covering the hint, the "Skills desejáveis" label and the top half of that field |
| menu item "NestJS" with category "framework" on the right, highlighted as the active option | differs | "NestJS" and "framework" without any active highlight |
| menu item "+ Criar “nes” como skill privada" | same | |
| "Skills desejáveis" label, field with dashed "Docker" tag and placeholder "Adicionar…" | differs | label hidden under the menu; only the lower half of the field shows ("Docker ×" dashed, "Adicionar…") |
| "Descrição · opcional, cole o texto da vaga" with a resizable textarea | same | note: textarea ~87 px tall, capture ~55 px |
| footer left: "Entra como **Salva**." kbd `⌘` `↵` "para criar" | same | |
| footer right: "Cancelar" (secondary) and "Criar candidatura" (primary teal) | same | |

Note: the "Skills desejáveis" row is counted apart from the menu row because it is a separate element the capture draws; both come from the menu's width.

### `captures/PageApplicationDetail.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| shell sidebar: only "Início" and "Candidaturas" (selected, total) | same | as approved (AD-008) |
| topbar: breadcrumb "Candidaturas › Vento Seguros"; on the right the open-link icon and "⋯" | same | |
| layout: main column on the left, property sidebar on the right with a vertical divider | same | |
| Alert warning: clock icon, "23 dias sem atividade desde o envio. Marcar como sem retorno?", "Ainda não" (ghost), "Marcar sem retorno" (secondary) | same | |
| company "Vento Seguros" (muted) over the title "Desenvolvedor Backend Pleno" (h1) | same | |
| "Skills da vaga" heading; "seu currículo cobre 1/6 obrigatórias" on the right | same | phrase absent, as approved (AD-017) |
| "Obrigatórias" row: bordered tags; one `match` tag (teal with ✓) | same | all tags in the required style, as approved (AD-017); note: tags carry "×" (APP-73) and the approved "+ Skill" (AD-022), so "+ Skill" wraps to a second line |
| "Desejáveis" row: dashed tags and "+ Skill" drawn as a dashed button | differs | dashed tags with "×", then "+ Skill" as plain text with no border |
| "Currículo" section (version card, PDF card) | same | absent, as approved (AD-017) |
| "Linha do tempo" heading with "+ Etapa" on the right | same | |
| timeline: icon column joined by a thin vertical line, date in `mono` on the right as "dd mmm" | same | |
| event "Nota · {nota}" with note icon | same | |
| event "Etapa **RH** concluída" | same | "Etapa **RH**" without "concluída", as approved (AD-018) |
| event "Status **Salva** → **Enviada** com curriculo-vento-seguros.pdf" | differs | "Status → **Enviada**", no "Salva" (the walked state created Vento directly as Enviada, so there is no from status); the document is absent as approved (AD-017) |
| event "Vaga cadastrada" with dashed status icon | same | |
| note field "Adicionar nota…" full width under the timeline | same | note: ~88 px tall, capture ~64 px |
| property list: Status (icon + "Enviada"), Nível, Modelo, Local, Vaga, Cadastrada, Atividade; values in one aligned column | differs | "Local" and "Vaga" values drawn as buttons whose text sits ~7 px right of the other values, so the column is ragged; note: "Pleno" and "Presencial" in muted grey where the capture draws dark text |
| "Vaga" value: teal link shown without scheme ("vagas.exemplo.com/1…") | differs | teal link with the scheme, "https://vagas.exe…" |
| "Cadastrada" date in `mono`, "Atividade" date in `mono` warning | same | |
| divider, "Descrição da vaga" label, clamped text with ellipsis | same | |
| "Ver texto completo" as a teal link aligned with the text | differs | dark text button, indented ~9 px from the description |
| divider, "Excluir candidatura" with trash icon in danger red | differs | trash icon and label in neutral dark grey, not red |
