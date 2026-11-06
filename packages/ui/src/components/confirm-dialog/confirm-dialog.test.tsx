import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { ConfirmDialog } from './confirm-dialog';

function renderDialog(onConfirm = vi.fn()) {
  const user = userEvent.setup();
  render(
    <ConfirmDialog
      trigger={<Button intent="secondary">Revogar</Button>}
      title="Revogar convite"
      description="ana@example.com não poderá mais usar este link."
      confirmLabel="Revogar convite"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, user, trigger: screen.getByRole('button', { name: 'Revogar' }) };
}

describe('ConfirmDialog', () => {
  it('asks for confirmation with the email before revoking', async () => {
    const { user, trigger } = renderDialog();

    expect(screen.queryByRole('alertdialog')).toBeNull();

    await user.click(trigger);

    const dialog = screen.getByRole('alertdialog', { name: 'Revogar convite' });
    expect(dialog).toHaveTextContent('ana@example.com não poderá mais usar este link.');
  });

  it('moves the focus to cancel when it opens, the alert dialog default', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('confirms with the action and returns the focus to the trigger', async () => {
    const { onConfirm, user, trigger } = renderDialog();

    await user.click(trigger);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Revogar convite' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on Esc without confirming and returns the focus to the trigger', async () => {
    const { onConfirm, user, trigger } = renderDialog();

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on cancel without confirming and returns the focus to the trigger', async () => {
    const { onConfirm, user, trigger } = renderDialog();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('keeps the focus inside the dialog while it is open', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);
    await user.tab();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });
});
