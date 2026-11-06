import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { CopyField } from './copy-field';

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

const meta = {
  title: 'Components/CopyField',
  component: CopyField,
  args: {
    value: 'https://app.example.com/invite/abc123',
    onCopy: fn(),
    copyLabel: 'Copiar',
    copiedLabel: 'Copiado',
    failureMessage: 'Não foi possível copiar. Selecione o link.',
    valueLabel: 'Link do convite',
  },
} satisfies Meta<typeof CopyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Copiar' }));
    await expect(args.onCopy).toHaveBeenCalledTimes(1);
  },
};

export const Copiado: Story = {
  args: { status: 'copied' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Copiado' })).toBeVisible();
  },
};

export const Falha: Story = {
  name: 'Falha',
  args: { status: 'failed' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('Não foi possível copiar. Selecione o link.'),
    ).toBeVisible();
  },
};

/** Light theme through the toolbar global; asserts the light danger token reaches the failure. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { status: 'failed' },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.5 0.17 27)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark danger token reaches the failure. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { status: 'failed' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.75 0.14 27)'));
  },
};
