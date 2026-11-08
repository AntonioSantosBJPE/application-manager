import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { settle } from '../../testing/contrast';
import { Button } from '../button';
import { ConfirmDialog } from './confirm-dialog';

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
  title: 'Components/ConfirmDialog/Intenção e espera',
  component: ConfirmDialog,
  args: {
    trigger: <Button intent="secondary">Promover</Button>,
    title: 'Promover Skill Fictícia Alfa?',
    description: 'A skill passa a ser visível para todas as pessoas. A promoção não se desfaz por aqui.',
    confirmLabel: 'Promover skill',
    cancelLabel: 'Cancelar',
    confirmIntent: 'primary',
    onConfirm: () => {},
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The confirm button in the accent token of the active theme. */
const primary = (accent: string): Story['play'] => async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Promover' }));
  const dialog = within(document.body).getByRole('alertdialog', { name: 'Promover Skill Fictícia Alfa?' });
  const action = within(dialog).getByRole('button', { name: 'Promover skill' });
  await settle(action);
  await expect(getComputedStyle(action).backgroundColor).toBe(resolvedColor(accent));
};

export const Primaria: Story = {
  name: 'Intenção primária',
  play: primary('oklch(0.5 0.08 195)'),
};

export const PrimariaTemaClaro: Story = {
  name: 'Intenção primária, tema claro',
  globals: { theme: 'light' },
  play: primary('oklch(0.5 0.08 195)'),
};

export const PrimariaTemaEscuro: Story = {
  name: 'Intenção primária, tema escuro',
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Promover' }));
    const dialog = within(document.body).getByRole('alertdialog', { name: 'Promover Skill Fictícia Alfa?' });
    const action = within(dialog).getByRole('button', { name: 'Promover skill' });
    await settle(action);
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await expect(getComputedStyle(action).backgroundColor).not.toBe(resolvedColor('oklch(0.5 0.08 195)'));
  },
};

/** An action that never ends: the dialog stays open, busy, with both buttons disabled. */
const pending: Story['play'] = async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Promover' }));
  const dialog = within(document.body).getByRole('alertdialog', { name: 'Promover Skill Fictícia Alfa?' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Promover skill' }));

  await expect(within(dialog).getByRole('button', { name: 'Promover skill' })).toHaveAttribute('aria-busy', 'true');
  await expect(within(dialog).getByRole('button', { name: 'Promover skill' })).toBeDisabled();
  await expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
};

export const Pendente: Story = {
  name: 'Pendente, tema claro',
  args: { onConfirm: () => new Promise(() => {}) },
  globals: { theme: 'light' },
  play: pending,
};

export const PendenteEscuro: Story = {
  name: 'Pendente, tema escuro',
  args: { onConfirm: () => new Promise(() => {}) },
  globals: { theme: 'dark' },
  play: pending,
};
