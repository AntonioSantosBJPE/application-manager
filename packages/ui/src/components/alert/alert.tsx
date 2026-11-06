import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

const alertVariants = cva('rounded-sm border px-3 py-2 text-xs', {
  variants: {
    intent: {
      danger: 'border-danger bg-surface text-danger',
      info: 'border-border bg-surface-raised text-text',
    },
  },
});

export type AlertProps = Omit<ComponentProps<'div'>, 'role'> &
  Required<VariantProps<typeof alertVariants>>;

/**
 * Inline message. `danger` is an error and interrupts the screen reader with `role="alert"`;
 * `info` is a calm note and announces itself politely with `role="status"`.
 */
export function Alert({ intent, className, ...props }: AlertProps) {
  return (
    <div
      role={intent === 'danger' ? 'alert' : 'status'}
      className={alertVariants({ intent, className })}
      {...props}
    />
  );
}
