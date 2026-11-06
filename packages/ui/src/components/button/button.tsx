import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-sm border text-xs font-medium',
    'transition-colors duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      intent: {
        primary: 'border-accent bg-accent text-on-accent hover:opacity-90',
        secondary: 'border-border bg-surface-raised text-text hover:bg-surface',
        danger: 'border-danger bg-danger text-on-accent hover:opacity-90',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2',
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
  return <Component className={buttonVariants({ intent, size, className })} {...props} />;
}
