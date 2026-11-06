import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect, userEvent } from 'storybook/test';
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
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.24 0.02 260)'));
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
    await expect(getComputedStyle(main).color).toBe(resolvedColor('oklch(0.96 0.005 260)'));
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
