import { createHash, randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { composeOk, psql, waitHealthy } from '../../support/compose.js';
import {
  createAdminOk,
  EMAIL_DOMAIN,
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
const EXPIRED_NOTICE = 'Sua sessão expirou. Entre de novo para continuar.';
const GUARD_UNAVAILABLE = 'O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.';
const INVALID_INVITATION = 'Este convite expirou ou já foi usado. Peça um novo link a quem te convidou.';

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
  await page.getByLabel('Senha', { exact: true }).fill(password);
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
  await page.getByRole('button', { name: 'Convidar', exact: true }).click();
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
    await page.getByLabel('Senha', { exact: true }).fill(memberPassword);
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
      await invitedPage.getByLabel('Senha', { exact: true }).fill(memberPassword);
      await invitedPage.getByRole('button', { name: 'Criar conta' }).click();

      await invitedPage.waitForURL((url) => url.pathname === '/');
      await expect(invitedPage.getByRole('heading', { name: 'Início' })).toBeVisible();
      await expect(invitedPage.getByText('Pessoa Convidada', { exact: true })).toBeVisible();
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
      await expect(page.getByText('Pessoa do Member', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Sair' }).click();
      await page.waitForURL('**/login');

      // The route asked for survives the login, and it is not the default home: `/status` is what opens.
      await page.goto('/login?redirect=%2Fstatus');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha', { exact: true }).fill(memberPassword);
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
      await page.getByLabel('Senha', { exact: true }).fill(memberPassword);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
      await expect(page.getByText('Pessoa do Member', { exact: true })).toBeVisible();
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
      await page.getByLabel('Senha', { exact: true }).fill(adminPassword);
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
        await page.getByRole('button', { name: 'Convidar', exact: true }).click();

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
    const member = await createMemberIn(browser, 'Pessoa Sem Acesso');
    try {
      await member.page.goto('/admin');
      await expect(member.page.getByRole('heading', { name: 'Sem acesso' })).toBeVisible();
      await expect(member.page.getByRole('link', { name: 'Voltar para o início' })).toBeVisible();
      await expect(member.page.getByRole('heading', { name: 'Administração' })).toHaveCount(0);
      await expect(member.page.getByRole('navigation', { name: 'Navegação da administração' })).toHaveCount(0);
      await expect(member.page.getByText('Convites pendentes')).toHaveCount(0);
    } finally {
      await member.context.close();
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
      await page.getByLabel('Senha', { exact: true }).fill(adminPassword);
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
          await page.getByLabel('Senha', { exact: true }).fill('a-wrong-password-to-fail');
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
    const anonymous = await browser.newContext();
    const member = await createMemberIn(browser, 'Pessoa da Archetype');
    try {
      const page = await anonymous.newPage();
      await page.goto('/login');
      await expect(page.locator('[data-archetype="auth"]')).toHaveCount(1);
      await page.goto('/admin/login');
      await expect(page.locator('[data-archetype="auth"]')).toHaveCount(1);

      const adminPage = await anonymous.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      const inviteUrl = await inviteFromScreen(adminPage, memberEmail());
      await page.goto(inviteUrl);
      await expect(page.locator('[data-archetype="auth"]')).toHaveCount(1);

      // The member home is the dashboard of the person who accepted an invitation (UI-15).
      await expect(member.page.locator('[data-archetype="dashboard"]')).toHaveCount(1);
    } finally {
      await anonymous.close();
      await member.context.close();
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
      await expect(summary).toHaveText(
        /^Convites pendentes\s*Ver convites\s*1\s*O mais antigo expira em 7 d\.\s*Convidar pessoa$/,
      );
      await page.getByRole('link', { name: 'Ver convites' }).click();
      await page.waitForURL('**/admin/invitations');
      await expect(page.getByRole('heading', { name: 'Convites' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('identity screens have no axe violations or horizontal scroll in both themes and widths', async ({ browser }) => {
    // Eleven screens and states, two themes, two widths, one axe scan each: more than the default 2 minutes.
    test.setTimeout(10 * 60_000);
    // UI-22: every screen of the feature, in the light and the dark theme, at a phone and a desktop width.
    // Each screen is opened in the context of the role that sees it, so what is scanned is the screen a
    // person of that role actually gets: the login doors, the invite link good and dead, the member home,
    // the no-access screen and both screens of the admin area. The states that appear only after an action are
    // scanned too: the link block right after "Convidar", the open revoke confirmation, the alerts of a refused
    // login (401, 429, expired session) and the unavailable screen of a stopped api.
    const anonymous = await browser.newContext();
    const admin = await browser.newContext();
    const member = await createMemberIn(browser, 'Pessoa da Acessibilidade');
    try {
      const adminPage = await admin.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      const pendingInvite = await inviteFromScreen(adminPage, memberEmail());
      const expiredEmail = memberEmail();
      const expiredInvite = await inviteFromScreen(adminPage, expiredEmail);
      expireInvitations(expiredEmail);

      const anonymousPage = await anonymous.newPage();

      // An email locked out by five wrong attempts, so the 429 alert can be opened in every theme and width.
      // A blocked attempt records no failure, so the lock stays for the whole test.
      const lockedEmail = fixtureEmail('locked');
      const attemptWith = async (email: string): Promise<void> => {
        await anonymousPage.goto('/login');
        await anonymousPage.getByLabel('E-mail').fill(email);
        await anonymousPage.getByLabel('Senha', { exact: true }).fill(fixturePassword('wrong'));
        await anonymousPage.getByRole('button', { name: 'Entrar' }).click();
      };
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await attemptWith(lockedEmail);
        await expect(anonymousPage.getByRole('alert')).toHaveText(WRONG_CREDENTIALS);
      }

      // Each screen carries a marker of its own: the login form, the invited email, the invalid message,
      // the member home, the no-access message, the dashboard and the invitations. A screen that silently
      // redirected would be scanned as another one without the marker, and the marker stops that.
      const screens: {
        page: Page;
        path: string;
        name: string;
        open?: () => Promise<void>;
        marker: () => Locator;
      }[] = [
        { page: anonymousPage, path: '/login', name: 'login', marker: () => anonymousPage.getByRole('button', { name: 'Entrar' }) },
        {
          page: anonymousPage,
          path: '/admin/login',
          name: 'admin login',
          marker: () => anonymousPage.getByRole('heading', { name: 'Administração' }),
        },
        {
          page: anonymousPage,
          path: new URL(pendingInvite).pathname,
          name: 'invite',
          marker: () => anonymousPage.getByRole('button', { name: 'Criar conta' }),
        },
        {
          page: anonymousPage,
          path: new URL(expiredInvite).pathname,
          name: 'invite 410',
          marker: () => anonymousPage.getByText(INVALID_INVITATION),
        },
        {
          page: member.page,
          path: '/',
          name: 'member home',
          marker: () => member.page.getByRole('heading', { name: 'Início' }),
        },
        {
          page: member.page,
          path: '/admin',
          name: 'no access',
          marker: () => member.page.getByRole('heading', { name: 'Sem acesso' }),
        },
        {
          page: adminPage,
          path: '/admin',
          name: 'admin dashboard',
          marker: () => adminPage.getByRole('heading', { name: 'Administração' }),
        },
        {
          page: adminPage,
          path: '/admin/invitations',
          name: 'admin invitations',
          marker: () => adminPage.getByRole('heading', { name: 'Convites' }),
        },
        {
          page: adminPage,
          path: '/admin/invitations',
          name: 'invitation link block',
          // The link exists only right after "Convidar", so each pass creates a new invitation.
          open: async () => {
            await adminPage.goto('/admin/invitations');
            await adminPage.getByLabel('E-mail a convidar').fill(memberEmail());
            await adminPage.getByRole('button', { name: 'Convidar', exact: true }).click();
          },
          marker: () => adminPage.getByLabel('Link do convite'),
        },
        {
          page: adminPage,
          path: '/admin/invitations',
          name: 'revoke confirmation',
          open: async () => {
            await adminPage.goto('/admin/invitations');
            await adminPage.getByRole('button', { name: /^Revogar convite de / }).first().click();
          },
          marker: () => adminPage.getByRole('alertdialog', { name: 'Revogar convite' }),
        },
        {
          page: anonymousPage,
          path: '/login',
          name: 'login 401',
          open: () => attemptWith(memberEmail()),
          marker: () => anonymousPage.getByRole('alert').filter({ hasText: WRONG_CREDENTIALS }),
        },
        {
          page: anonymousPage,
          path: '/login',
          name: 'login 429',
          open: () => attemptWith(lockedEmail),
          marker: () => anonymousPage.getByRole('alert').filter({ hasText: /^Muitas tentativas\. Tente novamente em \d+ min\.$/ }),
        },
        {
          page: anonymousPage,
          path: '/login?redirect=%2F&reason=expired',
          name: 'login expired',
          marker: () => anonymousPage.getByText(EXPIRED_NOTICE),
        },
      ];
      const scan = async (page: Page, label: string): Promise<void> => {
        const results = await new AxeBuilder({ page }).analyze();
        expect(
          results.violations.map((violation) => `${label}: ${violation.id} ${violation.help}`),
        ).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${label} scrolls horizontally`).toBeLessThanOrEqual(1);
      };
      for (const scheme of ['light', 'dark'] as const) {
        for (const width of [375, 1280]) {
          for (const screen of screens) {
            const label = `${screen.name} ${scheme} ${width}`;
            await screen.page.setViewportSize({ width, height: 900 });
            await screen.page.emulateMedia({ colorScheme: scheme });
            if (screen.open === undefined) await screen.page.goto(screen.path);
            else await screen.open();
            await expect(screen.marker(), label).toBeVisible();
            await expect(screen.page.locator('main'), label).toBeVisible();
            await scan(screen.page, label);
          }
        }
      }

      // The unavailable screen needs the api down, so it is the last one: the api is brought back and
      // waited for before anything else runs.
      composeOk(['stop', 'api']);
      try {
        for (const scheme of ['light', 'dark'] as const) {
          for (const width of [375, 1280]) {
            const label = `unavailable ${scheme} ${width}`;
            await anonymousPage.setViewportSize({ width, height: 900 });
            await anonymousPage.emulateMedia({ colorScheme: scheme });
            await anonymousPage.goto('/');
            await expect(anonymousPage.getByText(GUARD_UNAVAILABLE), label).toBeVisible();
            await expect(anonymousPage.getByRole('main'), label).toBeVisible();
            await scan(anonymousPage, label);
          }
        }
      } finally {
        composeOk(['start', 'api']);
        await waitHealthy('api');
      }
    } finally {
      await anonymous.close();
      await admin.close();
      await member.context.close();
    }
  });

  test('a long invitation email and link stay inside the page in both themes and widths', async ({ browser }) => {
    // UI-25: an email or a link wider than the line wraps instead of pushing "Revogar" or "Copiar" out of the
    // viewport or making the page scroll sideways. The emails have no break opportunity of their own, which is
    // the worst case for a row, and each pass invites a new one so the link block is on screen right after
    // "Convidar", the only moment the link exists.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await signIn(page, 'admin', adminEmail, adminPassword);
      const insideViewport = async (locator: Locator, label: string): Promise<void> => {
        await expect(locator, label).toBeVisible();
        const box = await locator.boundingBox();
        const width = page.viewportSize()!.width;
        expect(box, label).not.toBeNull();
        expect(box!.x, `${label} starts inside the viewport`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${label} ends inside the viewport`).toBeLessThanOrEqual(width);
      };

      for (const scheme of ['light', 'dark'] as const) {
        for (const width of [375, 1280]) {
          const label = `long invitation ${scheme} ${width}`;
          const email = `${randomUUID().slice(0, 8)}long${'a'.repeat(52)}@${'d'.repeat(55)}.${EMAIL_DOMAIN}`;
          expect(email.length, 'the email is wider than any row').toBeGreaterThan(100);

          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme: scheme });
          await page.goto('/admin/invitations');
          await page.getByLabel('E-mail a convidar').fill(email);
          await page.getByRole('button', { name: 'Convidar', exact: true }).click();
          await expect(page.getByLabel('Link do convite'), label).toBeVisible();

          await insideViewport(page.getByRole('button', { name: 'Copiar' }), `${label} Copiar`);
          await insideViewport(page.getByRole('button', { name: `Revogar convite de ${email}` }), `${label} Revogar`);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `${label} scrolls horizontally`).toBeLessThanOrEqual(1);

          // The confirmation repeats the email in its text: opened, it fits the viewport with its actions.
          await page.getByRole('button', { name: `Revogar convite de ${email}` }).click();
          const dialog = page.getByRole('alertdialog', { name: 'Revogar convite' });
          await insideViewport(dialog, `${label} dialog`);
          await insideViewport(dialog.getByRole('button', { name: 'Cancelar' }), `${label} dialog Cancelar`);
          await insideViewport(dialog.getByRole('button', { name: 'Revogar' }), `${label} dialog Revogar`);
          expect(
            await dialog.evaluate((element) => element.scrollWidth - element.clientWidth),
            `${label} dialog text hides width`,
          ).toBeLessThanOrEqual(0);
          await page.keyboard.press('Escape');
          await expect(dialog, label).toBeHidden();
          // The whole link is in the box, wrapped, not cut by it.
          const link = page.getByLabel('Link do convite');
          expect(
            await link.evaluate((element) => element.scrollWidth - element.clientWidth),
            `${label} link hides width`,
          ).toBeLessThanOrEqual(0);
          expect(
            await link.evaluate((element) => element.scrollHeight - element.clientHeight),
            `${label} link hides lines`,
          ).toBeLessThanOrEqual(0);
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
        await attemptsPage.getByLabel('Senha', { exact: true }).fill(wrongAttemptPassword);
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
      await invitedPage.getByLabel('Senha', { exact: true }).fill(inviteEmailPassword);
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

test.describe('Prumo screens', () => {
  test('PRU-03 AC08 the password fields show and hide what was typed with the fixed label Mostrar senha', async ({
    browser,
  }) => {
    // PRU-03: the toggle sits right after the field, keeps one label and says its state in aria-pressed;
    // the value survives every switch and a refused login, and the field never leaves as text.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      for (const door of ['/login', '/admin/login'] as const) {
        await page.goto(door);
        const password = page.getByLabel('Senha', { exact: true });
        const toggle = page.getByRole('button', { name: 'Mostrar senha' });
        await expect(password, door).toHaveAttribute('type', 'password');
        await expect(toggle, door).toHaveAttribute('aria-pressed', 'false');

        await page.getByLabel('E-mail').fill(memberEmail());
        await password.fill('a-wrong-password-to-see');
        await toggle.click();
        await expect(password, door).toHaveAttribute('type', 'text');
        await expect(password, door).toHaveValue('a-wrong-password-to-see');
        await expect(toggle, door).toHaveAttribute('aria-pressed', 'true');
        await expect(toggle, door).toHaveAccessibleName('Mostrar senha');

        // A refused login keeps the state and the value as the person left them (PRU-03 AC9).
        await page.getByRole('button', { name: 'Entrar' }).click();
        await expect(page.getByRole('alert'), door).toHaveText(WRONG_CREDENTIALS);
        await expect(password, door).toHaveAttribute('type', 'text');
        await expect(password, door).toHaveValue('a-wrong-password-to-see');

        // By keyboard: Tab from the field reaches the toggle, and Space hides the value again.
        await password.focus();
        await page.keyboard.press('Tab');
        await expect(toggle, door).toBeFocused();
        await page.keyboard.press('Space');
        await expect(password, door).toHaveAttribute('type', 'password');
        await expect(toggle, door).toHaveAttribute('aria-pressed', 'false');
        await page.keyboard.press('Enter');
        await expect(password, door).toHaveAttribute('type', 'text');
      }

      // The invite link has the same field, and the account is created with the password as typed.
      const adminPage = await context.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      const inviteUrl = await inviteFromScreen(adminPage, memberEmail());
      await adminPage.getByRole('button', { name: 'Sair' }).click();
      await adminPage.waitForURL('**/admin/login');

      const invitePage = await context.newPage();
      await invitePage.goto(inviteUrl);
      const password = invitePage.getByLabel('Senha', { exact: true });
      await invitePage.getByLabel('Nome').fill('Pessoa da Senha');
      await password.fill(memberPassword);
      await invitePage.getByRole('button', { name: 'Mostrar senha' }).click();
      await expect(password).toHaveAttribute('type', 'text');
      await expect(password).toHaveValue(memberPassword);
      await invitePage.getByRole('button', { name: 'Criar conta' }).click();
      await invitePage.waitForURL((url) => url.pathname === '/');
      await expect(invitePage.getByRole('heading', { name: 'Início' })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('PRU-06 AC26 keeps the redirects, guards, forms and calls of the screens with the Prumo copy', async ({
    browser,
    request,
  }) => {
    // PRU-06 AC26: the redesign changes the look and the sentences the cards redo, not the behavior.
    const redirect = await request.get('/admin', { maxRedirects: 0 });
    expect(redirect.status()).toBe(307);
    expect(redirect.headers()['location']).toBe('/admin/login?redirect=%2Fadmin');

    const member = await createMemberIn(browser, 'Pessoa do Comportamento');
    const admin = await browser.newContext();
    try {
      const { page, email } = member;
      await expect(page.getByText('Olá, Pessoa do Comportamento')).toBeVisible();

      // The guard of the admin area answers a member on the same url, and the way back opens the home.
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Sem acesso' })).toBeVisible();
      await expect(page.getByText('Esta área é da administração. Sua conta é de uso do produto.')).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/admin');
      await page.getByRole('link', { name: 'Voltar para o início' }).click();
      await page.waitForURL((url) => url.pathname === '/');

      // Sair, then a refused login keeps the e-mail, and the right password opens the asked route.
      await page.getByRole('button', { name: 'Sair' }).click();
      await page.waitForURL('**/login');
      await page.goto('/login?redirect=%2Fstatus');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Senha', { exact: true }).fill(fixturePassword('wrong'));
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('alert')).toHaveText(WRONG_CREDENTIALS);
      await expect(page.getByLabel('E-mail')).toHaveValue(email);
      await page.getByLabel('Senha', { exact: true }).fill(memberPassword);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL('**/status');
      await expect(page.getByRole('heading', { level: 1, name: 'Status' })).toBeVisible();

      // The admin invites, revokes behind the confirmation, and the revoked link is dead.
      const adminPage = await admin.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      const invited = memberEmail();
      const inviteUrl = await inviteFromScreen(adminPage, invited);
      await expect(adminPage.getByRole('status')).toHaveText(
        `Convite criado para ${invited}· este link só aparece desta vez. Copie-o agora.`,
      );
      await adminPage.getByRole('button', { name: `Revogar convite de ${invited}` }).click();
      const dialog = adminPage.getByRole('alertdialog', { name: 'Revogar convite' });
      await expect(dialog).toContainText(invited);
      await dialog.getByRole('button', { name: 'Revogar' }).click();
      await expect(adminPage.getByRole('button', { name: `Revogar convite de ${invited}` })).toHaveCount(0);
      expect(psql(`select revoked_at is not null from identity.invitations where email = '${invited}'`)).toBe('t');

      const deadPage = await admin.newPage();
      await deadPage.goto(inviteUrl);
      await expect(deadPage.getByRole('heading', { name: 'Convite inválido' })).toBeVisible();
      await expect(deadPage.getByText(INVALID_INVITATION)).toBeVisible();
      await expect(deadPage.getByRole('button', { name: 'Criar conta' })).toHaveCount(0);
    } finally {
      await member.context.close();
      await admin.close();
    }
  });

  test('PRU-06 AC27 the screens have no axe violations, no horizontal scroll and every control in reach at 360 px in both themes', async ({
    browser,
  }) => {
    test.setTimeout(5 * 60_000);
    // PRU-06 AC27 at the narrowest width the spec names, for every screen of the feature: the doors, the
    // invite good and dead, the member home, no access, the admin dashboard, the invitations with the link
    // strip, the empty invitations, the revoke confirmation and the public status.
    const anonymous = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const admin = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const member = await createMemberIn(browser, 'Pessoa dos 360');
    try {
      await member.page.setViewportSize({ width: 360, height: 800 });
      const adminPage = await admin.newPage();
      await signIn(adminPage, 'admin', adminEmail, adminPassword);
      const pendingInvite = await inviteFromScreen(adminPage, memberEmail());
      const expiredEmail = memberEmail();
      const expiredInvite = await inviteFromScreen(adminPage, expiredEmail);
      expireInvitations(expiredEmail);
      const anonymousPage = await anonymous.newPage();

      const screens: {
        page: Page;
        name: string;
        open: () => Promise<unknown>;
        marker: () => Locator;
      }[] = [
        {
          page: anonymousPage,
          name: 'login',
          open: () => anonymousPage.goto('/login'),
          marker: () => anonymousPage.getByRole('button', { name: 'Entrar' }),
        },
        {
          page: anonymousPage,
          name: 'admin login',
          open: () => anonymousPage.goto('/admin/login'),
          marker: () => anonymousPage.getByRole('heading', { name: 'Administração' }),
        },
        {
          page: anonymousPage,
          name: 'login expired',
          open: () => anonymousPage.goto('/login?redirect=%2F&reason=expired'),
          marker: () => anonymousPage.getByText(EXPIRED_NOTICE),
        },
        {
          page: anonymousPage,
          name: 'invite',
          open: () => anonymousPage.goto(new URL(pendingInvite).pathname),
          marker: () => anonymousPage.getByRole('button', { name: 'Criar conta' }),
        },
        {
          page: anonymousPage,
          name: 'invite 410',
          open: () => anonymousPage.goto(new URL(expiredInvite).pathname),
          marker: () => anonymousPage.getByText(INVALID_INVITATION),
        },
        {
          page: anonymousPage,
          name: 'status',
          open: () => anonymousPage.goto('/status'),
          marker: () => anonymousPage.getByRole('heading', { level: 1, name: 'Status' }),
        },
        {
          page: member.page,
          name: 'member home',
          open: () => member.page.goto('/'),
          marker: () => member.page.getByRole('heading', { name: 'Início' }),
        },
        {
          page: member.page,
          name: 'no access',
          open: () => member.page.goto('/admin'),
          marker: () => member.page.getByRole('heading', { name: 'Sem acesso' }),
        },
        {
          page: adminPage,
          name: 'admin dashboard',
          open: () => adminPage.goto('/admin'),
          marker: () => adminPage.getByRole('heading', { name: 'Administração' }),
        },
        {
          page: adminPage,
          name: 'invitation link strip',
          open: async () => {
            await adminPage.goto('/admin/invitations');
            await adminPage.getByLabel('E-mail a convidar').fill(memberEmail());
            await adminPage.getByRole('button', { name: 'Convidar', exact: true }).click();
          },
          marker: () => adminPage.getByLabel('Link do convite'),
        },
        {
          page: adminPage,
          name: 'revoke confirmation',
          open: async () => {
            await adminPage.goto('/admin/invitations');
            await adminPage
              .getByRole('button', { name: /^Revogar convite de / })
              .first()
              .click();
          },
          marker: () => adminPage.getByRole('alertdialog', { name: 'Revogar convite' }),
        },
      ];
      // Last, because emptying the list kills the pending invite the screens above open.
      const empty = {
        page: adminPage,
        name: 'empty invitations',
        open: async () => {
          revokePendingInvitations();
          await adminPage.goto('/admin/invitations');
        },
        marker: () => adminPage.getByText('Nenhum convite pendente.'),
      };
      const passes = [
        ...(['light', 'dark'] as const).flatMap((scheme) => screens.map((screen) => ({ scheme, screen }))),
        ...(['light', 'dark'] as const).map((scheme) => ({ scheme, screen: empty })),
      ];

      for (const { scheme, screen } of passes) {
        {
          const label = `${screen.name} ${scheme} 360`;
          await screen.page.emulateMedia({ colorScheme: scheme });
          await screen.open();
          await expect(screen.marker(), label).toBeVisible();
          const results = await new AxeBuilder({ page: screen.page }).analyze();
          expect(results.violations.map((violation) => `${label}: ${violation.id} ${violation.help}`)).toEqual([]);
          const reach = await screen.page.evaluate(() => {
            const width = document.documentElement.clientWidth;
            const controls = Array.from(
              document.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select'),
            );
            const outside = controls
              .filter((control) => control.getClientRects().length > 0)
              .map((control) => ({ control, box: control.getBoundingClientRect() }))
              .filter(({ box }) => box.width > 1 && (box.left < -1 || box.right > width + 1))
              .map(
                ({ control }) => control.getAttribute('aria-label') ?? control.textContent?.trim() ?? control.tagName,
              );
            return { overflow: document.documentElement.scrollWidth - width, outside };
          });
          expect(reach.overflow, `${label} scrolls horizontally`).toBeLessThanOrEqual(1);
          expect(reach.outside, `${label} controls out of reach`).toEqual([]);
        }
      }
    } finally {
      await anonymous.close();
      await admin.close();
      await member.context.close();
    }
  });
});
