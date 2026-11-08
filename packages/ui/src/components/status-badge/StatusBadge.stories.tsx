import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { StatusBadge } from './status-badge';

const meta = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Operacional: Story = {
  args: { intent: 'operational', children: 'Operacional' },
};

export const Indisponivel: Story = {
  name: 'Indisponível',
  args: { intent: 'unavailable', children: 'Indisponível' },
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

/** Light theme through the toolbar global; asserts the light token reaches the rendered badge. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { intent: 'operational', children: 'Operacional' },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const badge = canvas.getByText('Operacional');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-status-operational in tokens.css.
    await expect(getComputedStyle(badge).color).toBe(resolvedColor('oklch(0.5 0.11 150)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark token reaches the rendered badge. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { intent: 'operational', children: 'Operacional' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const badge = canvas.getByText('Operacional');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-status-operational in tokens.css.
    await expect(getComputedStyle(badge).color).toBe(resolvedColor('oklch(0.76 0.13 150)'));
  },
};
