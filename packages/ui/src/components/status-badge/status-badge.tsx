import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-sm border bg-surface px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      intent: {
        operational: 'border-status-operational text-status-operational',
        unavailable: 'border-status-unavailable text-status-unavailable',
      },
    },
  },
);

export type StatusBadgeProps = ComponentProps<'span'> &
  Required<VariantProps<typeof statusBadgeVariants>> & {
    /** Render the child element instead of a span, keeping the badge classes. */
    asChild?: boolean;
  };

/** Pure presentational badge: the text comes from the caller. */
export function StatusBadge({ intent, asChild = false, className, ...props }: StatusBadgeProps) {
  const Component = asChild ? Slot : 'span';
  return <Component className={statusBadgeVariants({ intent, className })} {...props} />;
}
