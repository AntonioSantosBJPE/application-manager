import type { ComponentProps } from 'react';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * A box with a dashed `border-strong` border and `radius-md`, aligned to the left, for a list or area
 * with nothing in it yet. The sentence comes from the caller and is read in `text-muted`; there is no
 * illustration and no icon.
 */
function Root({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={join(
        'flex flex-col items-start gap-3 rounded-md border border-dashed border-border-strong px-6 py-8 text-text-muted',
        className,
      )}
      {...props}
    />
  );
}

/** The action that fills the emptiness, such as a primary `Button`; the caller writes its label. */
function Action({ className, ...props }: ComponentProps<'div'>) {
  return <div className={join('flex flex-wrap items-center gap-2', className)} {...props} />;
}

/** Empty state (PRU-07): one sentence and, when there is something to do, one action. */
export const EmptyState = { Root, Action };
