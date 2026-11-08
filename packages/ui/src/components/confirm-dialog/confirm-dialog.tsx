import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
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
  /** Runs only on confirm; dismissing with Esc or cancel never calls it. */
  onConfirm: () => void;
};

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
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
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
              <Button intent="secondary">{cancelLabel}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button intent="danger" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
