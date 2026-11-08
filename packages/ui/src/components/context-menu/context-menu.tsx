import * as RadixMenu from '@radix-ui/react-context-menu';
import { Check, ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../../icons/icon';
import { contentClassName, itemClassName } from '../dropdown-menu/menu-classes';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Owns the open state: uncontrolled, or controlled with `onOpenChange`. Non-modal by default, for the
 * same reason as the `DropdownMenu`: a modal Radix menu puts `aria-hidden` on the page around it, and
 * axe rejects hidden content that is still focusable. Pass `modal` to opt back in.
 */
function ContextMenuRoot({ modal = false, ...props }: ComponentProps<typeof RadixMenu.Root>) {
  return <RadixMenu.Root modal={modal} {...props} />;
}

/**
 * The area that answers to the right button; with `asChild` it is the caller's own element, such as a
 * list row. The menu also opens with `Shift+F10` or the menu key while that element has the focus, so
 * give it `tabIndex` when it is not focusable already.
 */
const ContextMenuTrigger = RadixMenu.Trigger;

/** The floating list, with the look of the `DropdownMenu` content. */
function ContextMenuContent({ className, ...props }: ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content className={join(contentClassName, className)} {...props} />
    </RadixMenu.Portal>
  );
}

/** One action of the menu, with the look of the `DropdownMenu` item. */
function ContextMenuItem({ className, ...props }: ComponentProps<typeof RadixMenu.Item>) {
  return <RadixMenu.Item className={join(itemClassName, className)} {...props} />;
}

/** Owns the open state of a submenu. */
const ContextMenuSub = RadixMenu.Sub;

/** An item that opens a submenu: the right arrow opens it, the left arrow closes it. */
function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof RadixMenu.SubTrigger>) {
  return (
    <RadixMenu.SubTrigger
      className={join(itemClassName, 'data-[state=open]:bg-surface-hover', className)}
      {...props}
    >
      {children}
      <Icon icon={ChevronRight} size="sm" className="ml-auto text-text-muted" />
    </RadixMenu.SubTrigger>
  );
}

/** The floating list of a submenu. */
function ContextMenuSubContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof RadixMenu.SubContent>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.SubContent sideOffset={sideOffset} className={join(contentClassName, className)} {...props} />
    </RadixMenu.Portal>
  );
}

/** Holds the `RadioItem`s of a single choice; `value` and `onValueChange` are the caller's. */
const ContextMenuRadioGroup = RadixMenu.RadioGroup;

/** One option of a single choice, with a check at the end while it is the chosen one (`aria-checked="true"`). */
function ContextMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof RadixMenu.RadioItem>) {
  return (
    <RadixMenu.RadioItem className={join(itemClassName, className)} {...props}>
      {children}
      <RadixMenu.ItemIndicator className="ml-auto inline-flex text-accent-text">
        <Icon icon={Check} size="sm" />
      </RadixMenu.ItemIndicator>
    </RadixMenu.RadioItem>
  );
}

/** The `DropdownMenu` on the right click of a row (APP-50). The caller owns every label. */
export const ContextMenu = {
  Root: ContextMenuRoot,
  Trigger: ContextMenuTrigger,
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
};
