import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect, userEvent } from 'storybook/test';
import { AppShell } from './app-shell';

const meta = {
  title: 'Layouts/AppShell',
  component: AppShell.Root,
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <AppShell.Root {...args}>
      <AppShell.Sidebar>
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
