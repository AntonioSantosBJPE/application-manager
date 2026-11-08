import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

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
      },
      size: {
        default: 'h-control-md px-3 text-body',
        sm: 'h-control-sm px-2 text-caption',
      },
    },
    defaultVariants: { intent: 'primary', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element instead of a button, keeping the button classes. */
    asChild?: boolean;
  };

/** Action control: the intent names the meaning, never the color. */
export function Button({ intent, size, asChild = false, className, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      // Without it a browser defaults to `submit`, and any button inside a form would submit it.
      type={asChild ? undefined : 'button'}
      className={buttonVariants({ intent, size, className })}
      {...props}
    />
  );
}
