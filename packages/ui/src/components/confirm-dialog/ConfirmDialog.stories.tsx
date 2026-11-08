import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { page } from '@vitest/browser/context';
import { expectContrast, focusRing } from '../../testing/contrast';
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

/** Waits out a running color transition, so the assertion reads the settled value. */
async function settle(element: Element): Promise<void> {
  await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
}

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    trigger: <Button intent="secondary">Revogar</Button>,
    title: 'Revogar convite',
    description: 'ana@example.com não poderá mais usar este link.',
    confirmLabel: 'Revogar convite',
    cancelLabel: 'Cancelar',
    onConfirm: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Revogar' }));

    const dialog = within(document.body).getByRole('alertdialog', { name: 'Revogar convite' });
    await expect(dialog).toHaveTextContent('ana@example.com');
  },
};

/** Light theme through the toolbar global; asserts the light danger token reaches the action. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Revogar' }));
    const dialog = within(document.body).getByRole('alertdialog', { name: 'Revogar convite' });
    const action = within(dialog).getByRole('button', { name: 'Revogar convite' });

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await settle(action);
    // The light value of --color-danger in tokens.css.
    await expect(getComputedStyle(action).backgroundColor).toBe(resolvedColor('oklch(0.52 0.17 27)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark danger token reaches the action. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Revogar' }));
    const dialog = within(document.body).getByRole('alertdialog', { name: 'Revogar convite' });
    const action = within(dialog).getByRole('button', { name: 'Revogar convite' });

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await settle(action);
    // The dark value of --color-danger in tokens.css.
    await expect(getComputedStyle(action).backgroundColor).toBe(resolvedColor('oklch(0.72 0.15 25)'));
  },
};

const longEmail = `${'a'.repeat(60)}@${'d'.repeat(55)}.example.com`;

/**
 * A description with a word that has no break point (UI-25): at 375 px the dialog and its text stay
 * inside the viewport and the actions stay on screen.
 */
export const DescricaoLonga: Story = {
  name: 'Descrição longa',
  args: { description: `O link enviado para ${longEmail} deixa de funcionar.` },
  play: async ({ canvas }) => {
    await page.viewport(375, 700);
    await userEvent.click(canvas.getByRole('button', { name: 'Revogar' }));
    const dialog = within(document.body).getByRole('alertdialog', { name: 'Revogar convite' });
    const width = document.documentElement.clientWidth;

    const bounds = dialog.getBoundingClientRect();
    await expect(bounds.left, 'dialog starts inside the viewport').toBeGreaterThanOrEqual(0);
    await expect(bounds.right, 'dialog ends inside the viewport').toBeLessThanOrEqual(width);
    await expect(dialog.scrollWidth, 'the text does not push the dialog wider').toBeLessThanOrEqual(
      dialog.clientWidth,
    );
    const cancel = within(dialog).getByRole('button', { name: 'Cancelar' }).getBoundingClientRect();
    await expect(cancel.left).toBeGreaterThanOrEqual(0);
    await expect(
      within(dialog).getByRole('button', { name: 'Revogar convite' }).getBoundingClientRect().right,
    ).toBeLessThanOrEqual(width);
  },
};

/**
 * Opens the dialog and checks it the way a person reads it: title, description and both actions at
 * 4.5:1 on surface-overlay, the cancel focused first with the focus ring at 3:1 (PRU-08 AC03).
 */
const contrast: Story['play'] = async ({ canvas }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Revogar' }));
  const dialog = within(document.body).getByRole('alertdialog', { name: 'Revogar convite' });
  await settle(dialog);
  const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });
  const confirm = within(dialog).getByRole('button', { name: 'Revogar convite' });
  await settle(cancel);
  await settle(confirm);

  await expectContrast(within(dialog).getByRole('heading', { name: 'Revogar convite' }), 4.5);
  await expectContrast(within(dialog).getByText(/não poderá mais usar este link/), 4.5);
  await expectContrast(cancel, 4.5);
  await expectContrast(confirm, 4.5);

  await expect(cancel).toHaveFocus();
  const ring = focusRing(cancel);
  await expect(ring.drawn).toBe(true);
  await expect(ring.isFocusToken).toBe(true);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  play: contrast,
};
