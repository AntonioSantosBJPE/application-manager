import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';

const statusBadgeVariants = cva(
  'inline-flex h-5 items-center gap-1 rounded-sm border bg-transparent px-1.5 text-caption font-medium whitespace-nowrap',
  {
    variants: {
      intent: {
        operational: 'border-status-operational text-status-operational',
        unavailable: 'border-status-unavailable text-status-unavailable',
        neutral: 'border-border-strong text-text',
      },
    },
  },
);

export type StatusBadgeProps = ComponentProps<'span'> & {
  /** `operational` or `unavailable`; left out, the badge is neutral, without the dot ("Privada"). */
  intent?: 'operational' | 'unavailable';
  /** Render the child element instead of a span, keeping the badge classes. */
  asChild?: boolean;
};

/**
 * Pure presentational badge: the text comes from the caller. A dot in the color of the intent
 * leads the text, and border and text share that color over a transparent fill (PRU-02). Without an
 * intent the badge is neutral: no dot, `border-strong` border and `text` color ("Privada", SKL-40).
 */
export function StatusBadge({
  intent,
  asChild = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const Component = asChild ? Slot : 'span';
  return (
    <Component className={statusBadgeVariants({ intent: intent ?? 'neutral', className })} {...props}>
      {intent === undefined ? null : (
        <svg viewBox="0 0 6 6" aria-hidden="true" className="size-1.5 shrink-0">
          <circle cx="3" cy="3" r="3" fill="currentColor" />
        </svg>
      )}
      <Slottable>{children}</Slottable>
    </Component>
  );
}
