import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { createAdminOk, fixtureEmail, fixturePassword } from '../../support/identity.js';

/**
 * The skills catalog against the production images (SKL-52, SKL-53 and the journey of the Success
 * Criteria). The member has no screen for skills, so the private skills are created through the api
 * with the session cookie of the member; everything the admin does is done in the browser.
 */

const API = `http://127.0.0.1:${process.env.API_PORT ?? '3333'}`;
const PROMOTE_CONFLICT = 'Já existe uma skill global com esse nome ou apelido. A fusão é manual.';

const adminEmail = fixtureEmail('admin');
const adminPassword = fixturePassword('admin');
const memberPassword = fixturePassword('member');

interface ApiSkill {
  id: string;
  name: string;
  category: string;
  scope: 'global' | 'private';
}

interface Account {
  context: BrowserContext;
  page: Page;
  cookie: string;
}

async function signIn(page: Page, area: 'member' | 'admin', email: string, password: string): Promise<void> {
  await page.goto(area === 'admin' ? '/admin/login' : '/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(area === 'admin' ? '**/admin' : (url) => !url.pathname.startsWith('/login'));
}

async function newAdmin(browser: Browser): Promise<Account> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, 'admin', adminEmail, adminPassword);
  return { context, page, cookie: '' };
}

/** Invites from an admin screen and accepts in a context of its own, as the product does (INV-07). */
async function newMember(browser: Browser, admin: Page, name: string): Promise<Account> {
  const email = fixtureEmail('member');
  await admin.goto('/admin/invitations');
  await admin.getByLabel('E-mail a convidar').fill(email);
  await admin.getByRole('button', { name: 'Convidar', exact: true }).click();
  const link = admin.getByLabel('Link do convite');
  await expect(link).toBeVisible();
  const inviteUrl = await link.inputValue();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(inviteUrl);
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('Senha', { exact: true }).fill(memberPassword);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  const session = (await context.cookies()).find((cookie) => cookie.name.endsWith('am_session'));
  expect(session, 'the member holds the session cookie').toBeDefined();
  return { context, page, cookie: `${session!.name}=${session!.value}` };
}

async function createPrivate(member: Account, name: string): Promise<{ status: number; skill: ApiSkill }> {
  const response = await fetch(`${API}/skills`, {
    method: 'POST',
    headers: { cookie: member.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name, category: 'tool' }),
  });
  return { status: response.status, skill: (await response.json()) as ApiSkill };
}

async function searchAs(member: Account, q: string): Promise<ApiSkill[]> {
  const response = await fetch(`${API}/skills?q=${encodeURIComponent(q)}`, { headers: { cookie: member.cookie } });
  expect(response.status).toBe(200);
  return (await response.json()) as ApiSkill[];
}

async function adminCookie(admin: Account): Promise<string> {
  const session = (await admin.context.cookies()).find((cookie) => cookie.name.endsWith('am_session'));
  return `${session!.name}=${session!.value}`;
}

const rowOf = (page: Page, name: string): Locator => page.locator('[data-skill-id]').filter({ hasText: name });

async function openCatalog(page: Page, scheme: 'light' | 'dark' = 'light', width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto('/admin/skills');
  await expect(page.getByRole('heading', { name: 'Catálogo de skills' })).toBeVisible();
  await expect(page.locator('[data-skill-id]').first()).toBeVisible();
}

async function narrowTo(page: Page, text: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Nome ou apelido' }).fill(text);
  await expect(page).toHaveURL(new RegExp('q='));
}

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(
    results.violations.map((violation) => `${label}: ${violation.id} ${violation.help} ${violation.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe.configure({ mode: 'serial' });

test.describe('skills catalog', () => {
  let admin: Account;
  let memberA: Account;
  let memberB: Account;
  let memberC: Account;
  let promotedId = '';

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(5 * 60_000);
    createAdminOk(adminEmail, 'Admin do Catálogo', adminPassword);
    admin = await newAdmin(browser);
    const inviter = admin.page;
    memberA = await newMember(browser, inviter, 'Pessoa A');
    memberB = await newMember(browser, inviter, 'Pessoa B');
    memberC = await newMember(browser, inviter, 'Pessoa C');
  });

  test.afterAll(async () => {
    for (const account of [admin, memberA, memberB, memberC]) await account?.context.close();
  });

  test('journey: a private skill of one member is promoted by the admin and found by another member with the same id', async () => {
    const created = await createPrivate(memberA, 'Drizzle ORM de Teste');
    expect(created.status).toBe(201);
    promotedId = created.skill.id;
    expect(created.skill.scope).toBe('private');

    // Another member does not see it while it is private.
    expect((await searchAs(memberB, 'Drizzle ORM de Teste')).map((skill) => skill.id)).not.toContain(promotedId);
    expect((await searchAs(memberA, 'Drizzle ORM de Teste')).map((skill) => skill.id)).toContain(promotedId);

    const { page } = admin;
    await openCatalog(page);
    await page.getByRole('button', { name: 'Privadas' }).click();
    const row = rowOf(page, 'Drizzle ORM de Teste');
    await expect(row).toBeVisible();
    await expect(row.getByText('Privada', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Promover' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Promover Drizzle ORM de Teste?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Promover' }).click();
    await expect(dialog).toBeHidden();
    await expect(row.getByText('Privada', { exact: true })).toHaveCount(0);

    const found = (await searchAs(memberB, 'Drizzle ORM de Teste')).find((skill) => skill.id === promotedId);
    expect(found).toMatchObject({ id: promotedId, name: 'Drizzle ORM de Teste', scope: 'global' });
  });

  test('journey: the admin edits the skill and registers, edits and removes an alias, and the member search follows', async () => {
    const { page } = admin;
    await openCatalog(page);
    await narrowTo(page, 'Drizzle ORM de Teste');
    const row = rowOf(page, 'Drizzle ORM de Teste');
    await expect(row).toBeVisible();

    // Edit the name from the menu of the row.
    await row.getByRole('button', { name: 'Ações de Drizzle ORM de Teste' }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const edit = page.getByRole('dialog', { name: 'Editar skill' });
    await edit.getByLabel('Nome').fill('Skill Fictícia Beta');
    await edit.getByRole('button', { name: 'Salvar' }).click();
    await expect(edit).toBeHidden();
    await expect(rowOf(page, 'Skill Fictícia Beta')).toBeVisible();
    expect((await searchAs(memberB, 'Skill Fictícia Beta')).find((skill) => skill.id === promotedId)?.name).toBe('Skill Fictícia Beta');
    expect((await searchAs(memberB, 'Drizzle ORM de Teste')).map((skill) => skill.id)).not.toContain(promotedId);

    // Register an alias from the top bar.
    await page.getByRole('button', { name: 'Apelido', exact: true }).click();
    const add = page.getByRole('dialog', { name: 'Novo apelido' });
    await add.getByRole('combobox', { name: 'Skill' }).fill('Skill Fictícia Beta');
    await add.getByRole('option', { name: 'Skill Fictícia Beta' }).click();
    await add.getByLabel('Apelido', { exact: true }).fill('Beta Fictícia');
    await add.getByRole('button', { name: 'Salvar' }).click();
    await expect(add).toBeHidden();
    expect((await searchAs(memberB, 'Beta Fictícia')).map((skill) => skill.id)).toContain(promotedId);

    // Edit and remove it from the aliases dialog.
    await narrowTo(page, 'Skill Fictícia Beta');
    const beta = rowOf(page, 'Skill Fictícia Beta');
    await beta.getByRole('button', { name: 'Ações de Skill Fictícia Beta' }).click();
    await page.getByRole('menuitem', { name: 'Apelidos' }).click();
    const aliases = page.getByRole('dialog', { name: 'Apelidos de Skill Fictícia Beta' });
    await expect(aliases.getByText('Beta Fictícia', { exact: true })).toBeVisible();
    await aliases.getByRole('button', { name: 'Editar' }).click();
    await aliases.getByRole('textbox', { name: 'Apelido', exact: true }).fill('Gama Fictícia');
    await aliases.getByRole('button', { name: 'Salvar' }).click();
    await expect(aliases.getByText('Gama Fictícia', { exact: true })).toBeVisible();
    expect((await searchAs(memberB, 'Beta Fictícia')).map((skill) => skill.id)).not.toContain(promotedId);
    expect((await searchAs(memberB, 'Gama Fictícia')).map((skill) => skill.id)).toContain(promotedId);

    await aliases.getByRole('button', { name: 'Remover' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Remover o apelido Gama Fictícia?' });
    await confirm.getByRole('button', { name: 'Remover' }).click();
    await expect(confirm).toBeHidden();
    await expect(aliases.getByText('Esta skill não tem apelidos.')).toBeVisible();
    expect((await searchAs(memberB, 'Gama Fictícia')).map((skill) => skill.id)).not.toContain(promotedId);
  });

  test('SKL-52 axe finds no WCAG 2.x AA violation in the states of the catalog, in both themes', async () => {
    test.setTimeout(5 * 60_000);
    // Two people own a private skill with the same key; the first is promoted through the api, so the
    // promotion of the second one, made on the screen, is refused with a 409.
    const first = await createPrivate(memberA, 'Skill Fictícia Alfa');
    const second = await createPrivate(memberC, 'Skill Fictícia Alfa');
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.skill.id).not.toBe(second.skill.id);
    const promote = await fetch(`${API}/skills/${first.skill.id}/promote`, {
      method: 'POST',
      headers: { cookie: await adminCookie(admin) },
    });
    expect(promote.status).toBe(200);

    const { page } = admin;
    for (const scheme of ['light', 'dark'] as const) {
      const label = (state: string) => `${state} ${scheme}`;
      await openCatalog(page, scheme);
      await scan(page, label('list'));

      // Empty.
      await narrowTo(page, 'zzzzzz');
      await expect(page.getByText('Nenhuma skill encontrada.')).toBeVisible();
      await scan(page, label('empty'));
      await page.getByRole('button', { name: 'Limpar filtros' }).click();
      await narrowTo(page, 'Node.js');
      await expect(page.getByRole('button', { name: 'Ações de Node.js' })).toBeVisible();

      // Menu open.
      await page.getByRole('button', { name: 'Ações de Node.js' }).click();
      await expect(page.getByRole('menuitem', { name: 'Editar' })).toBeVisible();
      await scan(page, label('menu'));
      await page.getByRole('menuitem', { name: 'Editar' }).click();
      const edit = page.getByRole('dialog', { name: 'Editar skill' });
      await expect(edit).toBeVisible();
      await scan(page, label('edit dialog'));
      await page.keyboard.press('Escape');
      await expect(edit).toBeHidden();

      await page.getByRole('button', { name: 'Ações de Node.js' }).click();
      await page.getByRole('menuitem', { name: 'Apelidos' }).click();
      const aliases = page.getByRole('dialog', { name: 'Apelidos de Node.js' });
      await expect(aliases).toBeVisible();
      await scan(page, label('aliases dialog'));
      await aliases.getByRole('button', { name: 'Remover' }).first().click();
      const removal = page.getByRole('alertdialog', { name: /^Remover o apelido/ });
      await expect(removal).toBeVisible();
      await scan(page, label('remove alias confirmation'));
      await removal.getByRole('button', { name: 'Cancelar' }).click();
      await expect(removal).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(aliases).toBeHidden();

      // Add alias dialog.
      await page.getByRole('button', { name: 'Apelido', exact: true }).click();
      const add = page.getByRole('dialog', { name: 'Novo apelido' });
      await expect(add).toBeVisible();
      await scan(page, label('add alias dialog'));
      await page.keyboard.press('Escape');
      await expect(add).toBeHidden();

      // Promotion confirmation, then the 409 as an Alert.
      await narrowTo(page, 'Skill Fictícia Alfa');
      await page.getByRole('button', { name: 'Privadas' }).click();
      const pending = rowOf(page, 'Skill Fictícia Alfa').filter({ has: page.getByRole('button', { name: 'Promover' }) });
      await expect(pending).toHaveCount(1);
      await pending.getByRole('button', { name: 'Promover' }).click();
      const confirm = page.getByRole('alertdialog', { name: 'Promover Skill Fictícia Alfa?' });
      await expect(confirm).toBeVisible();
      await scan(page, label('promote confirmation'));
      await confirm.getByRole('button', { name: 'Promover' }).click();
      await expect(page.getByText(PROMOTE_CONFLICT)).toBeVisible();
      await scan(page, label('error alert'));
    }
  });

  test('SKL-53 the menu and the dialogs work by keyboard alone, and nothing scrolls sideways at 375 and 1280 px', async () => {
    const { page } = admin;
    await openCatalog(page);
    await narrowTo(page, 'NestJS');
    await expect(rowOf(page, 'NestJS').first()).toBeVisible();
    const trigger = page.getByRole('button', { name: 'Ações de NestJS' });

    const focusedName = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    const tabInside = async (dialog: Locator, key: 'Tab' | 'Shift+Tab') => {
      const count = await dialog.locator('button, input, [href], [tabindex]:not([tabindex="-1"])').count();
      for (let step = 0; step <= count + 1; step += 1) {
        await page.keyboard.press(key);
        expect(await dialog.evaluate((element) => element.contains(document.activeElement)), `${key} stays inside`).toBe(true);
      }
    };

    for (const choice of ['Editar', 'Apelidos'] as const) {
      // Tab until the trigger of the row, with no mouse.
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      for (let step = 0; step < 60 && (await focusedName()) !== 'Ações de NestJS'; step += 1) await page.keyboard.press('Tab');
      await expect(trigger).toBeFocused();
      await page.keyboard.press('Enter');
      const first = page.getByRole('menuitem', { name: 'Editar' });
      const second = page.getByRole('menuitem', { name: 'Apelidos' });
      await expect(first).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(second).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(first).toBeFocused();
      if (choice === 'Apelidos') {
        await page.keyboard.press('ArrowDown');
        await expect(second).toBeFocused();
      }
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: choice === 'Editar' ? 'Editar skill' : 'Apelidos de NestJS' });
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate((element) => element.contains(document.activeElement)), 'the dialog takes the focus').toBe(true);
      await tabInside(dialog, 'Tab');
      await tabInside(dialog, 'Shift+Tab');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger, 'the focus returns to the trigger').toBeFocused();
    }

    // Widths: the list and a dialog open, at both sizes.
    for (const width of [375, 1280]) {
      await openCatalog(page, 'light', width);
      expect(await overflow(page), `list at ${width}`).toBeLessThanOrEqual(0);
      await narrowTo(page, 'NestJS');
      await page.getByRole('button', { name: 'Ações de NestJS' }).click();
      await page.getByRole('menuitem', { name: 'Apelidos' }).click();
      const dialog = page.getByRole('dialog', { name: 'Apelidos de NestJS' });
      await expect(dialog).toBeVisible();
      expect(await overflow(page), `dialog at ${width}`).toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });
});
