import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { createAdminOk, fixtureEmail, fixturePassword } from '../../support/identity.js';

/**
 * The master resume of a member against the production images: the journey of the Success Criteria with no
 * save button (RES-34, RES-79), the reorder by a real drag and by keyboard, kept after a reload (RES-70 to
 * RES-73), the widths without a horizontal scroll (RES-42), axe in both themes on the states of the page, and
 * the image of the screen (`captures/PageMasterResume.running.png`, 1280 × 800, light theme). Every name,
 * company and link is fictitious.
 *
 * The image is written to the output folder of the run (`test-results`, ignored by git), so a plain
 * `pnpm test:e2e` leaves the tree clean. `CAPTURE=1 pnpm test:e2e` also copies it over the versioned
 * `.specs/features/master-resume/captures/PageMasterResume.running.png`, which is how the picture is refreshed.
 */

const API = `http://127.0.0.1:${process.env.API_PORT ?? '3333'}`;
const CAPTURES = resolve(import.meta.dirname, '../../../../.specs/features/master-resume/captures');

const adminEmail = fixtureEmail('admin');
const adminPassword = fixturePassword('admin');
const memberPassword = fixturePassword('member');
const MEMBER_NAME = 'Marina Alves';

interface Account {
  context: BrowserContext;
  page: Page;
  cookie: string;
}

// --- accounts -----------------------------------------------------------------------------------

async function signInAdmin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('E-mail').fill(adminEmail);
  await page.getByLabel('Senha', { exact: true }).fill(adminPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/admin');
}

/** Invites from the admin screen and accepts in a context of its own, as the product does (INV-07). */
async function newMember(browser: Browser, admin: Page): Promise<Account> {
  const email = fixtureEmail('member');
  await admin.goto('/admin/invitations');
  await admin.getByLabel('E-mail a convidar').fill(email);
  await admin.getByRole('button', { name: 'Convidar', exact: true }).click();
  const link = admin.getByLabel('Link do convite');
  await expect(link).toBeVisible();
  const inviteUrl = await link.inputValue();

  // The window of the capture: nothing resizes it afterwards.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto(inviteUrl);
  await page.getByLabel('Nome').fill(MEMBER_NAME);
  await page.getByLabel('Senha', { exact: true }).fill(memberPassword);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  const session = (await context.cookies()).find((cookie) => cookie.name.endsWith('am_session'));
  expect(session, 'the member holds the session cookie').toBeDefined();
  return { context, page, cookie: `${session!.name}=${session!.value}` };
}

// --- data through the api -----------------------------------------------------------------------

async function call<T>(member: Account, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { cookie: member.cookie, 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  expect(response.status, `${init.method ?? 'GET'} ${path}`).toBeLessThan(300);
  return (await response.json()) as T;
}

async function skillIdOf(member: Account, name: string): Promise<string> {
  const found = await call<{ id: string; name: string }[]>(member, `/skills?q=${encodeURIComponent(name)}`);
  const skill = found.find((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
  expect(skill, `the skill ${name} is in the catalog`).toBeDefined();
  return skill!.id;
}

interface SeedExperience {
  role: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  bullets: { text: string; skills: string[] }[];
}

/** An experience with its bullets. The api puts a new item at the top, so the caller creates the last one first. */
async function seedExperience(member: Account, item: SeedExperience): Promise<void> {
  const created = await call<{ id: string }>(member, '/resume/experiences', {
    method: 'POST',
    body: {
      role: item.role,
      company: item.company,
      startDate: item.startDate,
      ...(item.location === undefined ? {} : { location: item.location }),
      ...(item.endDate === undefined ? {} : { endDate: item.endDate }),
    },
  });
  for (const bullet of item.bullets) {
    const skillIds = await Promise.all(bullet.skills.map((name) => skillIdOf(member, name)));
    await call(member, `/resume/experiences/${created.id}/bullets`, { method: 'POST', body: { text: bullet.text, skillIds } });
  }
}

// --- the page -----------------------------------------------------------------------------------

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(
    results.violations.map((violation) => `${label}: ${violation.id} ${violation.help} ${violation.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
  ).toEqual([]);
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function openResume(page: Page, section: string, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`/resume?section=${section}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Currículo mestre' })).toBeVisible();
}

/** The card of an item, by the title its header shows. */
const cardOf = (page: Page, title: string): Locator => page.locator(`[aria-label="${title}"]`);
const bulletsOf = (page: Page, title: string): Locator => page.getByRole('group', { name: `Bullets de ${title}` });
const bulletHandle = (page: Page, start: string): Locator => page.getByRole('button', { name: new RegExp(`^Mover bullet “${start}`) });
const itemHandle = (page: Page, title: string): Locator => page.getByRole('button', { name: `Mover ${title}`, exact: true });

/** The text of each row of a sortable list, in the order the page shows them. */
const rowsOf = (page: Page, label: string): Locator => page.getByRole('list', { name: label }).locator('> li');

/** Types in a skills field, checks that the first suggestion is the skill, active, and chooses it with Enter. */
async function chooseSkill(page: Page, typed: string, name: string): Promise<void> {
  await page.keyboard.type(typed);
  const first = page.getByRole('option').first();
  await expect(first).toHaveAccessibleName(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
  await expect(first).toHaveAttribute('data-active');
  await page.keyboard.press('Enter');
}

/** "+ Bullet", the text and `Enter`; the field of skills opens, each skill is chosen in it, and "Concluir" closes it. */
async function addBullet(page: Page, title: string, text: string, skills: { typed: string; name: string }[]): Promise<void> {
  const group = bulletsOf(page, title);
  await group.getByRole('button', { name: '+ Bullet' }).click();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  const field = group.getByRole('combobox', { name: 'Skills do bullet' });
  await expect(field).toBeVisible();
  await field.click();
  for (const skill of skills) await chooseSkill(page, skill.typed, skill.name);
  await group.getByRole('button', { name: 'Concluir' }).click();
  await expect(group.getByRole('combobox', { name: 'Skills do bullet' })).toBeHidden();
  await expect(rowsOf(page, `Ordem dos bullets de ${title}`).filter({ hasText: text })).toHaveCount(1);
}

/** Fills a new experience (the fields are saved when left) and closes its fields once the header shows the title. */
async function addExperience(
  page: Page,
  item: { role: string; company: string; start: string; end?: string; current?: boolean },
): Promise<string> {
  const title = `${item.role} · ${item.company}`;
  await page.getByRole('button', { name: '+ Experiência' }).click();
  const draft = cardOf(page, 'Nova experiência');
  await draft.getByLabel('Cargo', { exact: true }).fill(item.role);
  await draft.getByLabel('Empresa', { exact: true }).fill(item.company);
  // An item is written once its role, company, start and end (or "Trabalho aqui atualmente") are valid, so the start comes last.
  if (item.current === true) await draft.getByLabel('Trabalho aqui atualmente').check();
  else await draft.getByLabel('Fim', { exact: true }).fill(item.end!);
  await draft.getByLabel('Início', { exact: true }).fill(item.start);
  // A month field keeps `Tab` for its own month and year, so the field is left with `blur`.
  await draft.getByLabel('Início', { exact: true }).blur();
  const card = cardOf(page, title);
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: `Editar ${title}` }).click();
  return title;
}

/**
 * Presses an arrow until the live region says the move happened. dnd-kit measures the places only after the
 * pick, so a press right after it can be ignored; the target is always the first or the last place, which a
 * second press leaves where it is.
 */
async function moveUntil(page: Page, key: 'ArrowUp' | 'ArrowDown', live: Locator, text: string): Promise<void> {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(live).toContainText(text, { timeout: 500 });
  }).toPass({ timeout: 10_000 });
}

/** A real pointer drag: press on the handle, cross the target in steps, release (the sensor needs moves). */
async function drag(page: Page, handle: Locator, target: Locator): Promise<void> {
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 + 6 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(start.x + ((end.x - start.x) * step) / 12, start.y + ((end.y - start.y) * step) / 12);
  }
  await page.mouse.up();
}

/** Writes the screenshot into the output folder; with `CAPTURE=1` it is also copied over the versioned image. */
async function capture(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  const file = testInfo.outputPath(name);
  await page.screenshot({ path: file });
  if (process.env.CAPTURE === '1') copyFileSync(file, `${CAPTURES}/${name}`);
}

const FULL_STACK = 'Desenvolvedora Full Stack · Empresa Exemplo';
const BACK_END = 'Desenvolvedora Back-end · Outra Empresa';
const BULLET_API = 'Construí a API de pagamentos recorrentes em NestJS e PostgreSQL';
const BULLET_VITE = 'Migrei o front-end de Create React App para Vite';
const BULLET_CONTRACT = 'Conduzi a adoção de testes de contrato entre três times';

test.describe.configure({ mode: 'serial' });

test.describe('master resume', () => {
  let admin: Account;
  let member: Account;
  let author: Account;
  let shot: Account;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(3 * 60_000);
    createAdminOk(adminEmail, 'Admin do Currículo', adminPassword);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAdmin(page);
    admin = { context, page, cookie: '' };
    member = await newMember(browser, page);
    author = await newMember(browser, page);
    // The capture has a member of its own: the journey and the reorder change the others, and its window is never resized.
    shot = await newMember(browser, page);
  });

  test.afterAll(async () => {
    for (const account of [admin, member, author, shot]) await account?.context.close();
  });

  test('journey: the profile, two experiences with six bullets tagged by skill and the education, with no save button', async () => {
    test.setTimeout(5 * 60_000);
    const page = member.page;

    // Step 02 of the home waits for the resume.
    await page.goto('/');
    const step = page.getByRole('heading', { level: 2, name: 'Preencha o currículo mestre' }).locator('xpath=ancestor::section');
    await expect(step.getByLabel('A fazer')).toBeVisible();

    await openResume(page, 'profile');
    await page.getByLabel('Nome completo').fill(MEMBER_NAME);
    await page.getByLabel('Título profissional').fill('Desenvolvedora Full Stack');
    await page.getByLabel('E-mail', { exact: true }).fill('marina.alves@example.com');
    await page.getByLabel('Resumo').fill('Desenvolvedora com foco em APIs e interfaces web.');
    await page.getByLabel('Resumo').press('Tab');
    await expect(page.getByRole('status').filter({ hasText: /^Salvo às/ })).toBeVisible();

    await openResume(page, 'experiences');
    const backEnd = await addExperience(page, { role: 'Desenvolvedora Back-end', company: 'Outra Empresa', start: '2021-01', end: '2023-02' });
    await expect(cardOf(page, backEnd)).toContainText('jan 2021 — fev 2023');
    await addBullet(page, backEnd, 'Mantive serviços em Node.js com filas e cache', [{ typed: 'Node.js', name: 'Node.js' }]);
    await addBullet(page, backEnd, 'Reduzi o tempo de resposta da busca em 35%', [{ typed: 'Postgres', name: 'PostgreSQL' }]);
    await addBullet(page, backEnd, 'Documentei o processo de publicação em produção', [{ typed: 'Docker', name: 'Docker' }]);

    const fullStack = await addExperience(page, { role: 'Desenvolvedora Full Stack', company: 'Empresa Exemplo', start: '2023-03', current: true });
    await expect(cardOf(page, fullStack)).toContainText('mar 2023 — atual');
    await addBullet(page, fullStack, BULLET_API, [
      { typed: 'NestJS', name: 'NestJS' },
      { typed: 'Postgres', name: 'PostgreSQL' },
      { typed: 'TypeScript', name: 'TypeScript' },
    ]);
    await addBullet(page, fullStack, BULLET_VITE, [{ typed: 'React', name: 'React' }]);

    // The sixth bullet carries a private skill made on the spot, with its category.
    const group = bulletsOf(page, fullStack);
    await group.getByRole('button', { name: '+ Bullet' }).click();
    await page.keyboard.type(BULLET_CONTRACT);
    await page.keyboard.press('Enter');
    await group.getByRole('combobox', { name: 'Skills do bullet' }).click();
    await page.keyboard.type('Skill Privada de Teste');
    const create = page.getByRole('option', { name: 'Criar “Skill Privada de Teste” como skill privada' });
    await expect(create).toBeVisible();
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: 'Ferramenta' }).click();
    await expect(group.getByRole('button', { name: 'Remover Skill Privada de Teste' })).toBeVisible();
    await group.getByRole('button', { name: 'Concluir' }).click();
    await expect(group.getByText('Skill Privada de Teste')).toBeVisible();
    await expect(group.getByText('NestJS', { exact: true })).toBeVisible();

    await openResume(page, 'educations');
    await page.getByRole('button', { name: '+ Formação' }).click();
    const draft = cardOf(page, 'Nova formação');
    await draft.getByLabel('Curso', { exact: true }).fill('Análise e Desenvolvimento de Sistemas');
    await draft.getByLabel('Instituição', { exact: true }).fill('Instituto Exemplo');
    await draft.getByLabel('Em andamento').check();
    await draft.getByLabel('Início', { exact: true }).fill('2022-02');
    await draft.getByLabel('Início', { exact: true }).blur();
    await expect(cardOf(page, 'Análise e Desenvolvimento de Sistemas · Instituto Exemplo')).toContainText('fev 2022 — atual');

    // What was typed is what the api holds, and nothing on any page asks to save.
    await openResume(page, 'experiences');
    await expect(cardOf(page, fullStack)).toBeVisible();
    await expect(page.getByRole('button', { name: /salvar/i })).toHaveCount(0);
    const index = page.getByRole('navigation', { name: 'Seções do currículo' });
    await expect(index.getByRole('link', { name: /^Experiência/ })).toContainText('2');
    await expect(index.getByRole('link', { name: /^Formação/ })).toContainText('1');
    await expect(page.getByText(/sem skill não entra/)).toHaveCount(0);

    // RES-79: a name and a bullet with a skill complete the step.
    await page.goto('/');
    await expect(step.getByLabel('Concluído')).toBeVisible();
  });

  test('RES-70 RES-71 dragging an item and a bullet by the handle changes the order and it stays after a reload', async () => {
    const page = author.page;
    await seedExperience(author, { role: 'Desenvolvedora Back-end', company: 'Outra Empresa', startDate: '2021-01', endDate: '2023-02', bullets: [{ text: 'Documentei o processo de publicação', skills: ['Docker'] }] });
    await seedExperience(author, {
      role: 'Desenvolvedora Full Stack',
      company: 'Empresa Exemplo',
      startDate: '2023-03',
      bullets: [
        { text: BULLET_API, skills: ['NestJS'] },
        { text: BULLET_VITE, skills: ['React'] },
        { text: BULLET_CONTRACT, skills: ['Docker'] },
      ],
    });
    await openResume(page, 'experiences');
    const bulletList = `Ordem dos bullets de ${FULL_STACK}`;
    await expect(rowsOf(page, bulletList)).toHaveCount(3);

    // RES-71: the first bullet goes below the third.
    await drag(page, bulletHandle(page, 'Construí'), bulletHandle(page, 'Conduzi'));
    await expect(rowsOf(page, bulletList)).toContainText([BULLET_VITE, BULLET_CONTRACT, BULLET_API]);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await expect(rowsOf(page, bulletList)).toContainText([BULLET_VITE, BULLET_CONTRACT, BULLET_API]);

    // RES-70: the first item goes below the second.
    const items = 'Lista de experiências';
    await expect(rowsOf(page, items)).toHaveCount(2);
    await drag(page, itemHandle(page, FULL_STACK), itemHandle(page, BACK_END));
    await expect(rowsOf(page, items)).toContainText([BACK_END, FULL_STACK]);
    await page.reload();
    await expect(rowsOf(page, items)).toContainText([BACK_END, FULL_STACK]);
  });

  test('RES-72 RES-73 the keyboard picks, moves and drops an item or a bullet and it stays after a reload; Esc changes nothing', async () => {
    const page = author.page;
    await openResume(page, 'experiences');
    const items = 'Lista de experiências';
    await expect(rowsOf(page, items)).toContainText([BACK_END, FULL_STACK]);
    const live = page.getByRole('status').filter({ hasText: /pego|movido|solto|cancelado/ });

    // RES-72, an item: the handle takes the focus, Space picks it, ArrowUp moves it, Space drops it.
    const fullStackHandle = itemHandle(page, FULL_STACK);
    await fullStackHandle.focus();
    await page.keyboard.press('Space');
    await expect(fullStackHandle).toHaveAttribute('aria-pressed', 'true');
    await expect(live).toContainText(`${FULL_STACK} pego. Posição 2 de 2.`);
    await moveUntil(page, 'ArrowUp', live, `${FULL_STACK} movido para a posição 1 de 2.`);
    await page.keyboard.press('Space');
    await expect(live).toContainText(`${FULL_STACK} solto na posição 1 de 2.`);
    await expect(rowsOf(page, items)).toContainText([FULL_STACK, BACK_END]);
    await page.reload();
    await expect(rowsOf(page, items)).toContainText([FULL_STACK, BACK_END]);

    // RES-72, a bullet: the last one goes to the top, picked and dropped with Enter this time.
    const bulletList = `Ordem dos bullets de ${FULL_STACK}`;
    await expect(rowsOf(page, bulletList)).toContainText([BULLET_VITE, BULLET_CONTRACT, BULLET_API]);
    await bulletHandle(page, 'Construí').focus();
    await page.keyboard.press('Enter');
    await expect(bulletHandle(page, 'Construí')).toHaveAttribute('aria-pressed', 'true');
    await expect(live).toContainText('pego. Posição 3 de 3.');
    await moveUntil(page, 'ArrowUp', live, 'movido para a posição 1 de 3.');
    await page.keyboard.press('Enter');
    await expect(live).toContainText('solto na posição 1 de 3.');
    await expect(rowsOf(page, bulletList)).toContainText([BULLET_API, BULLET_VITE, BULLET_CONTRACT]);
    await page.reload();
    await expect(rowsOf(page, bulletList)).toContainText([BULLET_API, BULLET_VITE, BULLET_CONTRACT]);

    // RES-73: picked, moved to the end and cancelled, the bullet is back where it was and nothing was sent.
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
    });
    await bulletHandle(page, 'Migrei').focus();
    await page.keyboard.press('Space');
    await expect(bulletHandle(page, 'Migrei')).toHaveAttribute('aria-pressed', 'true');
    await moveUntil(page, 'ArrowDown', live, 'movido para a posição 3 de 3.');
    await page.keyboard.press('Escape');
    await expect(live).toContainText('Movimento cancelado. bullet “Migrei o front-end de Create React App p…” voltou à posição 2 de 3.');
    await expect(rowsOf(page, bulletList)).toContainText([BULLET_API, BULLET_VITE, BULLET_CONTRACT]);
    expect(writes).toEqual([]);
    page.removeAllListeners('request');
    await page.reload();
    await expect(rowsOf(page, bulletList)).toContainText([BULLET_API, BULLET_VITE, BULLET_CONTRACT]);
  });

  test('RES-42 the page does not scroll sideways at 375 px and at 1280 px, with the index above the section at 375 px', async () => {
    const page = author.page;
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const section of ['profile', 'experiences', 'educations']) {
        await openResume(page, section);
        expect(await overflow(page), `${section} at ${width} px`).toBeLessThanOrEqual(0);
      }
      await openResume(page, 'experiences');
      await expect(cardOf(page, FULL_STACK)).toBeVisible();
      expect(await overflow(page), `expanded bullets at ${width} px`).toBeLessThanOrEqual(0);
      if (width === 375) {
        const index = (await page.getByRole('navigation', { name: 'Seções do currículo' }).boundingBox())!;
        const section = (await page.getByRole('heading', { level: 2, name: 'Experiência' }).boundingBox())!;
        expect(index.y + index.height, 'the index ends above the section').toBeLessThanOrEqual(section.y);
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('RES-42 axe finds no WCAG 2.x AA violation on the page, the item in edition, the skills field, the bullet menu and the delete confirmation, in both themes', async () => {
    test.setTimeout(4 * 60_000);
    const page = author.page;
    for (const scheme of ['light', 'dark'] as const) {
      const label = (state: string) => `${scheme} ${state}`;

      await openResume(page, 'experiences', scheme);
      await expect(cardOf(page, FULL_STACK)).toBeVisible();
      await scan(page, label('page'));

      // The item in edition and the confirmation of its removal.
      const card = cardOf(page, FULL_STACK);
      await card.getByRole('button', { name: `Editar ${FULL_STACK}` }).click();
      await expect(card.getByLabel('Cargo', { exact: true })).toBeVisible();
      await scan(page, label('item in edition'));
      await card.getByRole('button', { name: 'Excluir experiência' }).click();
      const confirm = page.getByRole('alertdialog', { name: 'Excluir experiência?' });
      await expect(confirm).toBeVisible();
      await scan(page, label('delete confirmation'));
      await confirm.getByRole('button', { name: 'Cancelar' }).click();
      await expect(confirm).toBeHidden();
      await card.getByRole('button', { name: `Editar ${FULL_STACK}` }).click();

      // The menu of a bullet, then its field of skills with the suggestions open.
      const group = bulletsOf(page, FULL_STACK);
      await group.getByRole('button', { name: 'Ações do bullet' }).first().click();
      await expect(page.getByRole('menuitem', { name: 'Editar skills' })).toBeVisible();
      await scan(page, label('bullet menu'));
      await page.getByRole('menuitem', { name: 'Editar skills' }).click();
      const field = group.getByRole('combobox', { name: 'Skills do bullet' });
      await expect(field).toBeVisible();
      await scan(page, label('skills field'));
      await field.click();
      await page.keyboard.type('nes');
      await expect(page.getByRole('option').first()).toBeVisible();
      await scan(page, label('skills field with suggestions'));
      await page.keyboard.press('Escape');
      await group.getByRole('button', { name: 'Concluir' }).click();
    }
  });

  test('RES-34 captures: PageMasterResume at 1280 × 800 in the light theme, on /resume?section=experiences', async () => {
    test.setTimeout(3 * 60_000);
    const testInfo = test.info();

    // A resume equivalent to the card: three experiences, two projects, one education and two languages,
    // two bullets with no skill.
    {
      await seedExperience(shot, { role: 'Estagiária de Software', company: 'Empresa Antiga', startDate: '2019-02', endDate: '2020-12', bullets: [] });
      await seedExperience(shot, {
        role: 'Desenvolvedora Back-end',
        company: 'Outra Empresa',
        location: 'Recife, PE',
        startDate: '2021-01',
        endDate: '2023-02',
        bullets: [{ text: 'Documentei o processo de publicação em produção', skills: [] }],
      });
      await seedExperience(shot, {
        role: 'Desenvolvedora Full Stack',
        company: 'Empresa Exemplo',
        location: 'Remoto',
        startDate: '2023-03',
        bullets: [
          { text: 'Construí a API de pagamentos recorrentes em NestJS e PostgreSQL, processando 40 mil cobranças por mês.', skills: ['NestJS', 'PostgreSQL', 'TypeScript'] },
          { text: 'Migrei o front-end de Create React App para Vite, reduzindo o build de 4 min para 40 s.', skills: ['React', 'Vite'] },
          { text: 'Conduzi a adoção de testes de contrato entre três times', skills: [] },
        ],
      });
      for (const name of ['Painel de Candidaturas', 'Biblioteca de Componentes']) {
        await call(shot, '/resume/projects', { method: 'POST', body: { name } });
      }
      await call(shot, '/resume/educations', {
        method: 'POST',
        body: { course: 'Análise e Desenvolvimento de Sistemas', institution: 'Instituto Exemplo', startDate: '2018-02', endDate: '2020-12' },
      });
      for (const [language, level] of [['Inglês', 'advanced'], ['Espanhol', 'basic']] as const) {
        await call(shot, '/resume/languages', { method: 'POST', body: { language, level } });
      }

      const view = shot.page;
      expect(view.viewportSize()).toEqual({ width: 1280, height: 800 });
      await openResume(view, 'experiences');
      const index = view.getByRole('navigation', { name: 'Seções do currículo' });
      for (const [name, count] of [['Experiência', '3'], ['Projetos', '2'], ['Formação', '1'], ['Idiomas', '2']] as const) {
        await expect(index.getByRole('link', { name: new RegExp(`^${name}`) })).toContainText(count);
      }
      await expect(index.getByRole('link', { name: /^Experiência/ })).toHaveAttribute('aria-current', 'page');
      await expect(view.getByText('2 bullets sem skill não entram na ordenação por relevância.')).toBeVisible();
      await expect(view.getByRole('button', { name: '+ Experiência' })).toBeVisible();
      await expect(view.getByText('Visualizar PDF')).toHaveCount(0);
      await expect(bulletsOf(view, FULL_STACK)).toBeVisible();
      await expect(bulletsOf(view, BACK_END)).toHaveCount(0);
      await expect(view.getByRole('button', { name: `Expandir ${BACK_END}` })).toBeVisible();

      // A save that worked puts "Salvo às" in the topbar, as the card shows: the last bullet gets its period.
      await bulletsOf(view, FULL_STACK).getByRole('button', { name: /^Editar texto do bullet Conduzi/ }).click();
      await view.keyboard.press('End');
      await view.keyboard.type('.');
      await view.keyboard.press('Enter');
      await expect(view.getByRole('status').filter({ hasText: /^Salvo às/ })).toBeVisible();
      await expect(view.getByText(`${BULLET_CONTRACT}.`)).toBeVisible();

      // Nothing is hovered or focused, as the card shows: the click lands on the empty part of the page.
      await view.mouse.click(900, 740);
      await expect(view.getByRole('button', { name: /^Editar texto do bullet Conduzi/ })).not.toBeFocused();
      await capture(view, 'PageMasterResume.running.png', testInfo);
    }
  });
});
