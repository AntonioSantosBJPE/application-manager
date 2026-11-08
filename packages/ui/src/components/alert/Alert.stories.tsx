import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Alert } from './alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Perigo: Story = {
  name: 'Perigo',
  args: { intent: 'danger', children: 'E-mail ou senha incorretos.' },
};

export const Informacao: Story = {
  name: 'Informação',
  args: { intent: 'info', children: 'Este link aparece uma única vez.' },
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

/** Light theme through the toolbar global; asserts the light danger token reaches the message. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { intent: 'danger', children: 'E-mail ou senha incorretos.' },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.52 0.17 27)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark danger token reaches the message. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { intent: 'danger', children: 'E-mail ou senha incorretos.' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.72 0.15 25)'));
  },
};
