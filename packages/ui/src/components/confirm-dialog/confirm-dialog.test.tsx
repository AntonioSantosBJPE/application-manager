import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { ConfirmDialog } from './confirm-dialog';

function renderDialog(onConfirm = vi.fn()) {
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
  return { onConfirm };
}

describe('ConfirmDialog', () => {
  it('asks for confirmation with the email before revoking', () => {
    renderDialog();

    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Revogar convite' });
    expect(dialog).toHaveTextContent('ana@example.com não poderá mais usar este link.');
  });

  it('moves the focus into the dialog and confirms with the action', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    expect(screen.getByRole('alertdialog')).toContainElement(
      document.activeElement as HTMLElement,
    );
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar convite' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('closes on Esc without confirming', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('closes on cancel without confirming', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
