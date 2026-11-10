import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { composeOk, psql, waitHealthy } from '../../support/compose.js';
import { EMAIL_DOMAIN, expireInvitations, fixtureEmail, fixturePassword, revokePendingInvitations } from '../../support/identity.js';
import {
  adminEmail,
  adminPassword,
  createMemberIn,
  ensureAdmin,
  EXPIRED_NOTICE,
  GUARD_UNAVAILABLE,
  INVALID_INVITATION,
  inviteFromScreen,
  memberEmail,
  memberPassword,
  signIn,
  WRONG_CREDENTIALS,
} from '../../support/identity-screens.js';

/**
 * The identity screens against the production images: every screen and state in both themes and widths
 * (axe, horizontal scroll, reach), the dead invitation, and the Prumo copy. Split from identity.spec.ts,
 * whose journeys they do not need, so the browser shards run the two files apart: Playwright shards by
 * file in name order, and this name sorts after identity.spec.ts.
 */

test.beforeAll(() => {
  test.setTimeout(5 * 60_000);
  ensureAdmin();
});

test.describe('identity screens', () => {
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
