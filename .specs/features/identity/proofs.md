# identity proofs

**HEAD**: ff7fcba
**Tree**: clean
**Shell**: /bin/sh
**Result**: 100 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run api-integration / ✓ identity cli > create-admin creates a lowercase admin and exits 0` | pass |
| C2 | `run api-integration / ✓ identity cli > create-admin refuses an existing email in any role` | pass |
| C3 | `run api-integration / ✓ identity cli > reset-password changes the hash keeps the role and revokes every sessio` | pass |
| C4 | `run api-integration / ✓ identity cli > reset-password refuses an unknown email without creating a user` | pass |
| C5 | `run api-integration / ✓ identity cli > refuses passwords of 11 and 129 characters without writing` | pass |
| C6 | `run api-integration / ✓ identity cli > reads the password from stdin and rejects it as an argument` | pass |
| C7 | `run api-integration / ✓ route access > no route creates an admin or changes a password` | pass |
| C8 | `run api-integration / ✓ POST /auth/login > creates a session sets the cookie and answers 204 for a member` | pass |
| C9 | `run api-integration / ✓ POST /auth/admin/login > creates a session sets the cookie and answers 204 for an admi` | pass |
| C10 | `run api-integration / ✓ login failures > answer an identical 401 for wrong password unknown email and wrong en` | pass |
| C11 | `run api-integration / ✓ login failures > runs the password verifier once for a known and an unknown email` | pass |
| C12 | `run api-unit / ✓ password hasher > stores argon2id phc with m=19456 t=2 p=1` | pass |
| C13 | `run api-integration / ✓ session service > stores only the sha-256 of 32-byte session and invitation tokens` | pass |
| C14 | `run api-integration / ✓ session cookie > carries HttpOnly SameSite=Lax Path=/ Max-Age=2592000 and no Domain` | pass |
| C15 | `run api-integration / ✓ session cookie > is named __Host-am_session with Secure by default` | pass |
| C16 | `run api-integration / ✓ GET /auth/me > answers 200 with the session user` | pass |
| C17 | `run api-integration / ✓ session guard > answers 401 for a missing expired revoked and unknown session` | pass |
| C18 | `run api-integration / ✓ session guard > extends the session and resends the cookie only below 29 days` | pass |
| C19 | `run api-integration / ✓ POST /auth/logout > revokes the session clears the cookie and answers 204 with or with` | pass |
| C20 | `run api-integration / ✓ POST /auth/login > deletes only the expired sessions of the user` | pass |
| C21 | `run api-integration / ✓ session guard > answers 403 when the role differs in both directions` | pass |
| C22 | `run api-integration / ✓ session guard > requires a session unless public and keeps /health public` | pass |
| C23 | `run api-integration / ✓ POST /invitations > takes invited_by from the session and ignores client ids` | pass |
| C24 | `run api-integration / ✓ problem details > every identity error uses application/problem+json` | pass |
| C25 | `run e2e / ✓ identity › stack logs contain no password token or cookie after a full journey` | pass |
| C26 | `run api-integration / ✓ route access > every registered route declares access and an undeclared fixture is nam` | pass |
| C27 | `run api-integration / ✓ login lockout > answers 429 after 5 pair failures even with the correct password` | pass |
| C28 | `run api-integration / ✓ login lockout > answers 429 for any email after 50 failures from one ip` | pass |
| C29 | `run api-integration / ✓ login lockout > sends Retry-After until the oldest counted failure leaves the window` | pass |
| C30 | `run api-integration / ✓ login lockout > treats known and unknown emails alike with the same 429 body` | pass |
| C31 | `run api-integration / ✓ login lockout > a blocked attempt runs no argon2 and records no failure` | pass |
| C32 | `run api-integration / ✓ login lockout > a success clears the pair and keeps the ip count` | pass |
| C33 | `run api-integration / ✓ login lockout > accepts attempts after the window and deletes expired rows on the next` | pass |
| C34 | `run api-integration / ✓ login lockout > both entrances share the failure counters` | pass |
| C35 | `run e2e / ✓ client ip › failures from two client ips are counted separately through the web` | pass |
| C36 | `run e2e / ✓ client ip › a forged X-Forwarded-For does not change the count` | pass |
| C37 | `run api-integration / ✓ POST /invitations > answers 201 with a 7-day invitation and a url from WEB_PUBLIC_URL` | pass |
| C38 | `run api-integration / ✓ POST /invitations > answers 403 to a member and creates nothing` | pass |
| C39 | `run api-integration / ✓ POST /invitations > answers 409 for an email that has an account` | pass |
| C40 | `run api-integration / ✓ POST /invitations > revokes the previous pending invitation of the email` | pass |
| C41 | `run api-integration / ✓ GET /invitations/:token > answers 200 with email and expiresAt for a pending invitatio` | pass |
| C42 | `run api-integration / ✓ invalid invitations > answer 410 for unknown expired accepted and revoked tokens on bo` | pass |
| C43 | `run api-integration / ✓ POST /invitations/:token/accept > creates the member marks accepted_at starts a sessio` | pass |
| C44 | `run api-integration / ✓ POST /invitations/:token/accept > answers 400 for out-of-range password and name and k` | pass |
| C45 | `run api-integration / ✓ POST /invitations/:token/accept > two concurrent accepts create one user and the other` | pass |
| C46 | `run api-integration / ✓ POST /invitations/:token/accept > revokes the current session before starting the new ` | pass |
| C47 | `run e2e / ✓ identity › a member signs in and reaches the preserved route with name and Sair` | pass |
| C48 | `run e2e / ✓ identity › an admin signs in and reaches the preserved route or /admin` | pass |
| C49 | `run web / ✓ LoginForm > shows the 401 message and keeps the email` | pass |
| C50 | `run web / ✓ LoginForm > shows the 429 message with minutes rounded up` | pass |
| C51 | `run e2e / ✓ outages › shows the unavailable message without redirecting to login when the api is down` | pass |
| C52 | `run e2e / ✓ identity › the server redirects / to /login preserving the route` | pass |
| C53 | `run e2e / ✓ identity › the server redirects /admin routes to /admin/login preserving the route` | pass |
| C54 | `run e2e / ✓ identity › an action with an expired session opens login with the expired message and the route` | pass |
| C55 | `run web / ✓ safeRedirect > falls back for absolute protocol-relative and backslash paths` | pass |
| C56 | `run e2e / ✓ identity › a member on /admin sees the no-access message and no admin data` | pass |
| C57 | `run e2e / ✓ identity › a signed-in admin on / goes to /admin` | pass |
| C58 | `run e2e / ✓ identity › a signed-in user on the login of their area goes to its home` | pass |
| C59 | `run e2e / ✓ identity › Sair ends the session and opens the login of the area` | pass |
| C60 | `run web / ✓ AcceptInvitationForm > shows the invited email read-only and the password rule` | pass |
| C61 | `run e2e / ✓ identity › the full journey goes from cli to admin invite to accepted member home` | pass |
| C62 | `run web / ✓ AcceptInvitationForm > shows the invalid message without a form on 410 at open and at submit` | pass |
| C63 | `run e2e / ✓ identity › /invite responds with Referrer-Policy no-referrer` | pass |
| C64 | `run e2e / ✓ identity › authenticated pages and /invite respond with Cache-Control no-store` | pass |
| C65 | `run e2e / ✓ identity › a cross-origin post to a server function is refused and never reaches the api` | pass |
| C66 | `run e2e / ✓ status page › server html shows API and Banco de dados with their state` | pass |
| C67 | `run e2e / ✓ identity › login invite and home render the auth and dashboard archetypes` | pass |
| C68 | `run e2e / ✓ identity › identity screens have no axe violations or horizontal scroll in both themes and widths` | pass |
| C69 | `run web / ✓ LoginForm > disables submit while waiting and sends one request` | pass |
| C70 | `run api-integration / ✓ GET /invitations > lists only pending invitations newest first with cursor and total` | pass |
| C71 | `run api-integration / ✓ DELETE /invitations/:id > marks revoked_at and answers 204` | pass |
| C72 | `run api-integration / ✓ DELETE /invitations/:id > answers 404 for an unknown or non-pending invitation` | pass |
| C73 | `run api-integration / ✓ invitations administration > answers 403 to a member on list and revoke` | pass |
| C74 | `run api-integration / ✓ GET /invitations > never returns a token or its hash` | pass |
| C75 | `run web / ✓ InvitationsPanel > shows the link once with copy and adds the email to the list` | pass |
| C76 | `run web / ✓ InvitationsPanel > copies the link and shows Copiado` | pass |
| C77 | `run web / ✓ InvitationsPanel > keeps the link selectable and shows the message when copy fails` | pass |
| C78 | `run web / ✓ InvitationsPanel > shows the existing account message and keeps the value` | pass |
| C79 | `run web / ✓ InvitationsPanel > asks confirmation with the email before revoking` | pass |
| C80 | `run web / ✓ InvitationsPanel > removes the invitation and updates the total after confirming` | pass |
| C81 | `run web / ✓ InvitationsPanel > shows the empty message and the form` | pass |
| C82 | `run web / ✓ InvitationsPanel > loads the next page with nextCursor` | pass |
| C83 | `run e2e / ✓ identity › the admin dashboard shows status pending total and the invitations link` | pass |
| C84 | `run e2e / ✓ identity › admin screens render the dashboard and list archetypes` | pass |
| C85 | `run api-integration / ✓ POST /auth/login > normalizes case and surrounding spaces of the email` | pass |
| C86 | `run api-integration / ✓ problem details > answers 400 without echoing the password` | pass |
| C87 | `run api-integration / ✓ login failures > a password above 128 characters gets the same 401 counts a failure an` | pass |
| C88 | `run api-unit / ✓ loadEnv > throws naming WEB_PUBLIC_URL when it is missing` | pass |
| C89 | `run api-integration / ✓ POST /invitations/:token/accept > answers 410 and keeps the user created after the inv` | pass |
| C90 | `run e2e / ✓ outages › web stays healthy through /status when the api is down` | pass |
| C91 | `run api-integration / ✓ identity schema > has four tables uuidv7 keys and no foreign key to another schema` | pass |
| C92 | `run guardrails / ✓ boundaries > blocks importing identity internals from another module` | pass |
| C93 | `run ui / ✓ stories coverage > every component and archetype has a story` | pass |
| C94 | `run ui / ✓ /storybook (chromium)/ src/components/button/Button.stories.tsx > Foco por teclado, tema claro` | pass |
| C95 | `run ui / ✓ /storybook (chromium)/ src/components/button/Button.stories.tsx > Foco por teclado, tema escuro` | pass |
| C96 | `run ui / ✓ /storybook (chromium)/ src/components/copy-field/CopyField.stories.tsx > Link longo` | pass |
| C97 | `run e2e / ✓ identity › a long invitation email and link stay inside the page in both themes and widths` | pass |
| Build | `pnpm build` | pass |
| Build | `pnpm typecheck` | pass |
| Build | `pnpm lint` | pass |

## Output

`Run api-integration` - exit 0

```
 ✓ |integration| src/modules/health/database-probe.int.test.ts > DatabaseProbe > returns down when the database container is stopped 1755ms
 ✓ |integration| src/modules/health/health.int.test.ts > GET /health > returns 503 degraded/down within 2 seconds when the database does not answer 7433ms
 ✓ |integration| src/modules/identity/cli/identity-cli.int.test.ts > identity cli > refuses passwords of 11 and 129 characters without writing 1265ms
 ✓ |integration| src/modules/health/health.int.test.ts > GET /health > returns 503 degraded/down when the database container is stopped 1137ms
 ✓ |integration| src/modules/identity/cli/identity-cli.int.test.ts > identity cli > refuses an invalid email, a blank or oversized name and an unknown flag without writing 1907ms
 ✓ |integration| src/modules/identity/cli/identity-cli.int.test.ts > identity cli > keeps a name with an equals sign whole and trims it 450ms
 ✓ |integration| src/modules/identity/cli/identity-cli.int.test.ts > identity cli > refuses with a usage error instead of hanging when the prompt finds standard input closed 399ms
 ✓ |integration| src/modules/identity/cli/identity-cli.int.test.ts > identity cli > reads the password from stdin and rejects it as an argument 1722ms
 ✓ |integration| src/modules/identity/cli/identity-cli.int.test.ts > identity cli > without --password-stdin reads the password only from the prompt 148ms
 ✓ |integration| src/infra/database/migrations.int.test.ts > runMigrations > retries for 30 seconds before failing when the database is down 30059ms

 Test Files  17 passed (17)
      Tests  95 passed (95)
   Start at  09:01:51
   Duration  85.66s (tests 88%, import 11%, transform 1%)
```

`Run api-unit` - exit 0

```
 ✓ |unit| src/infra/clock/clock.test.ts > CLOCK > injects the system clock by default 21ms
 ✓ |unit| src/infra/clock/clock.test.ts > CLOCK > injects the clock given to AppModule.forRoot, which advances without waiting 3ms
 ✓ |unit| src/infra/clock/clock.test.ts > CLOCK > hands out copies, so a caller cannot move the clock by mutating the answer 2ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > writes json lines with level, time, msg and requestId 11ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > reuses x-request-id and returns it 9ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > generates an id and returns it when the header is absent 1ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > replaces a malformed x-request-id with a generated id 2ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > keeps the cookie set-cookie and internal ip out of the json lines 1ms
 ✓ |unit| src/infra/logging/request-logging.test.ts > request logging > replaces the invitation token in the logged url 1ms
 ✓ |unit| src/main.test.ts > api entrypoint > exits non-zero naming DATABASE_URL when it is missing 356ms

 Test Files  11 passed (11)
      Tests  60 passed (60)
   Start at  09:03:17
   Duration  1.09s (tests 52%, import 41%, transform 5%, worker 1%)
```

`Run e2e` - exit 0

```
  ✓  37 [browser] › specs/browser/status-page.spec.ts:44:3 › status page › follows the system color scheme with dark and light tokens (121ms)
  ✓  38 [browser] › specs/browser/status-page.spec.ts:64:3 › status page › has no accessibility violations in light and dark (437ms)
  ✓  39 [browser] › specs/browser/status-page.spec.ts:74:3 › status page › web and api log the same requestId for one visit (396ms)
  ✓  40 [disruption] › specs/disruption/client-ip.spec.ts:64:3 › client ip › failures from two client ips are counted separately through the web (960ms)
  ✓  41 [disruption] › specs/disruption/client-ip.spec.ts:90:3 › client ip › a forged X-Forwarded-For does not change the count (606ms)
  ✓  42 [disruption] › specs/disruption/outages.spec.ts:19:3 › outages › shows both rows Indisponível with 200 when the api is down (6.9s)
  ✓  43 [disruption] › specs/disruption/outages.spec.ts:33:3 › outages › treats an api slower than 3 seconds as Indisponível (5.6s)
  ✓  44 [disruption] › specs/disruption/outages.spec.ts:51:3 › outages › shows API Operacional and Banco de dados Indisponível when the database is down (2.8s)
  ✓  45 [disruption] › specs/disruption/outages.spec.ts:65:3 › outages › shows the unavailable message without redirecting to login when the api is down (6.9s)
  ✓  46 [disruption] › specs/disruption/outages.spec.ts:80:3 › outages › web stays healthy through /status when the api is down (7.0s)
  ✓  47 [teardown] › specs/setup/compose.teardown.ts:5:3 › compose › is removed with its volumes after the run (4.6s)

  47 passed (1.4m)
$ pnpm --filter @am/e2e e2e
$ playwright test
```

`Run web` - exit 0

```

stderr | src/router.test.tsx > invitation screen > opens the home signed in after Criar conta
An empty string ("") was passed to the href attribute. To fix this, either do not render the element at all or pass null to href instead of an empty string.

stderr | src/router.test.tsx > invitation screen > shows the invalid message and no form for a dead link
An empty string ("") was passed to the href attribute. To fix this, either do not render the element at all or pass null to href instead of an empty string.

stderr | src/router.test.tsx > admin dashboard > shows the status panel, the pending total and the link to the invitations screen
An empty string ("") was passed to the href attribute. To fix this, either do not render the element at all or pass null to href instead of an empty string.

stderr | src/router.test.tsx > admin dashboard > shows the panel as unavailable when the api is down
An empty string ("") was passed to the href attribute. To fix this, either do not render the element at all or pass null to href instead of an empty string.

stderr | src/router.test.tsx > admin dashboard > does not read admin data for a member who is shown the no-access screen
An empty string ("") was passed to the href attribute. To fix this, either do not render the element at all or pass null to href instead of an empty string.
```

`Run guardrails` - exit 0

```
 ✓ src/pre-commit-secrets.test.ts > pre-commit secrets > lets a commit without secrets through 841ms
 ✓ src/pre-commit-secrets.test.ts > pre-commit secrets > hooks are installed by pnpm install 1873ms
 ✓ src/pre-commit-secrets.test.ts > pre-commit secrets > pnpm install outside a git repository installs no hooks and succeeds 439ms
 ✓ src/root-commands.test.ts > root commands > pnpm lint runs eslint in every workspace and fails on a violation 16237ms
 ✓ src/root-commands.test.ts > root commands > pnpm lint fails an app importing another app naming file and import 3453ms
 ✓ src/root-commands.test.ts > root commands > pnpm lint fails a feature importing another feature internals naming file and import 0ms
 ✓ src/root-commands.test.ts > root commands > pnpm lint fails a module importing another module internals naming file and import 0ms
 ✓ src/root-commands.test.ts > root commands > pnpm typecheck fails on a type error in any workspace 17898ms
 ✓ src/root-commands.test.ts > root commands > pnpm test runs vitest in every workspace 11370ms
 ✓ src/root-commands.test.ts > root commands > pnpm test fails when a packages/ui story throws 3952ms

 Test Files  6 passed (6)
      Tests  29 passed (29)
   Start at  09:04:54
   Duration  57.87s (tests 99%, import 1%)
```

`Run ui` - exit 0

```
 ✓ |unit| src/components/field/field.test.tsx > Field > drops the error from the description when the field becomes valid again 2ms
 ✓ |unit| src/components/field/field.test.tsx > Field > keeps what the user types and shows the error after the submit 3ms
 ✓ |unit| src/components/field/field.test.tsx > Field > uses the danger token for the invalid border and the error text 1ms

 Test Files  21 passed (21)
      Tests  98 passed (98)
   Start at  09:05:53
   Duration  2.81s (environment 23%, setup 22%, transform 21%, tests 16%, worker 14%, import 4%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - import "./vite.config" without a file extension (vitest.config.ts:6:24). Add the file extension
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - import "./vite.config" without a file extension (vitest.config.ts:6:24). Add the file extension
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
