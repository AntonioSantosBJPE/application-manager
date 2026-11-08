# Skills verification

**Verdict**: FAIL
**Proofs**: sem `proofs.md` neste projeto (`docs/workflow.md#gates-e-tempo`); rodada do orquestrador na `HEAD` 5702d7f, toda verde: `pnpm build`, `typecheck`, `lint`, `pnpm test --force` (contracts 41, guardrails 32, api unit 73, web 401, ui 474), `pnpm test:integration` (163), `pnpm test:e2e` (54)
**Verifier**: independent sub-agent (author != verifier)
**Closure**: um round de correção (Sonnet 5.5), achados fechados em `b707f9f`, `d7eb144` e `ba12ec7`; gates refeitos pelo orquestrador na `HEAD` final (ver `tasks.md` `## Handoff`). Sem segundo Verifier.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `packages/contracts/src/skills.test.ts` `SKL-01 derives the key of the spec examples` (+ `SKL-01 ignores case, accents and separators…`, `SKL-01 keeps C, C++ and C# apart…`) | yes |
| C2 | `apps/api/src/modules/skills/seed/seed.int.test.ts` `SKL-02 holds at least 200 global skills…` e `SKL-02 stores every alias of the seed…` | yes |
| C3 | `apps/api/src/modules/skills/seed/global-skills.test.ts` `SKL-03 holds no two skills with the same normalized key` e `SKL-03 holds no alias whose key is a skill key or the key of another alias` | yes |
| C4 | `apps/api/src/modules/skills/infra/schema.int.test.ts` `SKL-04 holds no foreign key from the skills schema to another schema` | yes |
| C5 | `apps/api/src/modules/skills/http/skills-search.int.test.ts` `SKL-05 answers 200 with an array of { id, name, category, scope }…` (+ `SKL-05 returns at most 20 items`, `…empty array…`, `…"node", "nodejs"…`) | yes |
| C6 | `skills-search.int.test.ts` `SKL-06 lists the name matches first and then the alias-only matches…` e `SKL-06 returns the skill by its official name when only an alias matches` | yes |
| C7 | `skills-search.int.test.ts` `SKL-07 lists the first 20 visible skills in key order when q is absent, empty or has an empty key` | yes |
| C8 | `skills-search.int.test.ts` `SKL-08 never returns the private skill of another person` | yes |
| C9 | `skills-search.int.test.ts` `SKL-09 answers 400 in Problem Details when q has more than 60 characters, and 200 at 60` | yes |
| C10 | `skills-search.int.test.ts` `SKL-10 marks a global skill as global and the own private skill as private` | yes |
| C11 | `apps/api/src/modules/skills/http/skills-create.int.test.ts` `SKL-11 creates the private skill of the session user and answers 201…` | yes |
| C12 | `skills-create.int.test.ts` `SKL-12 answers 200 with the own private skill…` e `SKL-12 answers 200 with the global skill when the name is its name or an alias…` | yes |
| C13 | `skills-create.int.test.ts` `SKL-13 saves one skill and answers 201 to one of two simultaneous requests…` (+ oito requisições) | yes |
| C14 | `skills-create.int.test.ts` `SKL-14 creates a separate private skill, with another id…` | yes |
| C15 | `skills-create.int.test.ts` `SKL-15 answers 400 in Problem Details naming the invalid field and writes nothing` | yes - mas ver achado 1 (texto com U+0000 dá 500) |
| C16 | `skills-create.int.test.ts` `SKL-16 takes the owner from the session and ignores ownerUserId and scope in the body` | yes |
| C17 | `apps/api/src/modules/skills/http/skills-admin-promote.int.test.ts` `SKL-17 makes the private skill global, keeping id, name and category…` | yes |
| C18 | `skills-admin-promote.int.test.ts` `SKL-18 makes the search of any member return the promoted skill as global with the same id` | yes |
| C19 | `skills-admin-promote.int.test.ts` `SKL-19 answers 409 in Problem Details and leaves the skill private when the key is a global key or an alias` | yes |
| C20 | `skills-admin-promote.int.test.ts` `SKL-20 answers 200 without changing anything when the skill is already global` | yes |
| C21 | `skills-admin-promote.int.test.ts` `SKL-21 answers 404 in Problem Details for an id that is not a uuid and for one that does not exist` | yes |
| C22 | `skills-admin-promote.int.test.ts` `SKL-22 answers 403 to a member on the promotion…` e `skills-aliases-create.int.test.ts` `SKL-22 answers 403 to a member on the alias route and on GET /admin/skills…` | yes |
| C23 | `skills-create.int.test.ts` `SKL-23 answers 403 to an admin on GET and POST /skills and writes nothing` | yes |
| C24 | `skills-admin-promote.int.test.ts` `SKL-24 promotes exactly one of two privates with the same key at the same time…` | yes - `Promise.all` real, três rodadas |
| C25 | `apps/api/src/modules/skills/http/skills-invariants.int.test.ts` `SKL-25 registers no route that makes a global skill private or deletes a skill` | yes |
| C26 | `apps/api/src/modules/skills/http/skills-aliases-create.int.test.ts` `SKL-26 saves the alias as typed, with its normalized key, and answers 201 with { id, alias }` | yes |
| C27 | `skills-aliases-create.int.test.ts` `SKL-27 lets the search of a member find the skill by the alias and answer the official name` | yes |
| C28 | `skills-aliases-create.int.test.ts` `SKL-28 answers 409 in Problem Details and saves nothing for the key of a global, the skill own key or the alias of another skill` | yes |
| C29 | `skills-aliases-create.int.test.ts` `SKL-29 answers 200 with the existing alias when the skill already has it, without a second row` | yes |
| C30 | `skills-aliases-create.int.test.ts` `SKL-30 answers 422 with the title Unprocessable Content for a private skill and saves nothing` | yes |
| C31 | `skills-aliases-create.int.test.ts` `SKL-31 answers 404 for an unknown skill and 400 for an empty, long or keyless alias, saving nothing` | yes - mas ver achado 1 |
| C32 | `skills-invariants.int.test.ts` `SKL-32 never leaves a global key equal to another global key or an alias when promote, rename, add alias and edit alias race for one key` | yes - 5 escritas paralelas, 10 rodadas, ordem girando |
| C33 | `apps/api/src/modules/skills/http/skills-admin-list.int.test.ts` `SKL-33 answers { items, nextCursor, counts } and every item has exactly id, name, category, scope and aliases, with no owner` | yes |
| C34 | `skills-admin-list.int.test.ts` `SKL-34 follows nextCursor to the end: 50 per page, alphabetical by key…` | yes |
| C35 | `skills-admin-list.int.test.ts` `SKL-35 returns only what matches scope, category and q together…` | yes |
| C36 | `skills-admin-list.int.test.ts` `SKL-36 counts the whole catalog and its privates, the same with and without filters` | yes |
| C37 | `skills-admin-list.int.test.ts` `SKL-37 answers 400 in Problem Details for an invalid scope, category or cursor` (+ `domain/cursor.test.ts`) | yes - mas ver achado 1 (cursor com U+0000 dá 500) |
| C38 | `apps/web/src/features/skills/components/SkillsCatalog.test.tsx` `SKL-38 shows the title with the total of the catalog in mono, the Apelido button with the plus icon and the info note` (+ `SKL-38 shows the chips Todas and Privadas…`, `SKL-38 lists the skills in the alphabetical order…`) | yes |
| C39 | `apps/web/src/router.test.tsx` `SKL-39 shows "Catálogo de skills" between Convites and Status do sistema, with aria-current="page" on /admin/skills` | yes |
| C40 | `apps/web/src/features/skills/components/SkillRow.test.tsx` `SKL-40 shows a global row…`, `SKL-40 shows a private row…`, `SKL-40 opens the menu of a global row with Enter…` | yes |
| C41 | `SkillsCatalog.test.tsx` `SKL-41 changes q only 300 ms after the last key…` (+ demais `SKL-41`) e `router.test.tsx` `SKL-41 puts the chosen chips in the address…` / `SKL-41 reads the filters from the address…` | yes |
| C42 | `SkillsCatalog.test.tsx` `SKL-42 removes the category filter when the pressed category chip is used again` | yes |
| C43 | `SkillsCatalog.test.tsx` `SKL-43 shows the empty state with Limpar filtros, which resets scope, category and q` e `router.test.tsx` `SKL-43 Limpar filtros takes scope, category and q out of the address` | yes |
| C44 | `SkillsCatalog.test.tsx` `SKL-44 shows Carregar mais only while the answer has a nextCursor and appends the next page` e `SKL-44 hides Carregar mais when the first answer has no nextCursor` | yes |
| C45 | `SkillsCatalog.test.tsx` `SKL-45 asks "Promover {nome}?"…` e `SKL-45 calls the promotion on confirm and shows the row without the badge and the button, with Privadas one lower and the total equal` | yes |
| C46 | `SkillsCatalog.test.tsx` `SKL-46 does not call the api on Cancelar and gives the focus back to the Promover button of the row` (+ Esc) | yes |
| C47 | `SkillsCatalog.test.tsx` `SKL-47 closes the dialog on a 409, keeps the row private and shows the danger Alert with the exact text` | yes |
| C48 | `apps/web/src/features/skills/components/AddAliasDialog.test.tsx` `SKL-48 sends the chosen skill and the alias, closes the dialog, shows the alias on the row…` (+ `SKL-48 offers only global skills…`, `…without choosing an option…`) | yes |
| C49 | `AddAliasDialog.test.tsx` `SKL-49 keeps the dialog open with "Esse apelido já pertence a outra skill." on the field Apelido after a 409` e `SKL-49 shows the error of a 400 on the field Apelido…` | yes |
| C50 | `SkillsCatalog.test.tsx` `SKL-50 keeps the confirm button disabled and busy while the promotion is pending…`, `EditSkillDialog.test.tsx` / `AddAliasDialog.test.tsx` / `AliasesDialog.test.tsx` `SKL-50 …`, `confirm-dialog.async.test.tsx` `SKL-50 …` | yes - as quatro chamadas cobertas |
| C51 | `SkillsCatalog.test.tsx` `SKL-51 shows a danger Alert with the unavailable text and no rows when the read fails` e `router.test.tsx` `SKL-51 sends the admin to the login with the expired notice when the catalog answers 401` | yes |
| C52 | `tests/e2e/specs/browser/skills.spec.ts` `SKL-52 axe finds no WCAG 2.x AA violation in the states of the catalog, in both themes` | yes - os nove estados, nos dois temas |
| C53 | `skills.spec.ts` `SKL-53 the menu and the dialogs work by keyboard alone, and nothing scrolls sideways at 375 and 1280 px` | yes - E2E cobre menu, "Editar skill" e "Apelidos"; foco/trap/Esc de `ConfirmDialog`, `Dialog` e `Combobox` estão nos browser tests de `packages/ui` |
| C54 | `apps/web/src/features/skills/api/server-functions.test.ts` `SKL-54 lists exactly the six admin endpoints` e `SKL-54 has no function for GET /skills or POST /skills` | yes |
| C55 | `apps/web/src/features/skills/components/PrivateSkillsSummary.test.tsx` `SKL-55 shows 8 tags and "e mais 3" when there are 11` (+ demais `SKL-55`) e `router.test.tsx` `SKL-55 opens /admin/skills?scope=private from Abrir catálogo` | yes - ordem alfabética vem da API (provada em C34/C35) |
| C56 | `PrivateSkillsSummary.test.tsx` `SKL-56 says "Nenhuma skill privada aguardando promoção." and keeps Abrir catálogo when there are none` | yes |
| C57 | `router.test.tsx` `SKL-57 shows the alert in the widget while the other widgets stay on the screen when the skills read fails` | yes |
| C58 | `apps/api/src/modules/skills/application/skills-catalog.int.test.ts` `SKL-58 is exported by the module index…` e `SKL-58 returns the global ids and the own private ids` | yes |
| C59 | `skills-catalog.int.test.ts` `SKL-59 leaves out the private skill of another person, an id that does not exist and text that is not a uuid` | yes |
| C60 | `apps/api/src/modules/skills/http/skills-logging.int.test.ts` `SKL-60 logs { event, skillId, actorId } once for each of the six operations…` | yes |
| C61 | `skills-logging.int.test.ts` `SKL-61 writes no e-mail, session token, cookie or skill name in any log line…` | yes |
| C62 | `apps/api/src/modules/skills/http/skills-update.int.test.ts` `SKL-62 updates name and category of a global skill, keeps the id, recalculates the key and answers 200` | yes |
| C63 | `skills-update.int.test.ts` `SKL-63 finds the new name, no longer finds the old one, and creates no alias` | yes |
| C64 | `skills-update.int.test.ts` `SKL-64 answers 409 and changes nothing for the key of another global or of any alias, and accepts the same key in another spelling` | yes |
| C65 | `skills-update.int.test.ts` `SKL-65 answers 422 with the title Unprocessable Content for a private skill and changes nothing` | yes |
| C66 | `skills-update.int.test.ts` `SKL-66 answers 400 for an empty body, a bad name or a bad category, and 404 for an unknown id, changing nothing` | yes - mas ver achado 1 |
| C67 | `apps/api/src/modules/skills/http/skills-aliases-edit.int.test.ts` `SKL-67 changes the text and the key of the alias and answers 200 with its id and new text` | yes |
| C68 | `skills-aliases-edit.int.test.ts` `SKL-68 answers 409 for the key of a global or of an alias, 400 for an invalid alias and 404 for a missing or foreign one…` | yes - mas ver achado 1 |
| C69 | `skills-aliases-edit.int.test.ts` `SKL-69 deletes the alias, answers 204 with no body and the search for it stops finding the skill` | yes |
| C70 | `skills-aliases-edit.int.test.ts` `SKL-70 answers 404 to an alias already deleted, an unknown skill or an alias of another skill, deleting nothing` | yes |
| C71 | `skills-aliases-edit.int.test.ts` `SKL-71 answers 403 to a member on PATCH /skills/:id, PATCH and DELETE of an alias, changing nothing` | yes |
| C72 | `apps/web/src/features/skills/components/EditSkillDialog.test.tsx` `SKL-72 opens "Editar skill" with Nome and Categoria filled…` e `SKL-72 sends the new values, closes the dialog and shows the row with the new name and category and the totals equal` | yes |
| C73 | `EditSkillDialog.test.tsx` `SKL-73 keeps the dialog open with "Já existe uma skill ou apelido com esse nome." on the field Nome after a 409` e `SKL-73 shows the error of a 400 on the field the api named…` | yes |
| C74 | `apps/web/src/features/skills/components/AliasesDialog.test.tsx` `SKL-74 opens "Apelidos de {nome}" with each alias, its actions Editar and Remover, and a field to add another` e `SKL-74 says "Esta skill não tem apelidos."…` | yes |
| C75 | `AliasesDialog.test.tsx` `SKL-75 turns the alias into a field with the current text; Salvar shows the new text in the dialog and on the row` e `SKL-75 keeps the field open with "Esse apelido já pertence a outra skill." after a 409` | yes |
| C76 | `AliasesDialog.test.tsx` `SKL-76 asks "Remover o apelido {apelido}?"…`, `SKL-76 returns the focus to Remover… with Esc`, `SKL-76 removes the alias from the dialog and from the row on confirm…` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| Um nome ou apelido com o caractere NUL (U+0000) passa pelo contrato e o Postgres o recusa: `POST /skills`, `POST /skills/:id/aliases` (e, pela mesma raiz, `PATCH /skills/:id` e `PATCH …/aliases/:aliasId`) respondem `500` em vez de `400` (SKL-15, SKL-31, SKL-66, SKL-68). Um cursor válido em base64url cujo `key` tem U+0000 também dá `500` em vez de `400` (SKL-37) | Exemplo descartável na `HEAD`: `POST /skills {"name":"Probe\u0000Nul","category":"tool"}` → 500; `POST /skills/<Node.js>/aliases {"alias":"probe\u0000alias"}` → 500; `GET /admin/skills?cursor=<base64url de {"key":"a\u0000","id":uuid}>` → 500. `packages/contracts/src/skills.ts:21-29` (`skillTextSchema` só apara e conta) e `apps/api/src/modules/skills/domain/cursor.ts:25` (aceita qualquer `key` texto, que vai a `skills.repository.ts:172` como `::text`) | No contrato, recusar caracteres de controle (`\p{Cc}`) em `skillTextSchema` (ou removê-los antes de aparar); em `decodeCursor`, aceitar só `key` que seja uma chave normalizada (`key === normalizeSkillKey(key)`); acrescentar os casos com U+0000 aos testes `SKL-15`, `SKL-31`, `SKL-66`, `SKL-68` e `SKL-37` | `b707f9f` (contrato recusa `\p{Cc}`; C15, C31, C66, C68 agora com U+0000 e U+0007) e `d7eb144` (cursor só com chave normalizada; C37) |
| Achado da passada de correção, não do Verifier: o teste de C32 era intermitente (~40% das rodadas completas de `test:integration`): o `POST` e o `PATCH` de apelido disputavam a chave na mesma skill, e quando o `PATCH` ganhava o `POST` respondia `200` pela idempotência de SKL-29, contra a asserção "exatamente um 2xx". O invariante SKL-32 nunca quebrou | `skills-invariants.int.test.ts` rodada `200,200,409,409,409` | o `PATCH` de apelido passa a disputar a chave numa outra global; nenhuma asserção muda | `ba12ec7` (C32; 7/7 rodadas completas verdes) |

## Own examples

Teste descartável `apps/api/src/modules/skills/http/zz-verifier-probe.int.test.ts` (Postgres real, helpers de `apps/api/test/`), rodado com `pnpm --filter @am/api exec vitest run --project integration` e apagado em seguida.

- **Cursor no limite exato (SKL-34):** 50 privadas com `scope=private` → 50 itens e `nextCursor: null`; com 51 → 50 itens com cursor, a página seguinte traz 1 item e `nextCursor: null`. Segura.
- **Unicode na chave (SKL-01, SKL-12):** `POST /skills {"name":"Ｃ＃"}` (largura total) → `200` com a global `C#`, sem criar linha. `ç` × 60 → `201`. Segura.
- **`+` e `#` na busca (SKL-05):** `q=c++` → `["C++"]`; `q=C#` → `["C#"]`; `q=+` → `["C++"]`; `q=#` → `["C#","F#"]`; "C" não aparece em nenhuma. Segura.
- **Colisão só depois de normalizar (SKL-28, SKL-64):** apelido `N.o.d.e - J.S` em React → `409`; renomear React para `P.O.S.T.G.R.E.S` (apelido de PostgreSQL) → `409`. Segura.
- **Rajada (SKL-13):** 30 `POST /skills` paralelos do mesmo member com o mesmo nome → um `201` e 29 `200`. Segura.
- **NUL (U+0000):** nome, apelido e chave do cursor → `500` (achado 1). `q` com NUL → `200` (a normalização o descarta).
- Observação, sem achado: o limite de 60 conta unidades UTF-16 do texto como chegou, sem NFC; 31 "é" em forma decomposta (NFD) recebem `400`. A spec diz "caracteres" sem fixar a forma; vale decidir se o contrato normaliza para NFC antes de contar.
- Observação, sem achado: no web, um texto de busca acima de 60 caracteres vai para o endereço, é descartado por `parseCatalogSearch` e a lista volta sem filtro enquanto o campo continua mostrando o texto; o `SearchInput` não tem `maxLength`. Nenhum critério fixa esse caso.

Também conferido no diff sem check próprio: `DropdownMenu` não modal por padrão (`dropdown-menu-page.browser.test.tsx`), selo neutro do `StatusBadge` (`status-badge.neutral*.test.tsx`), `ConfirmDialog` que fecha quando `onConfirm` rejeita (`confirm-dialog.async.test.tsx` `SKL-50 ends the wait when the promise rejects…`) e a atualização das linhas no lugar (testes `SKL-45`, `SKL-72`, `SKL-75`, `SKL-76`) — todos com teste. Spec contra as cartas `PageSkills` e `PageAdminDashboard` (terceiro widget): rótulos, ordem da sidebar, ícones `plus`/`tags`/`arrow-right`, botão `secondary` "Promover" e ação `ghost` "Abrir catálogo" batem; as três diferenças são as confirmadas em `Differences from the source`.
