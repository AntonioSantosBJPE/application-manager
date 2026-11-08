import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { clientIpFixture, composeOk, composeWith, psql, waitHealthy } from '../../support/compose.js';
import {
  clearLoginAttempts,
  createAdminOk,
  fixtureEmail,
  fixturePassword,
} from '../../support/identity.js';

/** The address header of the fixture override: what the proxy in front of the web fills in production. */
const ADDRESS_HEADER = 'x-am-e2e-client-ip';
const FIRST_IP = '198.51.100.10';
const SECOND_IP = '198.51.100.20';

const adminEmail = fixtureEmail('admin-client-ip');
const adminPassword = fixturePassword('admin-client-ip');
/** The failure limit of one email + address, which both tests below reach (LOCK-01). */
const PAIR_LIMIT = 5;
const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';
const BLOCKED = /^Muitas tentativas\. Tente novamente em \d+ min\.$/;

/** A browser with the address header of one client, as the proxy in front of the web would send it. */
function contextFor(browser: Browser, ip: string): Promise<BrowserContext> {
  return browser.newContext({ extraHTTPHeaders: { [ADDRESS_HEADER]: ip } });
}

/**
 * Types the credentials on `/admin/login` and presses "Entrar", the way a person signs in, and returns once
 * the web answered that press. The alert of a previous attempt is still on screen, so waiting for the alert
 * alone would let it satisfy the wait of the next attempt; the response of this post is what it waits for.
 */
async function attemptSignIn(page: Page, password: string): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  const [answer] = await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('_serverFn')),
    page.getByRole('button', { name: 'Entrar' }).click(),
  ]);
  expect(answer.status(), 'the web answered the attempt').toBe(200);
}

test.describe('client ip', () => {
  test.beforeAll(async () => {
    test.setTimeout(5 * 60_000);
    createAdminOk(adminEmail, 'Admin do IP', adminPassword);
    // The condition the lockout counts under: a proxy in front of the web names the address.
    const up = composeWith([clientIpFixture], ['up', '--detach', '--wait']);
    if (up.status !== 0) throw new Error(`compose up with the client ip fixture exited ${up.status}\n${up.output}`);
    await waitHealthy('web');
  });

  test.afterAll(async () => {
    // Back to the configuration the other specs run against: the stack itself, without the override.
    composeOk(['up', '--detach', '--wait']);
    await waitHealthy('web');
  });

  test.beforeEach(() => {
    clearLoginAttempts(FIRST_IP);
    clearLoginAttempts(SECOND_IP);
  });

  test('failures from two client ips are counted separately through the web', async ({ browser }) => {
    // LOCK-09: five failures from one address block that address, and another address still signs in.
    const blocked = await contextFor(browser, FIRST_IP);
    const other = await contextFor(browser, SECOND_IP);
    try {
      const blockedPage = await blocked.newPage();
      for (let attempt = 1; attempt <= PAIR_LIMIT; attempt += 1) {
        await attemptSignIn(blockedPage, fixturePassword('wrong'));
        await expect(blockedPage.getByRole('alert'), `failure ${attempt}`).toHaveText(WRONG_CREDENTIALS);
      }

      // The correct password is refused from the blocked address, so the count reached the limit.
      await attemptSignIn(blockedPage, adminPassword);
      await expect(blockedPage.getByRole('alert')).toHaveText(BLOCKED);

      // The same account and password from another address, through the same web: that address counts alone.
      const otherPage = await other.newPage();
      await attemptSignIn(otherPage, adminPassword);
      await otherPage.waitForURL('**/admin');
      await expect(otherPage.getByRole('heading', { name: 'Administração' })).toBeVisible();
    } finally {
      await blocked.close();
      await other.close();
    }
  });

  test('a forged X-Forwarded-For does not change the count', async ({ browser }) => {
    // LOCK-10: with the address header configured, a value the client sends must be ignored. Each attempt
    // below carries a different X-Forwarded-For, so a stack that believed it would see five addresses and
    // never block; the sixth attempt proves which address was counted.
    const context = await contextFor(browser, FIRST_IP);
    try {
      const page = await context.newPage();
      await page.goto('/admin/login');
      await page.getByLabel('E-mail').fill(adminEmail);
      const attempt = async (password: string, forwardedFor: string): Promise<string> => {
        // Each attempt is judged by its own answer: the alert of the previous one is still on the page.
        await page.setExtraHTTPHeaders({ [ADDRESS_HEADER]: FIRST_IP, 'x-forwarded-for': forwardedFor });
        await page.getByLabel('Senha', { exact: true }).fill(password);
        const [answer] = await Promise.all([
          page.waitForResponse(
            (response) => response.request().method() === 'POST' && response.url().includes('_serverFn'),
          ),
          page.getByRole('button', { name: 'Entrar' }).click(),
        ]);
        expect(answer.status()).toBe(200);
        const alert = page.getByRole('alert');
        await expect(alert).toBeVisible();
        return (await alert.textContent()) ?? '';
      };

      for (let failure = 1; failure <= PAIR_LIMIT; failure += 1) {
        const message = await attempt(fixturePassword(`wrong-${failure}`), `203.0.113.${failure}`);
        expect(message, `failure ${failure}`).toBe(WRONG_CREDENTIALS);
      }

      // Still a fresh forged address in the header, and the right password: the counted address is blocked.
      const blocked = await attempt(adminPassword, '203.0.113.99');
      expect(blocked).toMatch(BLOCKED);

      // The count sits on the address the proxy named, and the refused attempt did not add to it (LOCK-05).
      expect(Number(psql(`select count(*) from identity.login_attempts where ip = '${FIRST_IP}'`)), 'the counted failures').toBe(
        PAIR_LIMIT,
      );
    } finally {
      await context.close();
    }
  });
});
