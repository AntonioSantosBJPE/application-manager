import * as RadixDialog from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Owns the open state: uncontrolled with `defaultOpen`, or controlled with `open` and `onOpenChange`. */
const DialogRoot = RadixDialog.Root;

/** The control that opens the dialog; with `asChild` it is the caller's own button. */
const DialogTrigger = RadixDialog.Trigger;

/** Closes the dialog; with `asChild` it is the caller's own button, as the cancel of a form. */
const DialogClose = RadixDialog.Close;

/**
 * The surface of a form dialog, the same as the `ConfirmDialog`: `surface-overlay` with
 * `border-strong`, `radius-lg` and `shadow-overlay`, at most 440px wide (640px with `size="lg"`) over the `backdrop` veil. Radix
 * moves the focus in, keeps it inside, closes on Esc and gives it back to the trigger, and names the
 * dialog after `Dialog.Title`.
 */
function DialogContent({
  className,
  children,
  size = 'md',
  onEscapeKeyDown,
  ...props
}: ComponentProps<typeof RadixDialog.Content> & {
  /** `md` (the default) is at most 440px wide; `lg` is at most 640px, for a dialog with a full form. */
  size?: 'md' | 'lg';
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-backdrop" />
      <RadixDialog.Content
        className={join(
          size === 'lg' ? 'max-w-160' : 'max-w-110',
          'fixed top-1/2 left-1/2 flex max-h-screen w-full -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-lg border border-border-strong bg-surface-overlay p-4 text-text shadow-overlay',
          className,
        )}
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event);
          // A combobox with its list open uses Esc to close the list; the dialog stays for the next Esc.
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            target.getAttribute('role') === 'combobox' &&
            target.getAttribute('aria-expanded') === 'true'
          ) {
            event.preventDefault();
          }
        }}
        {...props}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof RadixDialog.Title>) {
  return <RadixDialog.Title className={join('text-heading-md', className)} {...props} />;
}

function DialogDescription({ className, ...props }: ComponentProps<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description
      className={join('text-body wrap-anywhere text-text-muted', className)}
      {...props}
    />
  );
}

/** The row of actions at the bottom, right-aligned. */
function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={join('mt-1 flex justify-end gap-2', className)} {...props} />;
}

/** Form dialog (SKL-48, SKL-53, SKL-72). The caller owns every word and every field. */
export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Close: DialogClose,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Footer: DialogFooter,
};
