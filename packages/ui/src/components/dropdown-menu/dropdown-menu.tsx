import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../../icons/icon';
import { contentClassName, itemClassName } from './menu-classes';

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
        className={join(contentClassName, className)}
        {...props}
      />
    </RadixMenu.Portal>
  );
}

/** One action of the menu: 30px tall, `surface-hover` and an inner focus ring while it is the active item. */
function DropdownMenuItem({ className, ...props }: ComponentProps<typeof RadixMenu.Item>) {
  return (
    <RadixMenu.Item
      className={join(itemClassName, className)}
      {...props}
    />
  );
}

/** Groups the items of a submenu or of a menu into a nested list; owns the open state of the submenu. */
const DropdownMenuSub = RadixMenu.Sub;

/**
 * An item that opens a submenu: it looks like an `Item` and ends with a chevron. The right arrow (or
 * Enter) opens the submenu and moves the focus into it; the left arrow closes it and gives the focus back.
 */
function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof RadixMenu.SubTrigger>) {
  return (
    <RadixMenu.SubTrigger
      className={join(
        itemClassName,
        'data-[state=open]:bg-surface-hover',
        className,
      )}
      {...props}
    >
      {children}
      <Icon icon={ChevronRight} size="sm" className="ml-auto text-text-muted" />
    </RadixMenu.SubTrigger>
  );
}

/** The floating list of a submenu, with the look of `Content`. */
function DropdownMenuSubContent({
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
const DropdownMenuRadioGroup = RadixMenu.RadioGroup;

/**
 * One option of a single choice: an `Item` with a check at the end while it is the chosen one
 * (`aria-checked="true"`, role `menuitemradio`).
 */
function DropdownMenuRadioItem({
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

/**
 * One option of a multiple choice: an `Item` with a check at the end while it is on (`aria-checked="true"`,
 * role `menuitemcheckbox`). The caller owns `checked` and `onCheckedChange`; to keep the menu open for the
 * next option, it calls `event.preventDefault()` in `onSelect`.
 */
function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof RadixMenu.CheckboxItem>) {
  return (
    <RadixMenu.CheckboxItem className={join(itemClassName, className)} {...props}>
      {children}
      <RadixMenu.ItemIndicator className="ml-auto inline-flex text-accent-text">
        <Icon icon={Check} size="sm" />
      </RadixMenu.ItemIndicator>
    </RadixMenu.CheckboxItem>
  );
}

/** Row menu (SKL-40, SKL-53, APP-50, APP-68). The caller owns every label, including the name of the trigger. */
export const DropdownMenu = {
  Root: DropdownMenuRoot,
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  CheckboxItem: DropdownMenuCheckboxItem,
};
