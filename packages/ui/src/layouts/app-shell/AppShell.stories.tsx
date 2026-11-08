import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { Activity, LayoutDashboard, LogOut, Mail } from 'lucide-react';
import { expect, userEvent } from 'storybook/test';
import { Button } from '../../components/button';
import { Icon } from '../../icons/icon';
import { expectContrast, focusRing, settle } from '../../testing/contrast';
import { DashboardPage } from '../dashboard-page';
import { ListPage } from '../list-page';
import { AppShell } from './app-shell';

const meta = {
  title: 'Layouts/AppShell',
  component: AppShell.Root,
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <AppShell.Root {...args}>
      <AppShell.Sidebar aria-label="Navegação principal">
        <AppShell.NavItem href="/" current onClick={(event) => event.preventDefault()}>
          Início
        </AppShell.NavItem>
        <AppShell.NavItem href="/admin/invitations" onClick={(event) => event.preventDefault()}>
          Convites
        </AppShell.NavItem>
        <AppShell.NavItem href="/status" onClick={(event) => event.preventDefault()}>
          Status
        </AppShell.NavItem>
      </AppShell.Sidebar>
      <AppShell.Main>
        <h1 className="text-lg font-medium">Início</h1>
        <p className="text-xs text-text-muted">Bem-vinda de volta.</p>
      </AppShell.Main>
    </AppShell.Root>
  ),
} satisfies Meta<typeof AppShell.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('navigation')).toBeVisible();
    await userEvent.click(canvas.getByRole('link', { name: 'Convites' }));
    await expect(canvas.getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};

/**
 * At 375 px the navigation takes the top and the content goes below it; at 1280 px the two
 * sit side by side. Both are read from the layout, not from the class names.
 */
export const Empilhado: Story = {
  name: '375 px',
  play: async ({ canvas }) => {
    await page.viewport(375, 700);
    const navigation = canvas.getByRole('navigation');
    const main = canvas.getByRole('main');
    const navBox = navigation.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();

    await expect(navBox.bottom).toBeLessThanOrEqual(mainBox.top);
    await expect(navBox.width).toBeLessThanOrEqual(375);
    await expect(mainBox.right).toBeLessThanOrEqual(375);

    await page.viewport(1280, 700);
    const wideNav = navigation.getBoundingClientRect();
    const wideMain = main.getBoundingClientRect();

    await expect(wideNav.right).toBeLessThanOrEqual(wideMain.left);
    await expect(wideNav.top).toBe(wideMain.top);
  },
};

/** Light theme through the toolbar global; asserts the light text token reaches the shell. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const main = canvas.getByRole('main');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-text in tokens.css.
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.21 0.012 250)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark text token reaches the shell. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const main = canvas.getByRole('main');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-text in tokens.css.
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.955 0.003 250)'));
  },
};

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/**
 * `AppShell.Main asChild` hands the content area to the archetype, so the page keeps exactly one
 * `main` landmark: the archetype's. This is how a real screen composes the shell with a page.
 */
function ShellWithList() {
  return (
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação principal">
        <AppShell.NavItem href="/" onClick={(event) => event.preventDefault()}>
          Início
        </AppShell.NavItem>
        <AppShell.NavItem href="/admin/invitations" current onClick={(event) => event.preventDefault()}>
          Convites
        </AppShell.NavItem>
      </AppShell.Sidebar>
      <AppShell.Main asChild>
        <ListPage.Root>
          <ListPage.Header>
            <h1 className="text-lg font-medium">Convites pendentes</h1>
          </ListPage.Header>
          <ListPage.Filters aria-label="Filtrar convites">
            <label className="text-xs text-text-muted" htmlFor="shell-list-filter">
              E-mail
            </label>
            <input
              id="shell-list-filter"
              className="h-8 rounded-sm border border-border bg-surface px-2 text-xs text-text"
            />
          </ListPage.Filters>
          <ListPage.Content>
            <p className="border-b border-border py-2 text-xs">ana@example.com</p>
            <p className="border-b border-border py-2 text-xs">bruno@example.com</p>
          </ListPage.Content>
        </ListPage.Root>
      </AppShell.Main>
    </AppShell.Root>
  );
}

/** The same handoff with the insight archetype. */
function ShellWithDashboard() {
  return (
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação principal">
        <AppShell.NavItem href="/" onClick={(event) => event.preventDefault()}>
          Início
        </AppShell.NavItem>
        <AppShell.NavItem href="/admin" current onClick={(event) => event.preventDefault()}>
          Administração
        </AppShell.NavItem>
      </AppShell.Sidebar>
      <AppShell.Main asChild>
        <DashboardPage.Root>
          <AppShell.Topbar>
            <b className="text-body font-medium">Status do sistema</b>
          </AppShell.Topbar>
          <DashboardPage.Content>
            <DashboardPage.Header>
              <h1 className="text-lg font-medium">Status do sistema</h1>
            </DashboardPage.Header>
            <DashboardPage.Grid>
              <div className="rounded-md border border-border bg-surface-raised p-4 text-xs">
                API operacional
              </div>
              <div className="rounded-md border border-border bg-surface-raised p-4 text-xs">
                Banco de dados operacional
              </div>
            </DashboardPage.Grid>
          </DashboardPage.Content>
        </DashboardPage.Root>
      </AppShell.Main>
    </AppShell.Root>
  );
}

/** Asserts the archetype is the only `main`, so the shell added no second landmark. */
async function expectSingleMain(
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  archetype: string,
): Promise<void> {
  const mains = canvas.getAllByRole('main');
  await expect(mains).toHaveLength(1);
  await expect(mains[0]).toHaveAttribute('data-archetype', archetype);
}

/** The shell around a list page in the light theme: one main landmark, the archetype's. */
export const ComListaTemaClaro: Story = {
  name: 'Com ListPage, tema claro',
  render: () => <ShellWithList />,
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await expectSingleMain(canvas, 'list');
  },
};

/** The shell around a list page in the dark theme. */
export const ComListaTemaEscuro: Story = {
  name: 'Com ListPage, tema escuro',
  render: () => <ShellWithList />,
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await expectSingleMain(canvas, 'list');
  },
};

/** The shell around a dashboard in the light theme: one main landmark, the archetype's. */
export const ComDashboardTemaClaro: Story = {
  name: 'Com DashboardPage, tema claro',
  render: () => <ShellWithDashboard />,
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await expectSingleMain(canvas, 'dashboard');
  },
};

/** The shell around a dashboard in the dark theme. */
export const ComDashboardTemaEscuro: Story = {
  name: 'Com DashboardPage, tema escuro',
  render: () => <ShellWithDashboard />,
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await expectSingleMain(canvas, 'dashboard');
  },
};

/** A CSS color as the browser resolves it, to compare with a computed style. */

/** Tabs to the first navigation entry and asserts its focus ring stands out from the page (UI-24). */
const focusContrast: Story['play'] = async ({ canvas }) => {
  const item = canvas.getByRole('link', { name: 'Início' });
  // Let the theme switch finish first, so only the focus itself can move a color from here on.
  await settle(item);
  await userEvent.tab();
  await expect(item).toHaveFocus();

  const ring = focusRing(item);
  await expect(ring.drawn, 'the navigation entry draws an outline').toBe(true);
  await expect(ring.ratio, 'focus ring against the page').toBeGreaterThanOrEqual(3);
  await expect(ring.isFocusToken, 'the ring is the --color-focus token').toBe(true);
  await expect(ring.isTextColor, 'the ring is not the text color').toBe(false);
};

/** Keyboard focus of a navigation entry in the light theme: a ring of at least 3:1 (UI-24). */
export const FocoTemaClaro: Story = {
  name: 'Foco por teclado, tema claro',
  globals: { theme: 'light' },
  play: focusContrast,
};

/** Keyboard focus of a navigation entry in the dark theme: a ring of at least 3:1 (UI-24). */
export const FocoTemaEscuro: Story = {
  name: 'Foco por teclado, tema escuro',
  globals: { theme: 'dark' },
  play: focusContrast,
};

const signOut = (
  <Button intent="ghost" size="sm" aria-label="Sair">
    <Icon icon={LogOut} size="sm" />
  </Button>
);

/** The member shell: wordmark, the one destination that exists, the person and the topbar. */
function MemberShell() {
  return (
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação principal">
        <AppShell.Brand />
        <AppShell.NavItem href="/" current icon={LayoutDashboard} onClick={(e) => e.preventDefault()}>
          Início
        </AppShell.NavItem>
        <AppShell.User initials="MA" name="Marina Alves">
          {signOut}
        </AppShell.User>
      </AppShell.Sidebar>
      <AppShell.Main>
        <AppShell.Topbar>
          <b className="text-body font-medium">Início</b>
        </AppShell.Topbar>
        <p className="px-6 py-4 text-text-muted">Conteúdo da página.</p>
      </AppShell.Main>
    </AppShell.Root>
  );
}

/** The admin shell: wordmark with the area tag, a section, counts, the person and page actions. */
function AdminShell() {
  return (
    <AppShell.Root>
      <AppShell.Sidebar aria-label="Navegação da administração">
        <AppShell.Brand tag="admin" />
        <AppShell.Section title="Administração">
          <AppShell.NavItem href="/admin" current icon={LayoutDashboard} onClick={(e) => e.preventDefault()}>
            Painel
          </AppShell.NavItem>
          <AppShell.NavItem href="/admin/invitations" icon={Mail} count="3" onClick={(e) => e.preventDefault()}>
            Convites
          </AppShell.NavItem>
          <AppShell.NavItem href="/status" icon={Activity} onClick={(e) => e.preventDefault()}>
            Status do sistema
          </AppShell.NavItem>
        </AppShell.Section>
        <AppShell.User initials="AD" name="Admin">
          {signOut}
        </AppShell.User>
      </AppShell.Sidebar>
      <AppShell.Main>
        <AppShell.Topbar>
          <b className="text-body font-medium">Painel</b>
          <Button size="sm">Convidar pessoa</Button>
        </AppShell.Topbar>
        <p className="px-6 py-4 text-text-muted">Conteúdo da página.</p>
      </AppShell.Main>
    </AppShell.Root>
  );
}

export const Membro: Story = {
  name: 'Member',
  parameters: { layout: 'fullscreen' },
  render: () => <MemberShell />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('button', { name: 'Sair' })).toBeVisible();
  },
};

export const Administrador: Story = {
  name: 'Admin',
  parameters: { layout: 'fullscreen' },
  render: () => <AdminShell />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('admin')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
  },
};

/** At 360 px the sidebar is a bar on top and the page does not scroll sideways (PRU-04 AC05). */
export const Estreito: Story = {
  name: 'PRU-04 AC05 Estreito, 360 px',
  parameters: { layout: 'fullscreen' },
  render: () => <AdminShell />,
  play: async ({ canvas }) => {
    await page.viewport(360, 800);
    const navigation = canvas.getByRole('navigation');
    await expect(navigation.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      canvas.getByRole('main').getBoundingClientRect().top,
    );
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    await expect(canvas.getByRole('button', { name: 'Sair' }).getBoundingClientRect().right).toBeLessThanOrEqual(360);
    await page.viewport(1280, 800);
  },
};

/** Text of the shell at 4.5:1 over what is painted behind it: sidebar, current item, topbar. */
const contrast: Story['play'] = async ({ canvas }) => {
  await page.viewport(1280, 800);
  for (const item of [canvas.getByRole('link', { name: /Painel/ }), canvas.getByRole('link', { name: /Convites/ }), canvas.getByRole('link', { name: 'Status do sistema' })]) {
    await expectContrast(item, 4.5);
  }
  await expectContrast(canvas.getByText('Admin'), 4.5);
  await expectContrast(canvas.getByText('3'), 4.5);
  await expectContrast(canvas.getByText('admin'), 4.5);
  await expectContrast(canvas.getByText('Administração'), 4.5);
  await expectContrast(canvas.getByText('Painel', { selector: 'b' }), 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  parameters: { layout: 'fullscreen' },
  globals: { theme: 'light' },
  render: () => <AdminShell />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  parameters: { layout: 'fullscreen' },
  globals: { theme: 'dark' },
  render: () => <AdminShell />,
  play: contrast,
};
