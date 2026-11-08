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

describe('ConfirmDialog in the Prumo', () => {
  it('PRU-02 AC16 floats on surface-overlay with border-strong, radius-lg, shadow-overlay and 440px over the backdrop', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveClass(
      'bg-surface-overlay',
      'border-border-strong',
      'rounded-lg',
      'shadow-overlay',
      'max-w-110',
    );
    // The veil is the element Radix renders right before the dialog in the portal.
    const veil = dialog.previousElementSibling;
    expect(veil).toHaveClass('bg-backdrop', 'fixed', 'inset-0');
  });

  it('PRU-02 AC17 closes on Esc without calling onConfirm, even with the confirm action focused', async () => {
    const { onConfirm, user, trigger } = renderDialog();

    await user.click(trigger);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Revogar convite' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('PRU-02 AC18 keeps Tab and Shift+Tab cycling between the two actions while open', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Antes</button>
        <ConfirmDialog
          trigger={<Button intent="secondary">Revogar</Button>}
          title="Revogar convite"
          description="ana@exemplo.com não poderá mais usar este link."
          confirmLabel="Revogar convite"
          cancelLabel="Cancelar"
          onConfirm={vi.fn()}
        />
        <button type="button">Depois</button>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Revogar' }));
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    const confirm = screen.getByRole('button', { name: 'Revogar convite' });
    expect(cancel).toHaveFocus();

    const visited: (Element | null)[] = [];
    for (let step = 0; step < 4; step += 1) {
      await user.tab();
      visited.push(document.activeElement);
    }
    expect(visited).toEqual([confirm, cancel, confirm, cancel]);

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
  });
});
