# Master resume screens

**Verifier**: independent sub-agent (author != verifier)
**Round**: 2

Round 2: picture retaken by a fresh screens sub-agent from this checkout at `cf1a1e3`, same way as round 1 (`docker compose up --build --wait`; `CAPTURE=1 playwright test --project=browser --no-deps -g "RES-34 captures"`; context 1280 × 800, light theme; file 1280 × 800; stack and volumes removed afterwards). Only the three rows that read `differs` in round 1 were reopened; the rest stand as round 1 left them. No row the fix touched broke visibly.

Round 1: picture retaken by the verifier: compose stack built from this checkout at `bc1dc79` (`docker compose up --build --wait`), test `RES-34 captures` of `tests/e2e/specs/browser/resume.spec.ts` run alone with `CAPTURE=1` (`playwright test --project=browser --no-deps -g "RES-34 captures"`). Its context is `viewport 1280 × 800`, `colorScheme: 'light'`, asserted with `page.viewportSize()` before the shot and never resized; `page.screenshot` saves without scaling. The file came out 1280 × 800. The stack was removed with its volumes afterwards.

Approved differences applied: no "Visualizar PDF" in the topbar (AD-026); member sidebar without "Buscar ⌘K", "Skills" and "Insights" (AD-008). Sample data and the time in "Salvo às" do not count.

| Screen | Compared with | Verdict | Finding |
| --- | --- | --- | --- |
| `captures/PageMasterResume.running.png` | `captures/PageMasterResume.png` | matches | round 2: the 3 rows that differed in round 1 now read `same` |

### `captures/PageMasterResume.running.png`

| Element | Result | Picture draws |
| --- | --- | --- |
| shell: sidebar on the left, page on the right, full height, vertical divider | same | |
| sidebar header: logo mark and "rumo carreira" | same | |
| sidebar: "Buscar ⌘K", "Skills", group "Análise" with "Insights" | same | absent, as approved (AD-008) |
| sidebar: "Início" with icon, "Candidaturas" with icon and total on the right | same | note: total "0" in `mono` (sample data); capture "24" in the sans |
| sidebar: group label "Currículo", "Currículo mestre" selected (teal fill, teal text, document icon) | same | note: the group label starts at x 8, capture x 16 |
| sidebar footer: avatar "MA", "Marina Alves", logout icon, divider above | same | |
| topbar: title "Currículo mestre" on the left, bottom border | same | |
| topbar right: "Salvo às HH:MM" in muted text | same | note: sits at the right edge because "Visualizar PDF" is absent (AD-026) |
| topbar right: "Visualizar PDF" button with eye icon | same | absent, as approved (AD-026) |
| layout: index column on the left (~200 px), section column on the right | same | |
| index: Perfil, Experiência (selected, teal fill, count 3), Projetos 2, Formação 1, Certificações (no count), Idiomas 2; counts right-aligned in `mono` | same | |
| index: warning Alert under the list, triangle icon, "2 bullets sem skill não entram na ordenação por relevância." on three lines | same | |
| section header: "Experiência" heading on the left, secondary button "+ Experiência" on the right | same | note: the capture draws a plus icon followed by "Experiência"; the picture draws the "+" as a text glyph, narrower button |
| expanded item: bordered card; drag handle, title "Desenvolvedora Full Stack · Empresa Exemplo", dates "mar 2023 — atual" in `mono` · "Remoto"; pencil on the right | same | note: title starts at x 550 (capture 535) and the header is ~10 px taller |
| bullet 1: drag handle, text on two lines, tags NestJS, PostgreSQL, TypeScript under it | same | note: ~10 px more space above the tags and between bullets |
| bullet 2: drag handle, text, tags React, Vite | same | |
| bullets 1 and 2: "⋯" menu button at the right end of each bullet | same | round 2: "⋯" at rest at the right end of bullets 1 and 2 (x ~1177), as the capture (round 1: absent) |
| bullet 3: drag handle, text "Conduzi a adoção de testes de contrato entre três times.", "sem skill" with warning triangle in warning colour at the right, plain row without background | same | round 2: plain row, no band and no "⋯" (round 1: hover band and faint "⋯"). Note: "sem skill" still ends at x ~1150 (capture ~1191), the slot of the hidden "⋯" kept on its right |
| "+ Bullet" ghost button at the bottom-left of the expanded card | same | note: the capture draws a muted plus icon and muted "Bullet"; the picture draws "+ Bullet" in darker text |
| collapsed item: bordered card, drag handle, "Desenvolvedora Back-end · Outra Empresa", "jan 2021 — fev 2023" in `mono` · "Recife, PE", chevron down on the right | same | note: card ~16 px taller |
| collapsed item: only the chevron on the right, no other control | same | round 2: only the chevron on both collapsed cards (round 1: a pencil left of it) |
| the other items collapsed below the expanded one, empty page below | same | note: the picture draws a second collapsed card "Estagiária de Software · Empresa Antiga" (the index counts 3; the capture draws only 2 cards) - sample data |
