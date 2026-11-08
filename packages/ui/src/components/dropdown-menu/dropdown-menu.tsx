import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Owns the open state: uncontrolled, or controlled with `open` and `onOpenChange`. Non-modal by default:
 * a modal Radix menu puts `aria-hidden` on every ancestor of the trigger, which stays focusable, and axe
 * rejects that (`aria-hidden-focus`). Esc, a click outside and the return of the focus still work; pass
 * `modal` to opt back in.
 */
function DropdownMenuRoot({ modal = false, ...props }: ComponentProps<typeof RadixMenu.Root>) {
  return <RadixMenu.Root modal={modal} {...props} />;
}

/** The control that opens the menu; with `asChild` it is the caller's own button. */
const DropdownMenuTrigger = RadixMenu.Trigger;

/**
 * The floating list: `surface-overlay` with `border-strong`, `radius-md` and `shadow-overlay`, at
 * least 200px wide, as the `am-menu` of the card. Radix opens it on Enter, Space and the arrow keys,
 * moves between items with the arrows, closes on Esc and gives the focus back to the trigger.
 */
function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = 'end',
  ...props
}: ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={join(
          'z-10 flex min-w-50 flex-col rounded-md border border-border-strong bg-surface-overlay p-1 text-text shadow-overlay',
          className,
        )}
        {...props}
      />
    </RadixMenu.Portal>
  );
}

/** One action of the menu: 30px tall, `surface-hover` and an inner focus ring while it is the active item. */
function DropdownMenuItem({ className, ...props }: ComponentProps<typeof RadixMenu.Item>) {
  return (
    <RadixMenu.Item
      className={join(
        'flex h-7.5 cursor-pointer items-center gap-2 rounded-sm px-2 text-body text-text outline-focus',
        'data-highlighted:bg-surface-hover data-highlighted:outline-2 data-highlighted:-outline-offset-2',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/** Row menu (SKL-40, SKL-53). The caller owns every label, including the name of the trigger. */
export const DropdownMenu = {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
};
