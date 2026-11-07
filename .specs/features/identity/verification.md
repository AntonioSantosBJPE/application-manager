# Identity verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at d52345e
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `identity-cli.int.test.ts` `create-admin creates a lowercase admin and exits 0` | yes |
| C2 | `identity-cli.int.test.ts` `create-admin refuses an existing email in any role` | yes |
| C3 | `identity-cli.int.test.ts` `reset-password changes the hash keeps the role and revokes every session` | yes (only a member is reset; the admin role is not tried, the code never touches the role) |
| C4 | `identity-cli.int.test.ts` `reset-password refuses an unknown email without creating a user` | yes |
| C5 | `identity-cli.int.test.ts` `refuses passwords of 11 and 129 characters without writing` | yes (create-admin only; the 128 side is covered by the contract test) |
| C6 | `identity-cli.int.test.ts` `reads the password from stdin and rejects it as an argument` | no - the hidden prompt is only exercised through an injected fake `promptPassword`; nothing asserts that typing is not echoed (finding 6) |
| C7 | `route-access.int.test.ts` `no route creates an admin or changes a password` | yes |
| C8 | `login.int.test.ts` `POST /auth/login creates a session sets the cookie and answers 204 for a member` | yes |
| C9 | `login.int.test.ts` `POST /auth/admin/login creates a session sets the cookie and answers 204 for an admin` | yes |
| C10 | `login.int.test.ts` `login failures answer an identical 401 for wrong password unknown email and wrong entrance` | yes |
| C11 | `login.int.test.ts` `runs the password verifier once for a known and an unknown email` | yes |
| C12 | `password-hasher.test.ts` `stores argon2id phc with m=19456 t=2 p=1` | yes |
| C13 | `session.service.int.test.ts` `stores only the sha-256 of 32-byte session and invitation tokens` | no - never asserts 32 bytes (a 16-byte `TOKEN_BYTES` survives) and never touches an invitation token despite its name (finding 2) |
| C14 | `session.guard.int.test.ts` `session cookie carries HttpOnly SameSite=Lax Path=/ Max-Age=2592000 and no Domain` | yes |
| C15 | `session.guard.int.test.ts` `session cookie is named __Host-am_session with Secure by default` | yes |
| C16 | `auth-session.int.test.ts` `GET /auth/me answers 200 with the session user` | yes |
| C17 | `session.guard.int.test.ts` `answers 401 for a missing expired revoked and unknown session` | yes |
| C18 | `session.guard.int.test.ts` `extends the session and resends the cookie only below 29 days` | yes (the exact 29 d edge is held by `session.service.int.test.ts` and `session-renewal.test.ts`) |
| C19 | `auth-session.int.test.ts` `POST /auth/logout revokes the session clears the cookie and answers 204 with or without a session` | no - the clearing cookie is only asserted with `Secure=false`; under `__Host-` a clear without `Secure` is ignored by the browser and the test would not notice (finding 5) |
| C20 | `login.int.test.ts` `POST /auth/login deletes only the expired sessions of the user` | yes |
| C21 | `session.guard.int.test.ts` `answers 403 when the role differs in both directions` | yes |
| C22 | `session.guard.int.test.ts` `requires a session unless public and keeps /health public` | yes |
| C23 | `invitations-create.int.test.ts` `takes invited_by from the session and ignores client ids` | yes |
| C24 | `problem-details.int.test.ts` `every identity error uses application/problem+json` | yes |
| C25 | `identity.spec.ts` `stack logs contain no password token or cookie after a full journey` | yes (searches the real secrets of the run in api and web logs) |
| C26 | `route-access.int.test.ts` `every registered route declares access and an undeclared fixture is named in the failure` | yes |
| C27 | `login-lockout.int.test.ts` `answers 429 after 5 pair failures even with the correct password` | yes |
| C28 | `login-lockout.int.test.ts` `answers 429 for any email after 50 failures from one ip` | yes |
| C29 | `login-lockout.int.test.ts` `sends Retry-After until the oldest counted failure leaves the window` | no - the five failures share one instant, so oldest and newest are indistinguishable; only `lockout.test.ts` (not the proof) separates them (finding 12) |
| C30 | `login-lockout.int.test.ts` `treats known and unknown emails alike with the same 429 body` | yes |
| C31 | `login-lockout.int.test.ts` `a blocked attempt runs no argon2 and records no failure` | yes |
| C32 | `login-lockout.int.test.ts` `a success clears the pair and keeps the ip count` | no - asserts `pair_cleared` flags and row counts, never that the cleared rows still block the IP; excluding them from the IP count survives (finding 1) |
| C33 | `login-lockout.int.test.ts` `accepts attempts after the window and deletes expired rows on the next failure` | yes |
| C34 | `login-lockout.int.test.ts` `both entrances share the failure counters` | yes |
| C35 | `client-ip.spec.ts` `failures from two client ips are counted separately through the web` | yes |
| C36 | `client-ip.spec.ts` `a forged X-Forwarded-For does not change the count` | yes |
| C37 | `invitations-create.int.test.ts` `answers 201 with a 7-day invitation and a url from WEB_PUBLIC_URL` | no - 7 days is asserted within 6.9 to 7.1 days against the real `Date.now()`; a 9-day-minus-2h or 7 d + 2 h `INVITATION_DURATION_MS` survives (finding 4) |
| C38 | `invitations-create.int.test.ts` `answers 403 to a member and creates nothing` | yes |
| C39 | `invitations-create.int.test.ts` `answers 409 for an email that has an account` | yes |
| C40 | `invitations-create.int.test.ts` `revokes the previous pending invitation of the email` | yes |
| C41 | `invitations-accept.int.test.ts` `GET /invitations/:token answers 200 with email and expiresAt for a pending invitation` | yes |
| C42 | `invitations-accept.int.test.ts` `invalid invitations answer 410 for unknown expired accepted and revoked tokens on both endpoints` | yes |
| C43 | `invitations-accept.int.test.ts` `creates the member marks accepted_at starts a session and answers 201` | yes |
| C44 | `invitations-accept.int.test.ts` `answers 400 for out-of-range password and name and keeps the invitation pending` | yes (the 12/128/1/120 accepted edges are held by `identity.test.ts` in contracts) |
| C45 | `invitations-accept.int.test.ts` `two concurrent accepts create one user and the other gets 410` | yes (two real overlapping Argon2 hashes reach the conditional UPDATE) |
| C46 | `invitations-accept.int.test.ts` `revokes the current session before starting the new one` | yes |
| C47 | `identity.spec.ts` `a member signs in and reaches the preserved route with name and Sair` | yes |
| C48 | `identity.spec.ts` `an admin signs in and reaches the preserved route or /admin` | yes (the `/admin` default is walked by every `signIn` helper) |
| C49 | `LoginForm.test.tsx` `shows the 401 message and keeps the email` | yes |
| C50 | `LoginForm.test.tsx` `shows the 429 message with minutes rounded up` | yes (the 1/59/60/61/900 s table is in `messages.test.ts`) |
| C51 | `outages.spec.ts` `shows the unavailable message without redirecting to login when the api is down` | yes |
| C52 | `identity.spec.ts` `the server redirects / to /login preserving the route` | yes |
| C53 | `identity.spec.ts` `the server redirects /admin routes to /admin/login preserving the route` | yes |
| C54 | `identity.spec.ts` `an action with an expired session opens login with the expired message and the route` | yes (revoked and past-expiry both walked) |
| C55 | `messages.test.ts` `safeRedirect falls back for absolute protocol-relative and backslash paths` | yes |
| C56 | `identity.spec.ts` `a member on /admin sees the no-access message and no admin data` | yes (the `href="/"` is held by `AccessScreens.test.tsx` and `router.test.tsx`) |
| C57 | `identity.spec.ts` `a signed-in admin on / goes to /admin` | yes |
| C58 | `identity.spec.ts` `a signed-in user on the login of their area goes to its home` | yes |
| C59 | `identity.spec.ts` `Sair ends the session and opens the login of the area` | yes |
| C60 | `AcceptInvitationForm.test.tsx` `shows the invited email read-only and the password rule` | yes |
| C61 | `identity.spec.ts` `the full journey goes from cli to admin invite to accepted member home` | yes |
| C62 | `AcceptInvitationForm.test.tsx` `shows the invalid message without a form on 410 at open and at submit` | yes |
| C63 | `identity.spec.ts` `/invite responds with Referrer-Policy no-referrer` | yes |
| C64 | `identity.spec.ts` `authenticated pages and /invite respond with Cache-Control no-store` | yes |
| C65 | `identity.spec.ts` `a cross-origin post to a server function is refused and never reaches the api` | yes (controlled by an accepted post whose id reaches the api log) |
| C66 | `status-page.spec.ts` `server html shows API and Banco de dados with their state` | yes |
| C67 | `identity.spec.ts` `login invite and home render the auth and dashboard archetypes` | yes |
| C68 | `identity.spec.ts` `identity screens have no axe violations or horizontal scroll in both themes and widths` | no - axe runs only on resting states; the link block, the error and expired alerts, the unavailable screen and the open confirm dialog are never scanned (finding 8) |
| C69 | `LoginForm.test.tsx` `disables submit while waiting and sends one request` | no - covers `LoginForm` only; the "Convidar" form (a double submit would revoke the link just shown) has no pending-state test (finding 11) |
| C70 | `invitations-admin.int.test.ts` `GET /invitations lists only pending invitations newest first with cursor and total` | yes |
| C71 | `invitations-admin.int.test.ts` `DELETE /invitations/:id marks revoked_at and answers 204` | yes |
| C72 | `invitations-admin.int.test.ts` `DELETE /invitations/:id answers 404 for an unknown or non-pending invitation` | yes |
| C73 | `invitations-admin.int.test.ts` `invitations administration answers 403 to a member on list and revoke` | yes |
| C74 | `invitations-admin.int.test.ts` `GET /invitations never returns a token or its hash` | yes |
| C75 | `InvitationsPanel.test.tsx` `shows the link once with copy and adds the email to the list` | yes |
| C76 | `InvitationsPanel.test.tsx` `copies the link and shows Copiado` | yes |
| C77 | `InvitationsPanel.test.tsx` `keeps the link selectable and shows the message when copy fails` | yes |
| C78 | `InvitationsPanel.test.tsx` `shows the existing account message and keeps the value` | yes |
| C79 | `InvitationsPanel.test.tsx` `asks confirmation with the email before revoking` | yes |
| C80 | `InvitationsPanel.test.tsx` `removes the invitation and updates the total after confirming` | yes |
| C81 | `InvitationsPanel.test.tsx` `shows the empty message and the form` | yes |
| C82 | `InvitationsPanel.test.tsx` `loads the next page with nextCursor` | yes |
| C83 | `identity.spec.ts` `the admin dashboard shows status pending total and the invitations link` | yes (total read as a whole, with one arranged invitation) |
| C84 | `identity.spec.ts` `admin screens render the dashboard and list archetypes` | yes |
| C85 | `login.int.test.ts` `POST /auth/login normalizes case and surrounding spaces of the email` | yes (the invite side is held by `invitations-create.int.test.ts` `normalizes the email before storing it`) |
| C86 | `problem-details.int.test.ts` `answers 400 without echoing the password` | yes |
| C87 | `login.int.test.ts` `a password above 128 characters gets the same 401 counts a failure and runs no argon2` | no - only 129 is tried; a password of exactly 128 (valid at accept and CLI) is never logged in, and `>=` instead of `>` survives (finding 3) |
| C88 | `env.test.ts` `loadEnv throws naming WEB_PUBLIC_URL when it is missing` | yes |
| C89 | `invitations-accept.int.test.ts` `answers 410 and keeps the user created after the invitation` | yes |
| C90 | `outages.spec.ts` `web stays healthy through /status when the api is down` | yes (runs the container's own healthcheck command with the api stopped) |
| C91 | `schema.int.test.ts` `has four tables uuidv7 keys and no foreign key to another schema` | yes |
| C92 | `dependency-boundaries.test.ts` `blocks importing identity internals from another module` | yes (exactly one violation, so the `index.ts` import of the fixture stays allowed) |
| C93 | `stories.test.ts` `every component and archetype has a story` | yes (the "both themes" half of UI-21 is not enforced by the test, but every new story has light and dark) |
| C94 | `Button.stories.tsx` `Foco por teclado, tema claro` | no - proves Primário, Secundário and Perigo only; UI-24 says every `packages/ui` control (finding 10) |
| C95 | `Button.stories.tsx` `Foco por teclado, tema escuro` | no - same scope as C94 (finding 10) |
| C96 | `CopyField.stories.tsx` `Link longo` | yes |
| C97 | `identity.spec.ts` `a long invitation email and link stay inside the page in both themes and widths` | no - never opens the "Revogar" confirm dialog, whose description repeats the long email without any wrap (finding 9) |
| C98 | `CopyField.stories.tsx` `Foco por teclado, tema claro` | yes - muted on a copy: removing the ring classes from `copy-field.tsx`, or making the ring `outline-text`, fails both stories; a `--color-focus` of low contrast in only that theme's token fails only that theme's story (the theme global really applies), so the two checks are not redundant. The ring is read once right after Tab without a second read after `settle`, which is safe because these elements have no `transition` (only `Button` does) |
| C99 | `CopyField.stories.tsx` `Foco por teclado, tema escuro` | yes - muted on a copy: removing the ring classes from `copy-field.tsx`, or making the ring `outline-text`, fails both stories; a `--color-focus` of low contrast in only that theme's token fails only that theme's story (the theme global really applies), so the two checks are not redundant. The ring is read once right after Tab without a second read after `settle`, which is safe because these elements have no `transition` (only `Button` does) |
| C100 | `Field.stories.tsx` `Foco por teclado, tema claro` | yes - muted on a copy: removing the ring classes from `field.tsx` fails both stories; a `--color-focus` of low contrast in only that theme's token fails only that theme's story (the theme global really applies), so the two checks are not redundant. The ring is read once right after Tab without a second read after `settle`, which is safe because these elements have no `transition` (only `Button` does) |
| C101 | `Field.stories.tsx` `Foco por teclado, tema escuro` | yes - muted on a copy: removing the ring classes from `field.tsx` fails both stories; a `--color-focus` of low contrast in only that theme's token fails only that theme's story (the theme global really applies), so the two checks are not redundant. The ring is read once right after Tab without a second read after `settle`, which is safe because these elements have no `transition` (only `Button` does) |
| C102 | `AppShell.stories.tsx` `Foco por teclado, tema claro` | yes - muted on a copy: removing the ring classes from `NavItem` fails both stories; a `--color-focus` of low contrast in only that theme's token fails only that theme's story (the theme global really applies), so the two checks are not redundant. The ring is read once right after Tab without a second read after `settle`, which is safe because these elements have no `transition` (only `Button` does) |
| C103 | `AppShell.stories.tsx` `Foco por teclado, tema escuro` | yes - muted on a copy: removing the ring classes from `NavItem` fails both stories; a `--color-focus` of low contrast in only that theme's token fails only that theme's story (the theme global really applies), so the two checks are not redundant. The ring is read once right after Tab without a second read after `settle`, which is safe because these elements have no `transition` (only `Button` does) |
| C104 | `ConfirmDialog.stories.tsx` `Descrição longa` | yes - muted on a copy: removing `wrap-anywhere` from the description fails the story (the `scrollWidth <= clientWidth` assertion catches the overflow while the fixed-width dialog stays inside the viewport); it opens the real dialog at 375 px with a 120-character email word. Only light theme, which is enough for a layout check |
| C105 | `InvitationsPanel.test.tsx` `moves the focus to the first new row after Carregar mais` | yes - three invitations over two pages; asserts the row of the third (the first one the click brought) has focus, so dropping the effect (focus on the body), focusing the title, or focusing the old first row fails it |
| C106 | `InvitationsPanel.test.tsx` `moves the focus to the next row after revoking, and to the title after the last one` | yes - revokes a then b: asserts b's row is focused, then the level-1 heading, and that the body is not; a fallback to the body or to the first row fails |
| C107 | `AccessScreens.test.tsx` `offers Tentar novamente, which runs the retry` | no - proves the button calls `onRetry`, but UI-27 says it reloads the route; the default `window.location.reload()` that `_protected.tsx` actually uses is never run or asserted, so a no-op default survives (finding 14) |
| C108 | `AccessScreens.test.tsx` `offers Sair when there is a session, and hands over once it ends` | yes - Sair is absent without `session` (previous test), and with it a click runs `signOut` once and then `onSignedOut` once; the `_protected.tsx` target (login of the member area) is not asserted, only that one Sair renders in `router.test.tsx` |
| C109 | `ListPage.stories.tsx` `Linha estreita` | yes - measured at 375 px with a short and a 120-character email: removing `basis-full`, `flex-wrap` or `break-all` fails the text-width or scrollWidth assertion, and a wide viewport would also fail the text-width one (the action takes room), so the viewport really applies |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| 1. LOCK-06 second half is not held: excluding the pair-cleared rows from the IP count passes the whole lockout suite | `apps/api/src/modules/identity/http/login-lockout.int.test.ts` `a success clears the pair and keeps the ip count` asserts only `pair_cleared` flags and 9 rows; mutating `login-attempts.repository.ts` `ipFailures` to `counted.filter(!pairCleared)` kept 9/9 green (run on a copy). At HEAD the code is right (own example: 4 cleared + 46 foreign failures block the 51st attempt) | after the success, add failures from other emails up to 49 and assert still 401, then the 50th and assert `429` for a third email; this makes the cleared rows count visibly | e2f962f |
| 2. C13 does not hold "32 bytes" nor the invitation token | `apps/api/src/modules/identity/application/session.service.int.test.ts` `stores only the sha-256 ...` checks `hash === hashToken(token)` and 64 hex; `TOKEN_BYTES = 16` kept 19/19 green. The invitation is never created in this test | assert `Buffer.from(token, 'base64url').length === 32` for the session token here (the invitation link already has `{43}` in `invitations-create.int.test.ts`) | 9d582d3 |
| 3. Login with a password of exactly 128 characters is never tested (EDGE-03 edge) | `login.int.test.ts` `a password above 128 characters ...` uses 129 only; changing `> PASSWORD_MAX_LENGTH` to `>=` in `login.service.ts:60` kept login/lockout/auth suites green, and would lock out every member whose 128-char password the accept/CLI allowed | add a user whose password is `'p'.repeat(128)` and assert `204` on login, and keep the 129 case at `401` | 28d2fa4 |
| 4. The 7-day validity of an invitation is asserted with a 2.4 h tolerance and the real clock | `invitations-create.int.test.ts` `answers 201 with a 7-day invitation ...` compares `expiresAt - Date.now()` to 6.9 d..7.1 d; `INVITATION_DURATION_MS = 7 d + 2 h` kept 5 suites green | start the API with `testClock` and assert `expiresAt === clock.now() + 7 * 86_400_000` exactly | a2b8514 |
| 5. The clearing cookie and the login cookie are never asserted under `__Host-` / `Secure` | `auth-session.int.test.ts` runs logout only with `sessionCookieSecure: false`; `session-cookie.ts` `clearSessionCookie` with `secure: false` kept all 5 cookie/session suites green. In production a `__Host-` cookie cleared without `Secure` is ignored by the browser, so "Sair" would leave the cookie behind | start the api with `sessionCookieSecure: true`, log in through the real endpoint and log out; assert `__Host-am_session=...; Secure` on both the login and the clearing `Set-Cookie` | 1ce401b |
| 6. CLI-06 hidden prompt has no test | `identity-cli.int.test.ts` injects a fake `promptPassword`; `cli/hidden-prompt.ts` mutes readline through the private `_writeToOutput`, which a Node upgrade can silently break. (A pty probe of `dist/cli.js` at HEAD showed the typed value is not echoed, so today it works) | add a test that runs `promptHidden` over a pty (or a TTY-flagged stream) and asserts the typed text is absent from the output | f452cb0 |
| 7. An unhandled database error prints the Argon2id hash of the new admin password (CLI) and the same `params` reach the api log | `apps/api/src/cli.ts:27` has no catch: with an unreachable database `create-admin` crashed with a stack and `DrizzleQueryError ... params: a@example.com,A,$argon2id$v=19$m=19456,t=2,p=1$...,admin` on stderr (container logs in compose). `infra/http/problem-details.filter.ts` logs `unhandled error: ${error.message}` and drizzle's message carries the same `params` (password hash on accept, token hash on sessions). Not the password or token itself, so AUTH-18 holds, but a hash is credential material | catch in `cli.ts`, print a one-line message and exit 1 without the error object; in the filter log `error.cause?.code` / the query name instead of the drizzle message | bdfc36d |
| 8. UI-22 axe scan covers resting states only | `tests/e2e/specs/browser/identity.spec.ts` (screens table of `identity screens have no axe violations ...`) never opens the invitations screen with the link block and the alerts, the login with the 401 / 429 / expired alert, `UnavailableScreen`, or the `ConfirmDialog` | add those states to the scanned list in both themes and widths (create an invitation, fail a login, open the dialog) | 08f80b6 |
| 9. UI-25: the revoke confirmation repeats the invitation email with no wrap | `packages/ui/src/components/confirm-dialog/confirm-dialog.tsx:36` (`AlertDialog.Description`) has no `break-*`; `InvitationsPanel.tsx` Row passes `O link enviado para ${email} deixa de funcionar.`. A 100+ character email has no break point, so at 375 px it runs past the dialog and the viewport; no test opens the dialog with the long email of C97 (CSS reasoning, no browser run) | add `[overflow-wrap:anywhere]` (or `break-words`) to the description and extend the C97 e2e to click "Revogar" and assert the dialog text stays inside the viewport | f29eb81, 154e146 |
| 10. UI-24 "every control" is proved for Button only; the CopyField textarea has no token focus ring | `packages/ui/src/components/copy-field/copy-field.tsx:50` has no `outline-focus focus-visible:outline-2` (it relies on the browser default); `Field.Control` and `AppShell.NavItem` use the token but only `Button.stories.tsx` reads a ring contrast | give the textarea the same classes and add focus-contrast stories (light and dark) for Field.Control, NavItem and the CopyField textarea, or narrow UI-24 by a new criterion | dae21df |
| 11. UI-23 pending state of the "Convidar" form is untested | `InvitationsPanel.tsx` disables the button with `isSubmitting`, but `InvitationsPanel.test.tsx` has no waiting test (only LoginForm and AcceptInvitationForm do). A double submit creates two invitations and the second revokes the link the admin just got | add a gated-request test like `LoginForm.test.tsx` `disables submit while waiting and sends one request` for Convidar | f834101 |
| 12. C29 integration test cannot tell the oldest failure from the newest | `login-lockout.int.test.ts` `sends Retry-After ...` records the five failures at one fixed instant; `pairFailures.at(-1)` instead of `[0]` in `lockout.ts` kept 9/9 green (only `lockout.test.ts`, which is not C29's proof, would fail). The IP-limit wait is not exercised over HTTP either (own example confirms 600 s with failures one minute apart) | advance the clock between the five failures and assert the `Retry-After` of the first one | a83954a |
| 13. Cosmetic: a test header is glued to its first statement | `tooling/guardrails/src/dependency-boundaries.test.ts:101` `it('allows imports inside the same feature and the same module', async () => {    const { edges, violations } = ...` (missing newline after the arrow) | run prettier on the file | 3dfa5b2 |
| 14. UI-27 "recarrega a rota" is not held: C107 only proves `onRetry` is called | `apps/web/src/features/identity/components/AccessScreens.test.tsx` `offers Tentar novamente...` passes a mock `onRetry`; the real behaviour is the default `() => window.location.reload()` in `AccessScreens.tsx` used by `routes/admin/_protected.tsx` (`<UnavailableScreen />`), which no test runs. Replacing the default with a no-op keeps every web test green | render `UnavailableScreen` with no `onRetry`, stub `window.location.reload` (or use `router.invalidate` and test that) and assert it is called on click; or make the criterion say "runs the retry" | |
| 15. Cosmetic: comments cite UI-26 for the row layout, which is UI-28 | `packages/ui/src/layouts/list-page/ListPage.stories.tsx` (doc of `LinhaEstreita`: "A row at 375 px (UI-26)") and `list-page.tsx` (doc of `Row`: "no column is squeezed (UI-26)"); UI-26 is the list focus | change both to UI-28 | |
