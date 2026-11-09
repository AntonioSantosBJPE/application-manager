import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import { psql } from '../../support/compose.js';
import { createAdminOk, fixtureEmail, fixturePassword } from '../../support/identity.js';

/**
 * The applications of a member against the production images: the journey of the Success Criteria done
 * with the keyboard (APP-42, APP-57, APP-66), the widths without a horizontal scroll (APP-56, APP-79), axe
 * in both themes on every state of the list and of the detail, and the three images of the screens
 * (`captures/*.running.png`, 1280 × 800, light theme). Every name, company and link is fictitious.
 *
 * The images are written to the output folder of the run (`test-results`, ignored by git), so a plain
 * `pnpm test:e2e` leaves the tree clean. `CAPTURE=1 pnpm test:e2e` also copies them over the versioned
 * `.specs/features/application/captures/*.running.png`, which is how the pictures are refreshed.
 */

const API = `http://127.0.0.1:${process.env.API_PORT ?? '3333'}`;
const CAPTURES = resolve(import.meta.dirname, '../../../../.specs/features/application/captures');

const adminEmail = fixtureEmail('admin');
const adminPassword = fixturePassword('admin');
const memberPassword = fixturePassword('member');
const MEMBER_NAME = 'Marina Alves';

interface Account {
  context: BrowserContext;
  page: Page;
  cookie: string;
}

type Status = 'saved' | 'applied' | 'interviewing' | 'offer' | 'accepted' | 'rejected' | 'withdrawn' | 'ghosted';

interface Seed {
  company: string;
  title: string;
  status: Status;
  level: 'intern' | 'junior' | 'mid' | 'senior' | 'specialist';
  workModel: 'remote' | 'hybrid' | 'onsite';
  required: string[];
  nice?: string[];
  /** Moves the application to this status right after the registration, so its timeline reads "Status Salva → Enviada". */
  then?: Status;
  /** Days since the last activity, set in the database: the api has no clock to move. */
  idleDays: number;
  url?: string;
  location?: string;
  description?: string;
}

/** The postings of the PageApplications card, with fictitious companies. */
const ACTIVE: Seed[] = [
  { company: 'Tarsila Bank', title: 'Engenheira de Software', status: 'offer', level: 'senior', workModel: 'remote', required: ['TypeScript', 'Kafka'], idleDays: 2 },
  { company: 'Acme Pagamentos', title: 'Desenvolvedor Backend Pleno', status: 'interviewing', level: 'mid', workModel: 'remote', required: ['NestJS', 'PostgreSQL'], idleDays: 1 },
  { company: 'Nimbus Saúde', title: 'Full Stack Sênior', status: 'interviewing', level: 'senior', workModel: 'hybrid', required: ['React', 'Node.js'], idleDays: 3 },
  { company: 'Orbe Logística', title: 'Desenvolvedor Node.js', status: 'applied', level: 'mid', workModel: 'remote', required: ['Node.js', 'Docker'], idleDays: 6 },
  {
    company: 'Vento Seguros',
    title: 'Desenvolvedor Backend Pleno',
    status: 'saved',
    then: 'applied',
    level: 'mid',
    workModel: 'onsite',
    required: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'Microservices', 'AWS'],
    nice: ['Kubernetes', 'Inglês'],
    idleDays: 23,
    url: 'https://vagas.exemplo.com/vento-seguros/backend-pleno',
    location: 'Recife, PE',
    description:
      'Buscamos pessoa desenvolvedora backend para atuar no time de sinistros, evoluindo serviços em Java e Spring Boot com mensageria em Kafka. Você vai trabalhar com PostgreSQL, observabilidade e práticas de entrega contínua. O time é pequeno, o ritmo é constante e a rotina inclui revisão de código em par, plantão leve e acompanhamento de métricas de produção junto de quem opera os serviços.',
  },
  { company: 'Lumen Edu', title: 'Full Stack Pleno', status: 'applied', level: 'mid', workModel: 'remote', required: ['React', 'Next.js'], idleDays: 9 },
  { company: 'Quadra Imóveis', title: 'Frontend Sênior', status: 'saved', level: 'senior', workModel: 'hybrid', required: ['React', 'Testing Library'], idleDays: 1 },
  { company: 'Ferro & Vidro', title: 'Desenvolvedor Full Stack', status: 'saved', level: 'mid', workModel: 'remote', required: ['Vue.js', 'Node.js'], idleDays: 4 },
];

const CLOSED: Seed[] = [
  { company: 'Estrela Digital', title: 'Desenvolvedor Backend Júnior', status: 'rejected', level: 'junior', workModel: 'remote', required: ['Java'], idleDays: 12 },
  { company: 'Praça Verde', title: 'Engenheiro de Plataforma', status: 'withdrawn', level: 'senior', workModel: 'hybrid', required: ['Docker', 'Kubernetes'], idleDays: 15 },
];

// --- accounts -----------------------------------------------------------------------------------

async function signIn(page: Page, area: 'member' | 'admin', email: string, password: string): Promise<void> {
  await page.goto(area === 'admin' ? '/admin/login' : '/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(area === 'admin' ? '**/admin' : (url) => !url.pathname.startsWith('/login'));
}

/** Invites from the admin screen and accepts in a context of its own, as the product does (INV-07). */
async function newMember(browser: Browser, admin: Page, name: string): Promise<Account> {
  const email = fixtureEmail('member');
  await admin.goto('/admin/invitations');
  await admin.getByLabel('E-mail a convidar').fill(email);
  await admin.getByRole('button', { name: 'Convidar', exact: true }).click();
  const link = admin.getByLabel('Link do convite');
  await expect(link).toBeVisible();
  const inviteUrl = await link.inputValue();

  // The window of the captures: nothing resizes it afterwards.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
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

// --- data through the api and the database ------------------------------------------------------

const quoted = (value: string) => `'${value.replace(/'/g, "''")}'`;

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

/** Registers a posting through the api and moves its dates in the database, so "há N d" and the ghost rule read as the card shows. */
async function seed(member: Account, item: Seed): Promise<string> {
  const required = await Promise.all(item.required.map((name) => skillIdOf(member, name)));
  const nice = await Promise.all((item.nice ?? []).map((name) => skillIdOf(member, name)));
  const created = await call<{ id: string }>(member, '/applications', {
    method: 'POST',
    body: {
      jobPosting: {
        company: item.company,
        title: item.title,
        level: item.level,
        workModel: item.workModel,
        ...(item.url === undefined ? {} : { url: item.url }),
        ...(item.location === undefined ? {} : { location: item.location }),
        ...(item.description === undefined ? {} : { description: item.description }),
      },
      skills: [
        ...required.map((skillId) => ({ skillId, requirement: 'required' })),
        ...nice.map((skillId) => ({ skillId, requirement: 'nice_to_have' })),
      ],
      ...(item.status === 'saved' ? {} : { status: item.status }),
    },
  });
  const id = created.id;
  if (item.then !== undefined) await call(member, `/applications/${id}/status`, { method: 'POST', body: { status: item.then } });
  psql(
    `update applications.applications set created_at = now() - interval '${item.idleDays + 5} days',
       last_activity_at = now() - interval '${item.idleDays} days' where id = ${quoted(id)}`,
  );
  psql(
    `update applications.job_postings set created_at = now() - interval '${item.idleDays + 5} days'
     where id = (select job_posting_id from applications.applications where id = ${quoted(id)})`,
  );
  psql(
    `update applications.application_events set occurred_at = now() - interval '${item.idleDays} days',
       created_at = now() - interval '${item.idleDays} days' where application_id = ${quoted(id)}`,
  );
  return id;
}

/** The timeline of the Vento Seguros card: a stage and a note, both older than the last activity. */
async function addVentoTimeline(member: Account, id: string): Promise<void> {
  await call(member, `/applications/${id}/events`, {
    method: 'POST',
    body: { kind: 'stage', stage: 'hr', occurredAt: new Date(Date.now() - 26 * 86_400_000).toISOString() },
  });
  await call(member, `/applications/${id}/events`, {
    method: 'POST',
    body: { kind: 'note', note: 'Recrutadora disse que retorna em duas semanas', occurredAt: new Date(Date.now() - 24 * 86_400_000).toISOString() },
  });
  // The api moves the last activity to now; the card says 23 days without activity. The registration and
  // the move to "Enviada" come before the stage and the note.
  psql(`update applications.applications set last_activity_at = now() - interval '23 days', created_at = now() - interval '30 days' where id = ${quoted(id)}`);
  psql(
    `update applications.job_postings set created_at = now() - interval '30 days'
     where id = (select job_posting_id from applications.applications where id = ${quoted(id)})`,
  );
  psql(
    `update applications.application_events set occurred_at = now() - interval '28 days', created_at = now() - interval '28 days'
     where application_id = ${quoted(id)} and kind = 'status_changed'`,
  );
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

const rowOf = (page: Page, company: string): Locator => page.locator('[data-application-id]').filter({ hasText: company });

async function openList(page: Page, scheme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto('/applications');
  await expect(page.getByRole('heading', { level: 1, name: 'Candidaturas' })).toBeVisible();
}

/** Types in a skills field, checks that the first suggestion is the skill, active, and chooses it with Enter. */
async function chooseSkill(page: Page, typed: string, name: string): Promise<void> {
  await page.keyboard.type(typed);
  const first = page.getByRole('option').first();
  await expect(first).toHaveAccessibleName(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `));
  await expect(first).toHaveAttribute('data-active');
  await page.keyboard.press('Enter');
}

/**
 * Reaches a control the way a keyboard does: `Tab` (or `Shift+Tab`) from where the focus is until the
 * control has it, and asserts `toBeFocused()` on it, so a control the keyboard cannot reach fails here.
 */
async function tabTo(page: Page, target: Locator, direction: 'Tab' | 'Shift+Tab' = 'Tab', limit = 60): Promise<void> {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press(direction);
    if (await target.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(target).toBeFocused();
}

/** Writes the screenshot of a capture into the output folder; with `CAPTURE=1` it is also copied over the versioned image. */
async function capture(page: Page, name: string, testInfo: TestInfo): Promise<void> {
  const file = testInfo.outputPath(name);
  await page.screenshot({ path: file });
  if (process.env.CAPTURE === '1') copyFileSync(file, `${CAPTURES}/${name}`);
}

test.describe.configure({ mode: 'serial' });

test.describe('applications', () => {
  let admin: Account;
  let member: Account;
  let ventoId = '';

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(3 * 60_000);
    createAdminOk(adminEmail, 'Admin das Candidaturas', adminPassword);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, 'admin', adminEmail, adminPassword);
    admin = { context, page, cookie: '' };
    member = await newMember(browser, page, MEMBER_NAME);
  });

  test.afterAll(async () => {
    for (const account of [admin, member]) await account?.context.close();
  });

  test('APP-42 axe finds no WCAG 2.x AA violation on the empty list, in both themes', async () => {
    for (const scheme of ['light', 'dark'] as const) {
      await openList(member.page, scheme);
      await expect(member.page.getByText('Nenhuma candidatura ainda.')).toBeVisible();
      await scan(member.page, `${scheme} empty list`);
    }
  });

  test('journey: register with four skills, change the status, open the detail, add a stage and a note, delete, all by keyboard', async () => {
    const page = member.page;
    await openList(page);

    // `C` outside a field opens the dialog; the first field has the focus.
    await page.locator('body').press('c');
    const dialog = page.getByRole('dialog', { name: 'Nova candidatura' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Empresa', { exact: true })).toBeFocused();
    await page.keyboard.type('Empresa Fictícia Alfa');
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('Título')).toBeFocused();
    await page.keyboard.type('Vaga de Teste Pleno');
    await page.keyboard.press('Tab'); // link, left empty
    await expect(dialog.getByLabel(/^Link da vaga/)).toBeFocused();
    await page.keyboard.press('Tab'); // the level group
    await expect(dialog.getByRole('radiogroup', { name: 'Nível' }).getByRole('radio').first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('radio', { name: 'Pleno' })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Pleno' })).toBeFocused();
    await page.keyboard.press('Tab'); // the work model group
    await expect(dialog.getByRole('radiogroup', { name: 'Modelo' }).getByRole('radio').first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('radio', { name: 'Híbrido' })).toBeChecked();

    // Required: one found by its alias, one by its name, one private skill made on the spot with its category.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('combobox', { name: 'Skills obrigatórias' })).toBeFocused();
    await chooseSkill(page, 'Postgres', 'PostgreSQL');
    await chooseSkill(page, 'Node.js', 'Node.js');
    await page.keyboard.type('Skill Privada de Teste');
    const create = page.getByRole('option', { name: 'Criar “Skill Privada de Teste” como skill privada' });
    await expect(create).toBeVisible();
    await expect(create).toHaveAttribute('data-active');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('option', { name: 'Ferramenta' })).toBeVisible();
    for (let step = 0; step < 5; step += 1) await page.keyboard.press('ArrowDown'); // the fifth category: Ferramenta
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Remover Skill Privada de Teste' })).toBeVisible();

    // Nice to have: one more. The "×" of the three tags come first, then the next field.
    await tabTo(page, dialog.getByRole('combobox', { name: 'Skills desejáveis' }));
    await chooseSkill(page, 'Docker', 'Docker');
    await expect(dialog.getByRole('button', { name: 'Remover Docker' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Remover / })).toHaveCount(4);

    await page.keyboard.press('Control+Enter');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('list', { name: /Salvas/ }).getByText('Empresa Fictícia Alfa')).toBeVisible();

    // Change the status from the row menu.
    await tabTo(page, page.getByRole('button', { name: 'Ações de Empresa Fictícia Alfa' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Status' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemradio', { name: 'Enviada' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('list', { name: /Enviadas/ }).getByText('Empresa Fictícia Alfa')).toBeVisible();
    await expect(page.getByRole('list', { name: /Salvas/ })).toHaveCount(0);

    // Open the detail with Enter on the company link.
    // The row moved to another group, so the keyboard walks from the top again.
    await tabTo(page, page.getByRole('link', { name: 'Empresa Fictícia Alfa' }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Vaga de Teste Pleno' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Obrigatórias' }).getByText('Skill Privada de Teste')).toBeVisible();

    // A stage: the chips choose with the arrows, the date is today, the note is optional.
    await tabTo(page, page.getByRole('button', { name: 'Etapa', exact: true }));
    await page.keyboard.press('Enter');
    const stage = page.getByRole('dialog', { name: 'Nova etapa' });
    await expect(stage).toBeVisible();
    await expect(stage.getByRole('radio', { name: 'Triagem' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(stage.getByRole('radio', { name: 'RH' })).toBeChecked();
    // The date field keeps today; its day, month and year are stops before the note.
    await tabTo(page, stage.getByLabel('Nota'));
    await page.keyboard.type('Conversa de teste com o time de pessoas');
    await page.keyboard.press('Tab');
    await expect(stage.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(stage.getByRole('button', { name: 'Registrar etapa' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(stage).toBeHidden();
    const timeline = page.getByRole('list', { name: 'Linha do tempo' });
    await expect(timeline.getByText('RH')).toBeVisible();

    // A note.
    await tabTo(page, page.getByRole('textbox', { name: 'Adicionar nota…' }));
    await page.keyboard.type('Nota de teste da jornada');
    await page.keyboard.press('Control+Enter');
    await expect(timeline.getByText('Nota de teste da jornada')).toBeVisible();

    // Delete with the confirmation.
    await tabTo(page, page.getByRole('button', { name: 'Excluir candidatura' }));
    await page.keyboard.press('Enter');
    const confirm = page.getByRole('alertdialog', { name: 'Excluir candidatura?' });
    await expect(confirm).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(confirm.getByRole('button', { name: 'Excluir', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/applications$/);
    await expect(page.getByText('Nenhuma candidatura ainda.')).toBeVisible();
  });

  test('captures: PageApplications, PageNewApplication and PageApplicationDetail at 1280 × 800 in the light theme', async () => {
    test.setTimeout(3 * 60_000);
    const testInfo = test.info();
    const page = member.page;
    for (const item of [...ACTIVE, ...CLOSED]) {
      const id = await seed(member, item);
      if (item.company === 'Vento Seguros') ventoId = id;
    }
    await addVentoTimeline(member, ventoId);
    expect(page.viewportSize()).toEqual({ width: 1280, height: 800 });

    // The list, the "Ativas" tab.
    await openList(page);
    await expect(page.getByRole('button', { name: /^Ativas/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(rowOf(page, 'Vento Seguros').getByText('sem retorno?')).toBeVisible();
    for (const group of ['Propostas', 'Em entrevistas', 'Enviadas', 'Salvas']) {
      await expect(page.getByRole('list', { name: new RegExp(group) })).toBeVisible();
    }
    await page.mouse.move(640, 700);
    await capture(page, 'PageApplications.running.png', testInfo);

    // The dialog over the list: three required skills, one nice to have, the menu open with a skill and the private option.
    await page.locator('body').press('c');
    const dialog = page.getByRole('dialog', { name: 'Nova candidatura' });
    await expect(dialog).toBeVisible();
    await page.keyboard.type('Rio Claro Tech');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Desenvolvedora Full Stack Pleno');
    await dialog.getByRole('radio', { name: 'Pleno' }).click();
    await dialog.getByRole('radio', { name: 'Remoto' }).click();
    await tabTo(page, dialog.getByRole('combobox', { name: 'Skills obrigatórias' }));
    await chooseSkill(page, 'React', 'React');
    await chooseSkill(page, 'Node.js', 'Node.js');
    await chooseSkill(page, 'PostgreSQL', 'PostgreSQL');
    await tabTo(page, dialog.getByRole('combobox', { name: 'Skills desejáveis' }));
    await chooseSkill(page, 'Docker', 'Docker');
    await tabTo(page, dialog.getByRole('combobox', { name: 'Skills obrigatórias' }), 'Shift+Tab');
    await page.keyboard.type('nes');
    await expect(page.getByRole('option', { name: /NestJS/ })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Criar “nes” como skill privada' })).toBeVisible();
    await page.mouse.move(1000, 700);
    await capture(page, 'PageNewApplication.running.png', testInfo);
    await page.keyboard.press('Escape'); // the menu
    await page.keyboard.press('Escape'); // the dialog
    await expect(dialog).toBeHidden();

    // The detail of Vento Seguros with the alert.
    await page.goto(`/applications/${ventoId}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Desenvolvedor Backend Pleno' })).toBeVisible();
    await expect(page.getByText('23 dias sem atividade desde o envio. Marcar como sem retorno?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar sem retorno' })).toBeVisible();
    await page.mouse.move(640, 790);
    await capture(page, 'PageApplicationDetail.running.png', testInfo);
  });

  test('APP-56 and APP-79 the list and the detail do not scroll sideways at 375 px and at 1280 px', async () => {
    const page = member.page;
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await openList(page);
      await expect(rowOf(page, 'Vento Seguros')).toBeVisible();
      expect(await overflow(page), `the list at ${width} px`).toBeLessThanOrEqual(0);
      await page.goto(`/applications/${ventoId}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Desenvolvedor Backend Pleno' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Excluir candidatura' })).toBeVisible();
      expect(await overflow(page), `the detail at ${width} px`).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('APP-56 a row keeps only the status, the company, the title and the activity at 375 px, and all its cells at 1280 px', async () => {
    const page = member.page;
    const cells = (row: Locator) => ({
      shown: [
        row.getByRole('img', { name: 'Enviada' }),
        row.getByRole('link', { name: 'Vento Seguros' }),
        row.getByText('Desenvolvedor Backend Pleno', { exact: true }),
        row.getByText('há 23 d', { exact: true }),
      ],
      cut: [
        row.getByText('Java', { exact: true }),
        row.getByText('Pleno', { exact: true }),
        row.getByText('Presencial', { exact: true }),
        row.getByText('sem retorno?'),
        row.getByRole('button', { name: 'Ações de Vento Seguros' }),
      ],
    });

    await page.setViewportSize({ width: 375, height: 800 });
    await openList(page);
    const narrow = cells(rowOf(page, 'Vento Seguros'));
    for (const cell of narrow.shown) await expect(cell).toBeVisible();
    for (const cell of narrow.cut) await expect(cell).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await openList(page);
    const wide = cells(rowOf(page, 'Vento Seguros'));
    for (const cell of [...wide.shown, ...wide.cut]) await expect(cell).toBeVisible();
  });

  test('APP-79 the properties sit beside the content at 1280 px and below it at 375 px, and their values share one column', async () => {
    const page = member.page;
    const boxes = async () => {
      const sidebar = page.getByRole('complementary', { name: 'Propriedades' });
      const content = sidebar.locator('xpath=preceding-sibling::*[1]');
      const [side, main] = [await sidebar.boundingBox(), await content.boundingBox()];
      expect(side, 'the properties sidebar has a box').not.toBeNull();
      expect(main, 'the content has a box').not.toBeNull();
      return { side: side!, main: main! };
    };

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/applications/${ventoId}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Desenvolvedor Backend Pleno' })).toBeVisible();
    const narrow = await boxes();
    expect(narrow.side.y, 'the sidebar starts where the content ends').toBeGreaterThanOrEqual(narrow.main.y + narrow.main.height - 1);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/applications/${ventoId}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Desenvolvedor Backend Pleno' })).toBeVisible();
    const wide = await boxes();
    expect(wide.side.x, 'the sidebar starts where the content ends').toBeGreaterThanOrEqual(wide.main.x + wide.main.width - 1);

    // Status, level, model, local and link are drawn from the same left edge as the dates.
    const sidebar = page.getByRole('complementary', { name: 'Propriedades' });
    const lefts = await sidebar.getByRole('definition').evaluateAll((values) =>
      values.map((value) => {
        const first = value.querySelector('button, span');
        return Math.round((first ?? value).getBoundingClientRect().left);
      }),
    );
    expect(new Set(lefts), `the left edges ${lefts.join(', ')}`).toHaveProperty('size', 1);
  });

  test('APP-42 axe finds no WCAG 2.x AA violation in the states of the list and of the detail, in both themes', async () => {
    test.setTimeout(4 * 60_000);
    const page = member.page;
    for (const scheme of ['light', 'dark'] as const) {
      const label = (state: string) => `${scheme} ${state}`;

      await openList(page, scheme);
      await expect(rowOf(page, 'Orbe Logística')).toBeVisible();
      await scan(page, label('list'));

      // The row menu, with the status submenu open.
      await page.getByRole('button', { name: 'Ações de Orbe Logística' }).click();
      await expect(page.getByRole('menuitem', { name: 'Status' })).toBeVisible();
      await scan(page, label('row menu'));
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Status' })).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('menuitemradio', { name: 'Enviada' })).toBeVisible();
      await scan(page, label('row menu with the status submenu'));
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menuitem', { name: 'Status' })).toBeHidden();

      // The dialog with the suggestions open.
      await page.locator('body').press('c');
      const dialog = page.getByRole('dialog', { name: 'Nova candidatura' });
      await expect(dialog).toBeVisible();
      await scan(page, label('new application dialog'));
      await tabTo(page, dialog.getByRole('combobox', { name: 'Skills obrigatórias' }));
      await page.keyboard.type('nes');
      await expect(page.getByRole('option', { name: /NestJS/ })).toBeVisible();
      await scan(page, label('new application dialog with suggestions'));
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      // The detail with the "sem retorno" alert.
      await page.goto(`/applications/${ventoId}`);
      await expect(page.getByText('23 dias sem atividade desde o envio. Marcar como sem retorno?')).toBeVisible();
      await scan(page, label('detail with the alert'));

      // The stage dialog.
      await page.getByRole('button', { name: 'Etapa', exact: true }).click();
      const stage = page.getByRole('dialog', { name: 'Nova etapa' });
      await expect(stage).toBeVisible();
      await scan(page, label('stage dialog'));
      await page.keyboard.press('Escape');
      await expect(stage).toBeHidden();

      // The delete confirmation.
      await page.getByRole('button', { name: 'Excluir candidatura' }).click();
      const confirm = page.getByRole('alertdialog', { name: 'Excluir candidatura?' });
      await expect(confirm).toBeVisible();
      await scan(page, label('delete confirmation'));
      await confirm.getByRole('button', { name: 'Cancelar' }).click();
      await expect(confirm).toBeHidden();

      // The detail without the alert: another posting.
      await openList(page, scheme);
      await rowOf(page, 'Acme Pagamentos').getByRole('link', { name: 'Acme Pagamentos' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Desenvolvedor Backend Pleno' })).toBeVisible();
      await scan(page, label('detail'));
    }
  });
});
