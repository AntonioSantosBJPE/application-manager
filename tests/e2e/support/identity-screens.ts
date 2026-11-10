import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { composeOk } from './compose.js';
import { createAdminOk, fixtureEmail, fixturePassword } from './identity.js';

/**
 * What the identity specs of the browser share: the messages the screens show, the admin of the run, and
 * the steps a person takes (sign in, invite, accept). Every step is what a person does in the browser.
 */

export const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';
export const EXPIRED_NOTICE = 'Sua sessão expirou. Entre de novo para continuar.';
export const GUARD_UNAVAILABLE = 'O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.';
export const INVALID_INVITATION = 'Este convite expirou ou já foi usado. Peça um novo link a quem te convidou.';

export const adminEmail = fixtureEmail('admin');
export const adminPassword = fixturePassword('admin');
export const memberPassword = fixturePassword('member');

export function memberEmail(): string {
  return fixtureEmail('member');
}

/** Signs in through the form of an area, as a person does: type, click, wait for the home. */
export async function signIn(page: Page, area: 'member' | 'admin', email: string, password: string): Promise<void> {
  await page.goto(area === 'admin' ? '/admin/login' : '/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(area === 'admin' ? '**/admin' : (url) => !url.pathname.startsWith('/login'));
}

/** The session cookie the browser holds, with the name the running configuration gives it (AUTH-08). */
export async function sessionCookieOf(page: Page): Promise<{ name: string; value: string }> {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name.endsWith('am_session'));
  expect(session, 'the browser holds the session cookie').toBeDefined();
  return { name: session!.name, value: session!.value };
}

/** The value of the session cookie the browser holds, which is the credential itself (AUTH-06). */
export async function sessionCookie(page: Page): Promise<string> {
  return (await sessionCookieOf(page)).value;
}

/** JSON log lines of a compose service; the access log of the web is plain text and is searched as it is. */
export function logsOf(service: 'api' | 'web'): string {
  return composeOk(['logs', '--no-log-prefix', service]);
}

export function jsonLogs(service: 'api' | 'web'): Record<string, unknown>[] {
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
export async function inviteFromScreen(page: Page, email: string): Promise<string> {
  await page.goto('/admin/invitations');
  await page.getByLabel('E-mail a convidar').fill(email);
  await page.getByRole('button', { name: 'Convidar', exact: true }).click();
  const link = page.getByLabel('Link do convite');
  await expect(link).toBeVisible();
  return link.inputValue();
}

/** The token of an invite link, which is the last segment of its path. */
export function tokenOf(inviteUrl: string): string {
  return new URL(inviteUrl).pathname.split('/').filter(Boolean).at(-1)!;
}

export interface MemberAccount {
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
export async function createMemberIn(browser: Browser, name: string): Promise<MemberAccount> {
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

let adminCreated = false;

/**
 * The only account that cannot be born in a screen: the first admin (CLI-01). Created once per worker
 * process, so every spec file of the identity screens can ask for it, in any shard and in any order.
 */
export function ensureAdmin(): void {
  if (adminCreated) return;
  createAdminOk(adminEmail, 'Admin do Produto', adminPassword);
  adminCreated = true;
}
