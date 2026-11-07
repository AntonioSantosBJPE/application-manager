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
 * Confirmation before a destructive action (UI-21). Radix holds the focus inside, closes on
 * Esc, and labels the dialog with the title, so keyboard use needs no extra wiring here.
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
        <AlertDialog.Overlay className="fixed inset-0 bg-surface opacity-80" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-md border border-border bg-surface-raised p-4 text-text">
          <AlertDialog.Title className="text-sm font-medium">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-xs [overflow-wrap:anywhere] text-text-muted">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
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
