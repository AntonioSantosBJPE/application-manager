import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Button } from '../button';

export type ConfirmDialogProps = {
  /** The trigger rendered by the caller, so the dialog opens from any control. */
  trigger: ReactNode;
  title: string;
  /** Text below the title, naming what will be affected. */
  description: ReactNode;
  confirmLabel: string;
  /** The caller owns every word on screen; the component knows no product copy. */
  cancelLabel: string;
  /**
   * Runs only on confirm; dismissing with Esc or cancel never calls it. When it returns a promise the
   * dialog stays open until the promise settles, with both buttons disabled and `aria-busy` on the
   * confirm one, so a second click cannot send the action again (SKL-50). A rejected promise also ends
   * the wait: telling the person about a failure is the caller's job.
   */
  onConfirm: () => void | Promise<unknown>;
  /** `danger` (the default) for what cannot be undone, `primary` for a confirmation that is not destructive. */
  confirmIntent?: 'danger' | 'primary';
};

function isPromise(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

/**
 * Confirmation before a destructive action (UI-21). It floats on `surface-overlay` with
 * `border-strong`, `radius-lg` and `shadow-overlay`, at most 440px wide over the `backdrop` veil
 * (PRU-02). Radix holds the focus inside, opens on cancel, closes on Esc without confirming,
 * returns the focus to the trigger, and labels the dialog with the title.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmIntent = 'danger',
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  // State alone lets two clicks in the same tick through, before the buttons are disabled.
  const running = useRef(false);

  function confirm(event: MouseEvent<HTMLButtonElement>) {
    if (running.current) {
      event.preventDefault();
      return;
    }
    const result = onConfirm();
    if (!isPromise(result)) return;
    // Radix closes the dialog after this handler unless the click is prevented.
    event.preventDefault();
    running.current = true;
    setPending(true);
    const finish = () => {
      running.current = false;
      setPending(false);
      setOpen(false);
    };
    result.then(finish, finish);
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        // Esc, the veil and cancel cannot walk away from an action that is still running.
        if (!pending) setOpen(next);
      }}
    >
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-backdrop" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 flex w-full max-w-110 -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-border-strong bg-surface-overlay p-4 text-text shadow-overlay">
          <AlertDialog.Title className="text-heading-md">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-body wrap-anywhere text-text-muted">
            {description}
          </AlertDialog.Description>
          <div className="mt-1 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button intent="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                intent={confirmIntent}
                disabled={pending}
                aria-busy={pending ? true : undefined}
                onClick={confirm}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
