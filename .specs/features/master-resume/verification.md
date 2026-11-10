# Master Resume verification

**Verdict**: FAIL
**Proofs**: no `proofs.md` in this project (`docs/workflow.md#gates-e-tempo`); the orchestrator ran `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test --force` (contracts 98, api 127, web 879, ui 646, guardrails 165), `pnpm test:integration` (343) and `pnpm test:e2e` (67) at `bc1dc79`, all green. Diff judged: `9758237..bc1dc79`.
**Verifier**: independent sub-agent (author != verifier)

Own examples run at `bc1dc79` as throwaway tests, deleted afterwards (nothing committed):

- API (integration, real Postgres): the 50-item limit on `projects`, `certifications` and `languages` (`422` on the 51st, all three); profile limits no test names (`headline` 161, `phone` 41, `location` 121, `email` of 256, link `label` 41, link `url` of 2 049 -> `400` each) and their borders accepted (`phone` 40, `location` 120, `headline` 160, 5 links with 40-character labels -> `200`); `PUT …/bullets/order` with `{ ids: [] }` on an item with no bullet -> `200 { ids: [] }`; `GET /resume` orders `languages` and `educations` saved at positions `5, -2, 9` as `-2, 5, 9`; three refused writes (`400`) whose bodies carry markers in name, e-mail, URL, role and company, with the log level at `debug` -> no log line holds a marker. All held.
- Web (jsdom): a new bullet and an edited bullet with 501 characters, left -> both sent (`POST …/bullets`, `PATCH …/bullets/:id`) and no limit shown in the field. Broke RES-85 (finding 1).

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `resume-read.int.test.ts` `RES-01 answers a new account the empty profile in pt-BR, the five empty sections and no skills, and writes no row` (+ `schema.int.test.ts` `RES-01 gives a profile the empty defaults…`) | yes - `toEqual` of the whole body and row counts before/after |
| C2 | `resume-read.int.test.ts` `RES-02 answers the items of a section in the order of position…` + `resume-bullets-create.int.test.ts` `RES-02 answers the bullets of each item in the order of position…` | partial - order asserted for experiences and for bullets of experiences and projects only; order of projects, educations, certifications, languages and the `skills` dictionary are not asserted by a RES-02 test (dictionary held by C23, projects order by C25; own example confirmed educations/languages) - finding 5 |
| C3 | `resume-profile.int.test.ts` `RES-03 creates the profile on the first save and updates the same row on the second` + `RES-03 trims the texts and GET /resume shows the saved profile` | yes - one row with the same id, trimmed body `toEqual` |
| C4 | `resume-profile.int.test.ts` `RES-04 accepts an empty name, headline, email, summary and location` | yes |
| C5 | `resume-profile.int.test.ts` `RES-05 answers 400 with the invalid field and writes nothing for each refusal of the spec` | yes - every case of the criterion, path asserted, `profiles` count 0 (other field limits confirmed by own example) |
| C6 | `resume-profile.int.test.ts` `RES-06 keeps one profile per user…` + `schema.int.test.ts` `RES-06 refuses a second profile for the same user` | yes - unique violation `23505` |
| C7 | `resume-items-create.int.test.ts` `RES-07 answers 201 with the item and puts it first in its section, for each of the five sections` (+ optional fields, unknown section) | yes - five sections, created id first in `GET`, no `bullets`/`userId`/`position` |
| C8 | `resume-items-update.int.test.ts` `RES-08 writes only the field sent…` (+ null fields, other sections) | yes - DB row compared column by column |
| C9 | `resume-items-delete.int.test.ts` `RES-09 answers 204, deletes the experience and its bullets…` + `RES-09 deletes a project with its bullets` (+ schema cascade) | yes - single `DELETE` with `on delete cascade`, asserted by counts |
| C10 | `resume-items-delete.int.test.ts` `RES-10 answers 204 and deletes an education, a certification and a language, and only that one` | yes |
| C11 | `resume-items-create.int.test.ts` `RES-11 answers 400 with the invalid field and writes nothing for each refusal of the spec` + `resume-items-update.int.test.ts` two `RES-11` tests | yes - every case named, path asserted, nothing written; the edit is checked against the saved date |
| C12 | `resume-items-create.int.test.ts` `RES-12 answers an experience and an education with no end date with endDate null` | yes |
| C13 | `resume-items-create.int.test.ts` `RES-13 answers 422 in Problem Details on the 51st item of a section…` + `RES-13 ends with 50 items, one 201 and one 422…` | partial - limit and race proved on `experiences` only; own example confirmed projects, certifications, languages at `HEAD` - finding 5 |
| C14 | `resume-items-update.int.test.ts` `RES-14 answers 404 for an id of another account…` + `resume-items-delete.int.test.ts` `RES-14 answers 404…` | yes - other account, unknown, other section, non-uuid; tables unchanged |
| C15 | `resume-bullets-create.int.test.ts` `RES-15 answers 201 with { bullet, skills } and nothing else, and puts the bullet at the end of the item` + `RES-15 starts an item at position 0 and adds a bullet to a project` | yes - keys exactly `bullet, skills`, position max+1 |
| C16 | `resume-bullets-update.int.test.ts` four `RES-16` tests | yes - text only, skills only, both, project, DB row checked |
| C17 | `resume-bullets-update.int.test.ts` `RES-17 answers 204 and the bullet is gone…` | yes |
| C18 | `resume-bullets-create.int.test.ts` `RES-18 accepts an empty skillIds…` | yes |
| C19 | `resume-bullets-create.int.test.ts` `RES-19 answers 400 with the invalid field and writes nothing for an empty text, a text over 500 characters and more than 20 skills` | yes - the three refusals and 500 accepted; the comment at `:85` says 20 skills are accepted but the test never sends 20 (finding 5) |
| C20 | `resume-bullets-create.int.test.ts` two `RES-20` tests + `resume-bullets-update.int.test.ts` `RES-20 answers 422…` | yes - each case with the exact `invalidSkillIds` |
| C21 | `resume-bullets-create.int.test.ts` `RES-21 answers 422 in Problem Details on the 31st bullet…` | yes |
| C22 | `resume-bullets-create.int.test.ts` `RES-22 answers 404…` + `resume-bullets-update.int.test.ts` `RES-22 answers 404 and changes nothing…` | yes - eight targets × PATCH/DELETE and every wrong section |
| C23 | `resume-bullets-create.int.test.ts` `RES-23 keeps skillIds in the order they were marked and describes each skill once…` | yes - order `[react, own, node]`, dictionary keys once; boundary held by C32 |
| C24 | `resume-bullets-create.int.test.ts` `RES-24 brings a private skill promoted by the admin back with the same id and scope global` | yes |
| C25 | `resume-items-order.int.test.ts` three `RES-25` tests | yes - body keys exactly `ids`, `GET` order, positions renumbered, other account untouched |
| C26 | `resume-bullets-order.int.test.ts` two `RES-26` tests | yes |
| C27 | `resume-items-order.int.test.ts` `RES-27 answers 400 and keeps the order…` + `resume-bullets-order.int.test.ts` two `RES-27` tests | yes - every case named, positions unchanged |
| C28 | `resume-access.int.test.ts` four `RES-28` tests | yes - every route, both directions, all seven tables snapshotted; `userId` in the body ignored |
| C29 | `resume-access.int.test.ts` two `RES-29` tests | yes - the sweep is tied to the controller's route metadata, so a new route without a case fails |
| C30 | `resume-access.int.test.ts` `RES-30 answers 403 on every route…` | yes |
| C31 | `schema.int.test.ts` two `RES-31` tests | yes - `pg_constraint` lists only the two internal FKs |
| C32 | `skills-boundary.test.ts` four `RES-32` tests (api-unit) | yes - with a control that the service does import the index |
| C33 | `resume-logging.int.test.ts` two `RES-33` tests | yes - one event per write with id and actor, markers of every field absent from every line (own example extended it to refused writes) |
| C34 | `resume.spec.ts` `RES-34 captures: PageMasterResume at 1280 × 800…` -> `captures/PageMasterResume.running.png` | partial - every element the criterion lists is there and asserted, but the image does not show the card's resting state: the third bullet is caught mid hover/focus fade (`surface-hover` fill and a half-visible "⋯"), and the "⋯" of the tagged bullets the card draws at rest is hidden - findings 2 and 3 |
| C35 | `ResumePage.test.tsx` two `RES-35` + `resume-route.test.tsx` two `RES-35` + `sections.test.ts` `RES-35` | yes - section shown, `aria-current`, URL, one read |
| C36 | `sections.test.ts` three `RES-36` + `resume-route.test.tsx` two `RES-36` | yes |
| C37 | `ResumePage.test.tsx` `RES-37 shows the number of items of each section in mono…` + `counts.test.ts` + `form-page.test.tsx` | yes - `font-mono` and `textContent` equal to the bare label |
| C38 | `ResumePage.test.tsx` three `RES-38` + `counts.test.ts` five `RES-38` | partial - plural, singular and omission asserted exactly; the `warning` intent of the Alert the criterion names is not asserted (`ResumeIndex.tsx:44` passes it) - finding 5 |
| C39 | `ItemsSection.test.tsx` `RES-39 shows "%s" empty with its sentence and the "+" of the header` (×5) + `sections.test.ts` | yes |
| C40 | `ResumePage.test.tsx` three `RES-40` + `resume-route.test.tsx` `RES-40` + `server-functions.test.ts` | yes - "Tentar de novo" reads again (`GET /resume` once) |
| C41 | `ResumePage.test.tsx` `RES-41 shows the title of the topbar and no "Visualizar PDF"` | yes |
| C42 | `resume.spec.ts` `RES-42 the page does not scroll sideways at 375 px and at 1280 px…` (+ axe) | yes - profile, experiences (expanded) and educations at both widths, index above the section at 375 px; projects, certifications and languages are not opened, but they render through the same `ItemsSection` |
| C43 | `ProfileSection.test.tsx` `RES-43 shows the fields with the labels of the spec, filled with the saved profile` | yes |
| C44 | `ProfileSection.test.tsx` three `RES-44` + `use-autosave-field.test.tsx` `RES-44 saves a changed value once… the time of the browser` | yes - the hook test fixes the clock and asserts the hour |
| C45 | `ProfileSection.test.tsx` `RES-45 sends nothing when a field is left with the value it had` + `use-autosave-field.test.tsx` | yes |
| C46 | `ProfileSection.test.tsx` three `RES-46` | yes - nothing sent with one of the two filled |
| C47 | `ProfileSection.test.tsx` three `RES-47` + `ItemFields.test.tsx` + hook | yes - e-mail, URL; the limit case is C85 |
| C48 | `ProfileSection.test.tsx` three `RES-48` + `use-autosave-field.test.tsx` `RES-48 keeps the value, says the save failed and leaves the time as it was` | yes - the hook test keeps an earlier "Salvo às" unchanged |
| C49 | `ItemsSection.test.tsx` five `RES-49` + `item-header.test.ts` + `months.test.ts` | yes - each section's header and `font-mono` dates |
| C50 | `ItemsSection.test.tsx` two `RES-50` + `item-header.test.ts` | yes |
| C51 | `ItemFields.test.tsx` `RES-51 opens an empty item at the top of $section, in edition…` (×5) | yes - first article, focus on the first field, nothing sent |
| C52 | `ItemFields.test.tsx` `RES-52 says the required fields are missing…` (×5) + the experience without end | yes |
| C53 | `ItemFields.test.tsx` `RES-53 creates the $section item once the required fields are valid…` (×5) + two | yes - one `POST` with the exact body, then `PATCH` |
| C54 | `ItemFields.test.tsx` six `RES-54` | yes - fields filled, save on leave, nothing on unchanged; the "Excluir {item}" button of each section is asserted by the `RES-57` tests of `DeleteItem.test.tsx`, not by a `RES-54` one |
| C55 | `ItemFields.test.tsx` three `RES-55` | yes - end field gone, body `endDate: null` |
| C56 | `ItemsSection.test.tsx` four `RES-56` | yes |
| C57 | `DeleteItem.test.tsx` `RES-57 asks "$title" with "Excluir" in danger and "Cancelar"…` (×5) + `sections.test.ts` | yes - `bg-danger` asserted |
| C58 | `DeleteItem.test.tsx` four `RES-58` | yes - index number and Alert follow |
| C59 | `ItemFields.test.tsx` three `RES-59` | yes - message in the end field, `aria-invalid`, nothing sent |
| C60 | `BulletRow.test.tsx` three `RES-60` + `bullet.test.tsx` | yes - `text-body-lg`, tags, `text-warning` |
| C61 | `BulletRow.test.tsx` `RES-61 opens an empty field at the end of the item with the focus in it` | yes |
| C62 | `BulletRow.test.tsx` three `RES-62` + `BulletSkills.test.tsx` `RES-62 opens the field of skills of a bullet just created` | yes |
| C63 | `BulletRow.test.tsx` two `RES-63` | yes |
| C64 | `BulletRow.test.tsx` four `RES-64` + `inline-edit` tests | yes - save on leave, `Esc` sends nothing |
| C65 | `BulletRow.test.tsx` `RES-65 goes back to the old text and sends nothing when the edited text is emptied` | yes |
| C66 | `BulletSkills.test.tsx` three `RES-66` | yes - menu, "sem skill", "Criar “…” como skill privada" with the seven categories |
| C67 | `BulletSkills.test.tsx` six `RES-67` | yes - `PATCH` body on include and remove, "Concluir" closes |
| C68 | `BulletRow.test.tsx` two `RES-68` | yes - no `alertdialog`, Alert follows |
| C69 | `BulletRow.test.tsx` `RES-69 gives the menu "⋯" to every bullet…` + `bullet.test.tsx` | yes - class-level in jsdom, real menu opened in the E2E axe test |
| C70 | `resume.spec.ts` `RES-70 RES-71 dragging an item and a bullet by the handle…` | yes - real mouse drag, order kept after reload |
| C71 | `resume.spec.ts` `RES-70 RES-71 dragging an item and a bullet by the handle…` | yes |
| C72 | `resume.spec.ts` `RES-72 RES-73 the keyboard picks, moves and drops…` | yes - Space and Enter, an item and a bullet, live region text, kept after reload |
| C73 | `resume.spec.ts` `RES-72 RES-73 …; Esc changes nothing` | yes - for a bullet, no non-GET request; the item case is held by `Reorder.test.tsx` `RES-73` and `sortable.browser.test.tsx` `RES-73` |
| C74 | `Reorder.test.tsx` two `RES-74` + `use-reorder.test.tsx` eight `RES-74` | yes |
| C75 | `Reorder.test.tsx` two `RES-75` + `use-reorder.test.tsx` three `RES-75` | yes |
| C76 | `sortable.test.tsx` three `RES-76` + `sortable.browser.test.tsx` `RES-76 reads the instructions and the role description of the handle from the caller` | yes - no text of its own; `Sortable.stories.tsx` exists |
| C77 | `resume-route.test.tsx` two `RES-77` | yes |
| C78 | `router.test.tsx` `RES-78 opens /resume from "Abrir currículo" in step 02` | yes |
| C79 | `router.test.tsx` two `RES-79` | yes - loader data is exactly `{ ready: true }` |
| C80 | `router.test.tsx` `RES-80 keeps step 02 without "Concluído"…` | yes |
| C81 | `resume-route.test.tsx` `RES-81 sends an admin session on /resume to /admin` | yes |
| C82 | `ItemsSection.test.tsx` two `RES-82` | yes - 49 enabled, 50 disabled |
| C83 | `BulletRow.test.tsx` two `RES-83` | yes - 29 enabled, 30 disabled |
| C84 | `ProfileSection.test.tsx` `RES-84 disables "+ Link" at five links…` | yes |
| C85 | `ProfileSection.test.tsx` `RES-85 shows the limit of %s…` (×3) + `ItemFields.test.tsx` `RES-85 shows the limit and sends nothing…` | no - proved on name, headline, summary and a project name only; the bullet text fields (new and edited) send a text over 500 and never show the limit - finding 1 |
| C86 | `resume-summary.int.test.ts` five `RES-86` | yes - false/false/false/true, blank name, no writes, catalog not called |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| 1. RES-85 does not hold for the bullet text: a text over 500 characters is sent and the field never shows the limit | Own example (jsdom, `fireEvent.change` with 501 characters, then blur): new bullet -> `POST /resume/experiences/:id/bullets` sent, edited bullet -> `PATCH …/bullets/:bulletId` sent, no limit text in the page. In a browser `maxLength` (`BulletList.tsx:55`, `BulletRow.tsx:96`) cuts a paste at 500 without a word and the cut text is saved: what the person pasted is lost silently. The RES-85 tests (`ProfileSection.test.tsx:188`, `ItemFields.test.tsx:334`) cover only profile and item fields | Validate the bullet text like the other fields (no `maxLength` truncation, or `maxLength` plus a check of the pasted length) and show "Use no máximo 500 caracteres." in the field without sending; add `RES-85` cases for the new and the edited bullet | |
| 2. The spec contradicts the binding card on the bullet menu: the card draws "⋯" at rest on every tagged bullet, the product hides it on a wide screen until hover or focus, and `## Differences from the source` does not list it | `docs/design/system/components/PageMasterResume/preview.html:32-33` (the `ellipsis` button always rendered) and `captures/PageMasterResume.png` (⋯ beside the first two bullets) vs `spec.md:60` (assumption "aparece ao passar o mouse ou focar", Confirmed `n`), `packages/ui/src/components/bullet/bullet.tsx:62` (`md:opacity-0`) and `PageMasterResume.running.png` (no ⋯ on the tagged bullets) | Either show "⋯" at rest as the card does, or ask the user and add the row to `## Differences from the source` with `Confirmed: y` | |
| 3. The running capture is not the resting state the card draws: the third bullet shows the `surface-hover` fill and a half-faded "⋯" | `captures/PageMasterResume.running.png` (third bullet, "Conduzi…"); `resume.spec.ts:531` clicks away and screenshots at once while `bullet.tsx:26` runs a 150 ms `transition-colors` and `:61` a 150 ms `transition-opacity` | Wait for the row to lose `:focus-within`/hover and the transition to end (or disable transitions for the capture) before `page.screenshot`, then regenerate the image | |
| 4. Two controls differ from the card and are not in `## Differences from the source`: a collapsed item shows the pencil "Editar" beside the chevron (the card draws only the chevron), and "+ Experiência" / "+ Bullet" are a literal "+" in the text where the card draws the `plus` icon | `PageMasterResume.png` (collapsed "Desenvolvedora Back-end" has only the chevron; buttons with the plus icon) vs `PageMasterResume.running.png`; `ItemCard.tsx:80` (pencil on every item), `model/sections.ts:47`, `model/messages.ts:58` | Match the card (pencil only on the expanded item, `plus` icon with "Experiência"/"Bullet") or record both as approved differences | |
| 5. Assertions looser than the criterion: C2 asserts the saved order for experiences only and not the `skills` dictionary; C13 proves the 50 limit and the race on experiences only; C38 does not assert the `warning` intent of the Alert; C19's comment says 20 skills are accepted but the test never sends 20 | `resume-read.int.test.ts:27`, `resume-items-create.int.test.ts:109`, `ResumePage.test.tsx:67`, `resume-bullets-create.int.test.ts:85`. The behaviour held in own examples (limit on three other sections, order of educations and languages), so these are weak tests, not bugs | Loop C2 and C13 over the five sections, assert the Alert's warning class in C38, send 20 skills in C19 | |
| 6. A local gate log was committed to the public repository: `gate.out` (1 287 lines) at the repo root, with the author's absolute home path | `git log 9758237..bc1dc79 -- gate.out` -> `a319349 feat(api): update resume items`; `gate.out:82` and five more lines hold `/home/<user>/Documentos/…`. AGENTS.md: no personal or internal detail in the public repo | `git rm gate.out` and add `gate.out` (or `*.out`) to `.gitignore` before the PR | |
