import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

export const Primario: Story = {
  name: 'Primário',
  args: { intent: 'primary', children: 'Entrar' },
};

export const Secundario: Story = {
  name: 'Secundário',
  args: { intent: 'secondary', children: 'Cancelar' },
};

export const Perigo: Story = {
  name: 'Perigo',
  args: { intent: 'danger', children: 'Revogar' },
};

export const Desabilitado: Story = {
  name: 'Desabilitado',
  args: { intent: 'primary', children: 'Entrar', disabled: true },
};

/** Light theme through the toolbar global; asserts the light accent token reaches the button. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { intent: 'primary', children: 'Entrar' },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Entrar' });

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-accent in tokens.css.
    await expect(getComputedStyle(button).backgroundColor).toBe(resolvedColor('oklch(0.52 0.17 265)'));
    // The light value of --color-on-accent in tokens.css.
    await expect(getComputedStyle(button).color).toBe(resolvedColor('oklch(0.99 0.003 260)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark accent token reaches the button. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { intent: 'primary', children: 'Entrar' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Entrar' });

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-accent in tokens.css.
    await expect(getComputedStyle(button).backgroundColor).toBe(resolvedColor('oklch(0.72 0.15 265)'));
    // The dark value of --color-on-accent in tokens.css.
    await expect(getComputedStyle(button).color).toBe(resolvedColor('oklch(0.18 0.01 260)'));
  },
};
