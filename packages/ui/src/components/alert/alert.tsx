import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, Clock, Info, type LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '../../icons/icon';

const alertVariants = cva('flex items-start gap-2 rounded-md border px-3 py-2 text-body', {
  variants: {
    intent: {
      danger: 'border-danger bg-danger-subtle text-danger',
      // info-subtle is the surface-raised token (tokens.json); the contract test of the info intent
      // asserts the bg-surface-raised class, so the fill keeps that name (PRU-02 AC19).
      info: 'border-border bg-surface-raised text-text',
      warning: 'border-warning bg-warning-subtle text-warning',
    },
  },
});

type AlertIntent = NonNullable<VariantProps<typeof alertVariants>['intent']>;

const icons: Record<AlertIntent, LucideIcon> = {
  danger: CircleAlert,
  info: Info,
  warning: Clock,
};

export type AlertProps = Omit<ComponentProps<'div'>, 'role'> & {
    intent: AlertIntent;
    /** A control at the right end of the alert, such as a `Button` `sm`; its text comes from the caller. */
    action?: ReactNode;
    /** A Lucide icon in place of the intent's own, when the screen names the failure ("link-2-off"). */
    icon?: LucideIcon;
  };

/**
 * Inline message. `danger` is an error and interrupts the screen reader with `role="alert"`;
 * `info` is a calm note and `warning` a suggestion that asks for a decision, and both announce
 * themselves politely with `role="status"`. Each intent leads with its own icon, which the caller
 * may swap for one that names the failure.
 */
export function Alert({ intent, action, icon, className, children, ...props }: AlertProps) {
  return (
    <div
      role={intent === 'danger' ? 'alert' : 'status'}
      className={alertVariants({ intent, className })}
      {...props}
    >
      <Icon
        icon={icon ?? icons[intent]}
        className={intent === 'info' ? 'mt-0.5 shrink-0 text-text-muted' : 'mt-0.5 shrink-0'}
      />
      <div className="min-w-0 flex-1">{children}</div>
      {action === undefined ? null : <div className="ml-auto shrink-0 self-center">{action}</div>}
    </div>
  );
}
