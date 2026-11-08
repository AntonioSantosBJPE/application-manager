import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../button';
import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';

/** A promise the test settles by hand, so the pending state can be observed. */
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function renderDialog(props: Partial<ConfirmDialogProps> = {}) {
  const user = userEvent.setup();
  render(
    <ConfirmDialog
      trigger={<Button intent="secondary">Promover</Button>}
      title="Promover Skill Fictícia Alfa?"
      description="A skill passa a ser visível para todas as pessoas."
      confirmLabel="Promover skill"
      cancelLabel="Cancelar"
      onConfirm={vi.fn()}
      {...props}
    />,
  );
  return { user, trigger: screen.getByRole('button', { name: 'Promover' }) };
}

const confirmButton = () => screen.getByRole('button', { name: 'Promover skill' });
const cancelButton = () => screen.getByRole('button', { name: 'Cancelar' });

describe('ConfirmDialog confirmIntent', () => {
  it('SKL-45 confirms with the danger intent by default', async () => {
    const { user, trigger } = renderDialog();

    await user.click(trigger);

    expect(confirmButton()).toHaveClass('bg-danger', 'border-danger');
  });

  it('SKL-45 confirms with the primary intent when the action is not destructive', async () => {
    const { user, trigger } = renderDialog({ confirmIntent: 'primary' });

    await user.click(trigger);

    expect(confirmButton()).toHaveClass('bg-accent', 'border-accent');
    expect(confirmButton()).not.toHaveClass('bg-danger');
  });
});

describe('ConfirmDialog with a synchronous onConfirm', () => {
  it('SKL-50 closes at once and never shows a busy state', async () => {
    const onConfirm = vi.fn();
    const { user, trigger } = renderDialog({ onConfirm });

    await user.click(trigger);
    expect(confirmButton()).not.toHaveAttribute('aria-busy');
    await user.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe('ConfirmDialog with an onConfirm that returns a promise', () => {
  it('SKL-50 stays open with both buttons disabled and aria-busy on confirm until the promise ends', async () => {
    const work = deferred();
    const onConfirm = vi.fn(() => work.promise);
    const { user, trigger } = renderDialog({ onConfirm });
    await user.click(trigger);

    await user.click(confirmButton());

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    expect(confirmButton()).toHaveAttribute('aria-busy', 'true');
    expect(cancelButton()).toBeDisabled();
    expect(cancelButton()).not.toHaveAttribute('aria-busy');

    await act(async () => work.resolve());

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('SKL-50 does not call onConfirm again on a second click or a double click while pending', async () => {
    const work = deferred();
    const onConfirm = vi.fn(() => work.promise);
    const { user, trigger } = renderDialog({ onConfirm });
    await user.click(trigger);

    await user.dblClick(confirmButton());
    await user.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => work.resolve());
  });

  it('SKL-50 ignores Esc while pending and closes on Esc afterwards', async () => {
    const work = deferred();
    const { user, trigger } = renderDialog({ onConfirm: () => work.promise });
    await user.click(trigger);
    await user.click(confirmButton());

    await user.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await act(async () => work.resolve());
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('SKL-50 ends the wait when the promise rejects: the dialog closes and the buttons are free again on reopening', async () => {
    const work = deferred();
    const onConfirm = vi.fn().mockReturnValueOnce(work.promise).mockReturnValue(undefined);
    const { user, trigger } = renderDialog({ onConfirm });
    await user.click(trigger);
    await user.click(confirmButton());

    await act(async () => work.reject(new Error('the api did not answer')));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    await user.click(trigger);
    expect(confirmButton()).toBeEnabled();
    expect(confirmButton()).not.toHaveAttribute('aria-busy');
    expect(cancelButton()).toBeEnabled();
  });

  it('SKL-46 still closes on cancel without calling onConfirm when nothing is pending', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const { user, trigger } = renderDialog({ onConfirm });
    await user.click(trigger);

    await user.click(cancelButton());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
