import { createHash, randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { composeOk, psql } from '../../support/compose.js';
import {
  createAdminOk,
  expireInvitations,
  expireSessions,
  fixtureEmail,
  fixturePassword,
  revokePendingInvitations,
  revokeSessions,
  shortenSession,
} from '../../support/identity.js';

/**
 * The identity screens against the production images: the journeys, the session states, the headers and
 * the logs. Every step below is what a person does in the browser (typing, clicking), except where the
 * state cannot be reached from a screen: a session near its end, an expired invitation, or an account
 * created before the stack started. Those are arranged through the CLI and the database of the stack.
 */

const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';
const EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';
const INVALID_INVITATION = 'Este convite não é mais válido. Peça um novo ao administrador.';

const adminEmail = fixtureEmail('admin');
const adminPassword = fixturePassword('admin');
const memberPassword = fixturePassword('member');

function memberEmail(): string {
  return fixtureEmail('member');
}

/** Signs in through the form of an area, as a person does: type, click, wait for the home. */
async function signIn(page: Page, area: 'member' | 'admin', email: string, password: string): Promise<void> {
  await page.goto(area === 'admin' ? '/admin/login' : '/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(area === 'admin' ? '**/admin' : (url) => !url.pathname.startsWith('/login'));
}

/** The session cookie the browser holds, with the name the running configuration gives it (AUTH-08). */
async function sessionCookieOf(page: Page): Promise<{ name: string; value: string }> {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name.endsWith('am_session'));
  expect(session, 'the browser holds the session cookie').toBeDefined();
  return { name: session!.name, value: session!.value };
}

/** The value of the session cookie the browser holds, which is the credential itself (AUTH-06). */
async function sessionCookie(page: Page): Promise<string> {
  return (await sessionCookieOf(page)).value;
}

/** JSON log lines of a compose service; the access log of the web is plain text and is searched as it is. */
function logsOf(service: 'api' | 'web'): string {
  return composeOk(['logs', '--no-log-prefix', service]);
}

function jsonLogs(service: 'api' | 'web'): Record<string, unknown>[] {
  return logsOf(service)
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

/** Invites someone from the admin screen and returns the link the screen shows once (ADM-06). */
async function inviteFromScreen(page: Page, email: string): Promise<string> {
  await page.goto('/admin/invitations');
  await page.getByLabel('E-mail a convidar').fill(email);
  await page.getByRole('button', { name: 'Convidar' }).click();
  const link = page.getByLabel('Link do convite');
  await expect(link).toBeVisible();
  return link.inputValue();
}

/** The token of an invite link, which is the last segment of its path. */
function tokenOf(inviteUrl: string): string {
  return new URL(inviteUrl).pathname.split('/').filter(Boolean).at(-1)!;
}

interface MemberAccount {
  /** The context of the member alone: the admin that invited never shares a browser with it. */
  context: BrowserContext;
  /** The page of the member, left on the home already signed in. */
  page: Page;
  email: string;
  name: string;
}

/**
 * Creates a member the way the product does (INV-07, UI-15): an admin signs in and invites in a context of
 * its own, and the invited person accepts in a second context, which never holds the admin session. The
 * member is left signed in on the home, ready for the journey of the test.
 */
async function createMemberIn(browser: Browser, name: string): Promise<MemberAccount> {
  const email = memberEmail();
  const admin = await browser.newContext();
  const context = await browser.newContext();
  try {
    const adminPage = await admin.newPage();
    await signIn(adminPage, 'admin', adminEmail, adminPassword);
    const inviteUrl = await inviteFromScreen(adminPage, email);

    const page = await context.newPage();
    await page.goto(inviteUrl);
    await expect(page.getByLabel('E-mail')).toHaveValue(email);
    await page.getByLabel('Nome').fill(name);
    await page.getByLabel('Senha').fill(memberPassword);
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    return { context, page, email, name };
  } catch (error) {
    await context.close();
    throw error;
  } finally {
    await admin.close();
  }
}

test.describe('identity', () => {
  test.beforeAll(() => {
    test.setTimeout(5 * 60_000);
    // The only account that cannot be born in a screen: the first admin (CLI-01).
    createAdminOk(adminEmail, 'Admin do Produto', adminPassword);
  });

  test('the full journey goes from cli to admin invite to accepted member home', async ({ browser }) => {
    // UI-15 and the goal of the feature: the admin created by the CLI invites, and the invited person
    // creates the account and lands on the home already signed in.
    const admin = await browser.newContext();
    const invited = await browser.newContext();
    const email = memberEmail();
    try {
      const adminPage = await admin.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      const inviteUrl = await inviteFromScreen(adminPage, email);

      const invitedPage = await invited.newPage();
      await invitedPage.goto(inviteUrl);
      await expect(invitedPage.getByLabel('E-mail')).toHaveValue(email);
      await invitedPage.getByLabel('Nome').fill('Pessoa Convidada');
      await invitedPage.getByLabel('Senha').fill(memberPassword);
      await invitedPage.getByRole('button', { name: 'Criar conta' }).click();

      await invitedPage.waitForURL((url) => url.pathname === '/');
      await expect(invitedPage.getByRole('heading', { name: 'Início' })).toBeVisible();
      await expect(invitedPage.getByText('Pessoa Convidada')).toBeVisible();
      // The account exists once, with the role of every invited person (INV-07).
      expect(psql(`select role from identity.users where email = '${email}'`)).toBe('member');
      expect(psql(`select count(*) from identity.users where email = '${email}'`)).toBe('1');
    } finally {
      await admin.close();
      await invited.close();
    }
  });

  test('a member signs in and reaches the preserved route with name and Sair', async ({ browser }) => {
    // UI-01: the member entrance opens the page that was asked for, with who is signed in and the way out.
    const member = await createMemberIn(browser, 'Pessoa do Member');
    try {
      const { page, email } = member;
      await expect(page.getByText('Pessoa do Member')).toBeVisible();
      await page.getByRole('button', { name: 'Sair' }).click();
      await page.waitForURL('**/login');

      // The route asked for survives the login, and it is not the default home: `/status` is what opens.
      await page.goto('/login?redirect=%2Fstatus');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha').fill(memberPassword);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL('**/status');
      await expect(page.getByRole('group', { name: 'API' })).toBeVisible();

      // And with no route asked for, `/` is where a member lands: the visitor who opens `/` signed out is
      // sent to the login with the route preserved, and the login opens it again.
      await page.goto('/');
      await page.getByRole('button', { name: 'Sair' }).click();
      await page.waitForURL('**/login');
      await page.goto('/');
      await page.waitForURL('**/login?redirect=%2F');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha').fill(memberPassword);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
      await expect(page.getByText('Pessoa do Member')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
    } finally {
      await member.context.close();
    }
  });

  test('an admin signs in and reaches the preserved route or /admin', async ({ browser }) => {
    // UI-02: the admin entrance, with the page the visitor asked for preserved through the login.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/admin/invitations');
      await page.waitForURL('**/admin/login?redirect=%2Fadmin%2Finvitations');
      await page.getByLabel('E-mail').fill(adminEmail);
      await page.getByLabel('Senha').fill(adminPassword);
      await page.getByRole('button', { name: 'Entrar' }).click();

      await page.waitForURL('**/admin/invitations');
      await expect(page.getByRole('heading', { name: 'Convites' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('the server redirects / to /login preserving the route', async ({ request }) => {
    // UI-06: the redirect is in the HTML the server sends, not a script that runs afterwards.
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toBe('/login?redirect=%2F');
  });

  test('the server redirects /admin routes to /admin/login preserving the route', async ({ request }) => {
    // UI-07: the same for the admin area, with the whole page asked for.
    const response = await request.get('/admin/invitations', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toBe('/admin/login?redirect=%2Fadmin%2Finvitations');
  });

  test('an action with an expired session opens login with the expired message and the route', async ({ browser }) => {
    // UI-08: the session ends while the page is open, and the next action puts the person back on the
    // login of the area, saying why, with the page they were on. The api refuses the session in both
    // ways it can end, and both have to say the same thing to the person: revoked, and past its expiry.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();

      const endSessionWhileThePageIsOpen = async (label: string, endSession: () => void): Promise<void> => {
        await signIn(page, 'admin', adminEmail, adminPassword);
        await page.goto('/admin/invitations');
        await expect(page.getByRole('heading', { name: 'Convites' }), label).toBeVisible();

        endSession();

        await page.getByLabel('E-mail a convidar').fill(memberEmail());
        await page.getByRole('button', { name: 'Convidar' }).click();

        await page.waitForURL('**/admin/login?redirect=*reason=expired');
        await expect(page.getByText(EXPIRED_NOTICE), label).toBeVisible();
        expect(new URL(page.url()).searchParams.get('redirect'), label).toBe('/admin/invitations');
      };

      await endSessionWhileThePageIsOpen('revoked', () => revokeSessions(adminEmail));
      await endSessionWhileThePageIsOpen('expired', () => expireSessions(adminEmail));
    } finally {
      await context.close();
    }
  });

  test('a member on /admin sees the no-access message and no admin data', async ({ browser }) => {
    // UI-10: the admin area answers a member with the message and the way home, and with nothing of the
    // admin area: no navigation, no invitations, no status.
    const context = await browser.newContext();
    const email = memberEmail();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      const inviteUrl = await inviteFromScreen(page, email);
      await page.getByRole('button', { name: 'Sair' }).click();
      await page.waitForURL('**/admin/login');

      const member = await context.newPage();
      await member.goto(inviteUrl);
      await member.getByLabel('Nome').fill('Pessoa Sem Acesso');
      await member.getByLabel('Senha').fill(memberPassword);
      await member.getByRole('button', { name: 'Criar conta' }).click();
      await member.waitForURL((url) => url.pathname === '/');

      await member.goto('/admin');
      await expect(member.getByRole('heading', { name: 'Você não tem acesso a esta área.' })).toBeVisible();
      await expect(member.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
      await expect(member.getByRole('heading', { name: 'Administração' })).toHaveCount(0);
      await expect(member.getByRole('navigation', { name: 'Navegação da administração' })).toHaveCount(0);
      await expect(member.getByText('Convites pendentes')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('a signed-in admin on / goes to /admin', async ({ browser }) => {
    // UI-11: an admin has no business on the member home, so the server moves them to their own area.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      await page.goto('/');
      await page.waitForURL('**/admin');
      await expect(page.getByRole('heading', { name: 'Administração' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('a signed-in user on the login of their area goes to its home', async ({ browser }) => {
    // UI-12: the login of the area is not shown again to someone who is already inside it.
    const admin = await browser.newContext();
    const member = await createMemberIn(browser, 'Pessoa da Entrada');
    try {
      const adminPage = await admin.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      await adminPage.goto('/admin/login');
      await adminPage.waitForURL('**/admin');
      await expect(adminPage.getByRole('heading', { name: 'Administração' })).toBeVisible();

      // The member door belongs to the member, so it opens the member home for a member.
      await member.page.goto('/login');
      await member.page.waitForURL((url) => url.pathname === '/');
      await expect(member.page.getByRole('heading', { name: 'Início' })).toBeVisible();
    } finally {
      await admin.close();
      await member.context.close();
    }
  });

  test('Sair ends the session and opens the login of the area', async ({ browser }) => {
    // UI-13: the browser is back on the login, and the cookie it had is worth nothing afterwards (AUTH-12).
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      const oldCookie = await sessionCookieOf(page);
      // The row the cookie stands for, found by the hash the api stores (AUTH-06).
      const tokenHash = createHash('sha256').update(oldCookie.value).digest('hex');
      expect(psql(`select count(*) from identity.sessions where token_hash = '${tokenHash}'`)).toBe('1');

      await page.getByRole('button', { name: 'Sair' }).click();
      await page.waitForURL('**/admin/login');
      await expect(page.getByRole('heading', { name: 'Administração' })).toBeVisible();

      // The session is revoked on the api, not only dropped from the browser (AUTH-12).
      expect(
        psql(`select revoked_at is not null from identity.sessions where token_hash = '${tokenHash}'`),
        'the session row of the old cookie is revoked',
      ).toBe('t');

      // The old token on a page that needs a session: the server sends it to the login of the area, so
      // the credential the browser once held opens nothing.
      const reuse = await context.request.get('/admin', {
        headers: { cookie: `${oldCookie.name}=${oldCookie.value}` },
        maxRedirects: 0,
      });
      expect(reuse.status()).toBe(307);
      expect(reuse.headers()['location']).toBe('/admin/login?redirect=%2Fadmin');
    } finally {
      await context.close();
    }
  });

  test('a ui login sets the session cookie the browser keeps', async ({ browser }) => {
    // The first risk of the handoff, asserted where it happens: the api answers the login with
    // `Set-Cookie: am_session`, the BFF has to forward that header, and the browser must end up holding
    // the cookie. Without it the person is signed in on the server and anonymous in the browser.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/admin/login');
      await page.getByLabel('E-mail').fill(adminEmail);
      await page.getByLabel('Senha').fill(adminPassword);
      const [answer] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('_serverFn')),
        page.getByRole('button', { name: 'Entrar' }).click(),
      ]);

      const setCookie = (await answer.headersArray()).filter((header) => header.name.toLowerCase() === 'set-cookie');
      expect(setCookie.map((header) => header.value)).toContainEqual(
        expect.stringMatching(/^am_session=[^;]+; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax$/),
      );
      const cookies = await context.cookies();
      expect(cookies.map((cookie) => cookie.name)).toContain('am_session');
      expect(cookies.find((cookie) => cookie.name === 'am_session')?.httpOnly).toBe(true);

      await page.waitForURL('**/admin');
      expect(await sessionCookie(page)).not.toBe('');
    } finally {
      await context.close();
    }
  });

  test('the renewal cookie of a protected page reaches the ssr html', async ({ browser }) => {
    // AUTH-11 through the BFF: a session with fewer than 29 days left is extended, and the new cookie has
    // to arrive on the HTML the server renders. If the header were dropped here, the browser would keep a
    // session that expires in days while the api believes it was renewed.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      const before = await sessionCookie(page);

      shortenSession(adminEmail, 5);

      const response = await page.goto('/admin/invitations');
      const setCookie = (await response?.headersArray())?.filter((header) => header.name.toLowerCase() === 'set-cookie') ?? [];
      expect(setCookie.map((header) => header.value)).toContainEqual(
        expect.stringMatching(/^am_session=[^;]+; Max-Age=2592000; Path=\/; HttpOnly; SameSite=Lax$/),
      );
      // The extended session answers for itself on the next page.
      expect(await sessionCookie(page)).toBe(before);
      await expect(page.getByRole('heading', { name: 'Convites' })).toBeVisible();
      // The extended session now ends 30 days from now, not the 5 days it was left with.
      const secondsLeft = Number(
        psql(`select coalesce(max(extract(epoch from expires_at - now())), 0)::int from identity.sessions
              where user_id = (select id from identity.users where email = '${adminEmail}') and revoked_at is null`),
      );
      expect(secondsLeft).toBeGreaterThanOrEqual(29 * 24 * 60 * 60);
    } finally {
      await context.close();
    }
  });

  test('/invite responds with Referrer-Policy no-referrer', async ({ request }) => {
    // UI-17: the token of the link never leaves as a referrer, whatever the page later requests.
    const response = await request.get('/invite/any-token', { maxRedirects: 0 });
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
  });

  test('authenticated pages and /invite respond with Cache-Control no-store', async ({ browser, request }) => {
    // UI-18: a shared cache never holds a page of one person, nor an invite link.
    const invited = await request.get('/invite/any-token', { maxRedirects: 0 });
    expect(invited.headers()['cache-control']).toBe('no-store');

    const admin = await browser.newContext();
    const member = await createMemberIn(browser, 'Pessoa do Cache');
    try {
      const page = await admin.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      for (const path of ['/', '/admin', '/admin/invitations']) {
        const response = await page.goto(path);
        expect(response?.headers()['cache-control'], path).toBe('no-store');
      }

      // The member home is the one `/` that answers with the page itself, because a member stays where an
      // admin is moved away from; the header read here is therefore the one of the home.
      const home = await member.page.goto('/');
      expect(home?.status(), 'the member home answers with the page').toBe(200);
      expect(home?.headers()['cache-control'], '/ as a member').toBe('no-store');
    } finally {
      await admin.close();
      await member.context.close();
    }
  });

  test('a cross-origin post to a server function is refused and never reaches the api', async ({ browser, request }) => {
    // UI-19: the browser never calls the api itself, so the only write path is a server function, and a
    // post from another origin must die at the web.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/login');
      const [login] = await Promise.all([
        page.waitForRequest((candidate) => candidate.url().includes('_serverFn') && candidate.method() === 'POST'),
        (async () => {
          await page.getByLabel('E-mail').fill(adminEmail);
          await page.getByLabel('Senha').fill('a-wrong-password-to-fail');
          await page.getByRole('button', { name: 'Entrar' }).click();
          await expect(page.getByRole('alert')).toHaveText(WRONG_CREDENTIALS);
        })(),
      ]);

      // The url and the body the screen itself sent: a hostile page can copy both, and what must stop it is
      // the origin check at the web, not the shape of the payload.
      const url = login.url();
      const body = login.postData() ?? '';
      expect(body, 'the login screen posts a body worth replaying').not.toBe('');
      const post = (headers: Record<string, string>) =>
        request.post(url, {
          data: body,
          headers: { 'content-type': 'application/json', 'x-tsr-serverfn': 'true', ...headers },
          maxRedirects: 0,
        });
      const apiIds = () => new Set(jsonLogs('api').map((line) => line.requestId));

      // The control: a post of this origin with an id of its own does reach the api, and the api logs that
      // id. Without it, a missing id below could mean "the api does not log ids" instead of "no call".
      const acceptedId = `e2e-csrf-accepted-${randomUUID()}`;
      const accepted = await post({ origin: new URL(url).origin, 'x-request-id': acceptedId });
      expect(accepted.status(), await accepted.text()).toBe(200);
      await expect.poll(() => apiIds().has(acceptedId), { timeout: 10_000 }).toBe(true);

      const requestId = `e2e-csrf-${randomUUID()}`;
      const forged = await post({
        origin: 'https://evil.test',
        'sec-fetch-site': 'cross-site',
        'x-request-id': requestId,
      });
      expect(forged.status()).toBe(403);

      // The bounded wait, tied to a real event: one more accepted post, whose id is written after the
      // forged one would have been, marks the moment the api log holds everything up to the refusal.
      const laterId = `e2e-csrf-later-${randomUUID()}`;
      const later = await post({ origin: new URL(url).origin, 'x-request-id': laterId });
      expect(later.status(), await later.text()).toBe(200);
      await expect.poll(() => apiIds().has(laterId), { timeout: 10_000 }).toBe(true);

      // The api never saw the attempt: the refused call leaves no trace in its logs.
      expect(jsonLogs('api').filter((line) => line.requestId === requestId)).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('login invite and home render the auth and dashboard archetypes', async ({ browser }) => {
    // UI-21: every screen belongs to an archetype of the design system, which is what `data-archetype` marks.
    const context = await browser.newContext();
    const email = memberEmail();
    try {
      const page = await context.newPage();
      await page.goto('/login');
      await expect(page.locator('[data-archetype="auth"]')).toHaveCount(1);
      await page.goto('/admin/login');
      await expect(page.locator('[data-archetype="auth"]')).toHaveCount(1);

      await signIn(page, 'admin', adminEmail, adminPassword);
      const inviteUrl = await inviteFromScreen(page, email);
      await page.goto(inviteUrl);
      await expect(page.locator('[data-archetype="auth"]')).toHaveCount(1);
      await page.getByLabel('Nome').fill('Pessoa da Archetype');
      await page.getByLabel('Senha').fill(memberPassword);
      await page.getByRole('button', { name: 'Criar conta' }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.locator('[data-archetype="dashboard"]')).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('admin screens render the dashboard and list archetypes', async ({ browser }) => {
    // ADM-15: the dashboard for the admin home and the list for the invitations.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      await expect(page.locator('[data-archetype="dashboard"]')).toHaveCount(1);
      await page.goto('/admin/invitations');
      await expect(page.locator('[data-archetype="list"]')).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test('the admin dashboard shows status pending total and the invitations link', async ({ browser }) => {
    // ADM-14: the status of the stack, how many invitations are pending, and the way to the list.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);

      // The total is arranged, not inherited: every pending invitation is revoked, then exactly one is
      // created from the screen, so the number on the dashboard has one right answer.
      revokePendingInvitations();
      await inviteFromScreen(page, memberEmail());
      expect(
        Number(psql('select count(*) from identity.invitations where accepted_at is null and revoked_at is null')),
        'one pending invitation',
      ).toBe(1);

      await page.goto('/admin');
      await expect(page.getByRole('group', { name: 'API' })).toContainText('Operacional');
      await expect(page.getByRole('group', { name: 'Banco de dados' })).toContainText('Operacional');
      const summary = page.getByRole('group', { name: 'Convites pendentes' });
      // Read as a whole, not as a substring: a screen showing "12" for one pending invitation fails here.
      await expect(summary.getByText('1', { exact: true })).toBeVisible();
      await expect(summary).toHaveText(/^Convites pendentes\s*1\s*Ver convites$/);
      await page.getByRole('link', { name: 'Ver convites' }).click();
      await page.waitForURL('**/admin/invitations');
      await expect(page.getByRole('heading', { name: 'Convites' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('identity screens have no axe violations or horizontal scroll in both themes and widths', async ({ browser }) => {
    // UI-22: the same screens, in the light and the dark theme, at a phone and a desktop width.
    const context = await browser.newContext();
    const email = memberEmail();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      const inviteUrl = await inviteFromScreen(page, email);
      await page.getByRole('button', { name: 'Sair' }).click();
      await page.waitForURL('**/admin/login');

      const screens = [
        { path: '/login', name: 'login' },
        { path: '/admin/login', name: 'admin login' },
        { path: new URL(inviteUrl).pathname, name: 'invite' },
      ];
      for (const scheme of ['light', 'dark'] as const) {
        for (const width of [375, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: scheme });
          for (const screen of screens) {
            await page.goto(screen.path);
            await expect(page.getByRole('main'), `${screen.name} ${scheme} ${width}`).toBeVisible();
            const results = await new AxeBuilder({ page }).analyze();
            expect(
              results.violations.map((violation) => `${screen.name} ${scheme} ${width}: ${violation.id} ${violation.help}`),
            ).toEqual([]);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow, `${screen.name} ${scheme} ${width} scrolls horizontally`).toBeLessThanOrEqual(1);
          }
        }
      }
    } finally {
      await context.close();
    }
  });

  test('stack logs contain no password token or cookie after a full journey', async ({ browser }) => {
    // AUTH-18, the strongest form of the check: the whole journey runs, and afterwards every log line of
    // both services is searched for the password, the session token, the invite token and the cookie that
    // this test actually used. Any of them in a log is a leak. The password typed on a refused attempt is
    // searched too: a login that loses the credential loses it as well as one that wins.
    const admin = await browser.newContext();
    const invited = await browser.newContext();
    const anonymous = await browser.newContext();
    const email = memberEmail();
    const inviteEmailPassword = fixturePassword('logs-member');
    const wrongAttemptPassword = fixturePassword('logs-wrong');
    try {
      // A refused attempt on each door, with a password of its own, before the journey succeeds.
      const attemptsPage = await anonymous.newPage();
      const refusedAt = async (door: '/login' | '/admin/login'): Promise<void> => {
        await attemptsPage.goto(door);
        await attemptsPage.getByLabel('E-mail').fill(memberEmail());
        await attemptsPage.getByLabel('Senha').fill(wrongAttemptPassword);
        await attemptsPage.getByRole('button', { name: 'Entrar' }).click();
        await expect(attemptsPage.getByRole('alert'), door).toHaveText(WRONG_CREDENTIALS);
      };
      await refusedAt('/login');
      await refusedAt('/admin/login');

      const adminPage = await admin.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      const adminCookie = await sessionCookie(adminPage);
      const inviteUrl = await inviteFromScreen(adminPage, email);
      const inviteToken = tokenOf(inviteUrl);

      const invitedPage = await invited.newPage();
      await invitedPage.goto(inviteUrl);
      await invitedPage.getByLabel('Nome').fill('Pessoa dos Logs');
      await invitedPage.getByLabel('Senha').fill(inviteEmailPassword);
      await invitedPage.getByRole('button', { name: 'Criar conta' }).click();
      await invitedPage.waitForURL((url) => url.pathname === '/');
      const memberCookie = await sessionCookie(invitedPage);
      await invitedPage.getByRole('button', { name: 'Sair' }).click();
      await invitedPage.waitForURL('**/login');

      const secrets = [
        { label: 'the admin password', value: adminPassword },
        { label: 'the invited password', value: inviteEmailPassword },
        { label: 'the wrong password of a login attempt', value: wrongAttemptPassword },
        { label: 'the session token of the admin', value: adminCookie },
        { label: 'the session token of the member', value: memberCookie },
        { label: 'the invitation token', value: inviteToken },
      ];
      expect(new Set(secrets.map((secret) => secret.value)).size).toBe(secrets.length);

      // The access log of the web and the JSON lines of the api both write to `docker compose logs`, so the
      // whole output of each service is the haystack.
      for (const service of ['api', 'web'] as const) {
        const logs = logsOf(service);
        expect(logs, `${service} logged nothing, so the search would prove nothing`).not.toBe('');
        for (const secret of secrets) {
          expect(logs, `${service} logs hold ${secret.label}`).not.toContain(secret.value);
        }
      }
    } finally {
      await admin.close();
      await invited.close();
      await anonymous.close();
    }
  });
});

test.describe('identity invitations', () => {
  test('an expired invitation shows the invalid message without a form', async ({ browser }) => {
    // UI-16 at the only moment a screen cannot show it: the link was already dead when the person opened it.
    const context = await browser.newContext();
    const email = memberEmail();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      const inviteUrl = await inviteFromScreen(page, email);
      expireInvitations(email);

      await page.goto(inviteUrl);
      await expect(page.getByText(INVALID_INVITATION)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Criar conta' })).toHaveCount(0);
      await expect(page.getByLabel('Nome')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
