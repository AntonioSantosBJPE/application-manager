import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

const kbdVariants = cva(
  'inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-sm border px-1 font-mono text-kbd',
  {
    variants: {
      tone: {
        default: 'border-border-strong bg-surface-raised text-text-muted',
        // Inside a primary or danger Button, which paints its label in on-accent.
        'on-accent': 'border-on-accent bg-transparent text-on-accent',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);

export type KbdProps = ComponentProps<'kbd'> & VariantProps<typeof kbdVariants>;

/**
 * A key or shortcut shown beside the action it triggers (PRU-07): one `kbd` per key, so a sequence
 * is two `Kbd` ("G" "C") and a chord uses the symbols ⌘ ⇧ ⌥ ↵. Put `tone="on-accent"` on the ones
 * inside a primary or danger `Button`, so they follow the label color.
 */
export function Kbd({ tone, className, ...props }: KbdProps) {
  return <kbd className={kbdVariants({ tone, className })} {...props} />;
}
