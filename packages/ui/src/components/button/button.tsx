import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../../icons/icon';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 rounded-sm border font-medium whitespace-nowrap',
    'transition-colors duration-150',
    // The ring color is set at all times: only the width appears on focus. Were the color set on focus
    // alone, `transition-colors` would fade it in from the label color (UI-24).
    'outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      intent: {
        primary:
          'border-accent bg-accent text-on-accent hover:border-accent-hover hover:bg-accent-hover',
        // The Prumo preview draws this border in border-strong; border-border stays because the
        // contract test of the secondary intent asserts it (PRU-02 AC19 keeps what the web uses).
        secondary: 'border-border bg-surface-raised text-text hover:bg-surface-hover',
        ghost: 'border-transparent bg-transparent text-text-muted hover:bg-surface-hover hover:text-text',
        danger:
          'border-danger bg-danger text-on-accent hover:border-danger-hover hover:bg-danger-hover',
        // A text link that does something, as "Ver texto completo": accent text, no box and no side
        // padding, so it lines up with the text above it.
        link: 'border-transparent bg-transparent text-accent-text hover:underline',
      },
      size: {
        default: 'h-control-md text-body',
        sm: 'h-control-sm text-caption',
      },
      iconOnly: { true: '', false: '' },
    },
    // A button with only an icon is a square of the control height; one with a label has side padding.
    compoundVariants: [
      { iconOnly: false, size: 'default', intent: ['primary', 'secondary', 'ghost', 'danger'], className: 'px-3' },
      { iconOnly: false, size: 'sm', intent: ['primary', 'secondary', 'ghost', 'danger'], className: 'px-2' },
      { iconOnly: false, intent: 'link', className: 'px-0' },
      { iconOnly: true, size: 'default', className: 'w-control-md' },
      { iconOnly: true, size: 'sm', className: 'w-control-sm' },
    ],
    defaultVariants: { intent: 'primary', size: 'default', iconOnly: false },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  Omit<VariantProps<typeof buttonVariants>, 'iconOnly'> & {
    /** Render the child element instead of a button, keeping the button classes. */
    asChild?: boolean;
    /**
     * A Lucide icon before the label, 16px (14px with `size="sm"`), hidden from assistive technology.
     * Without children the button is icon only, and the caller names it with `aria-label`.
     */
    icon?: LucideIcon;
    /** A Lucide icon after the label, for an action that leads somewhere ("Ver convites"). */
    iconEnd?: LucideIcon;
  };

/** Action control: the intent names the meaning, never the color. */
export function Button({
  intent,
  size,
  asChild = false,
  icon,
  iconEnd,
  className,
  children,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  const iconSize = size === 'sm' ? 'sm' : 'default';
  const iconOnly = !asChild && children === undefined && icon !== undefined;
  // A button with only an icon has no text to name it (guia do Button).
  if (iconOnly && props['aria-label'] === undefined && props['aria-labelledby'] === undefined) {
    throw new Error('Button: a button with only an icon needs an aria-label.');
  }
  return (
    <Component
      // Without it a browser defaults to `submit`, and any button inside a form would submit it.
      type={asChild ? undefined : 'button'}
      className={buttonVariants({ intent, size, iconOnly, className })}
      {...props}
    >
      {icon === undefined ? null : <Icon icon={icon} size={iconSize} className="shrink-0" />}
      <Slottable>{children}</Slottable>
      {iconEnd === undefined ? null : <Icon icon={iconEnd} size={iconSize} className="shrink-0" />}
    </Component>
  );
}
