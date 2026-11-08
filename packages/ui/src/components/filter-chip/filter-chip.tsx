import type { ComponentProps } from 'react';

export type FilterChipProps = Omit<ComponentProps<'button'>, 'aria-pressed'> & {
  /** Whether the filter is on; the chip announces it as `aria-pressed`. */
  pressed: boolean;
  /** How many items the filter holds, drawn in `font-mono`; the caller decides when it is worth showing. */
  count?: number;
};

/**
 * A filter toggle (SKL-41): 26px tall, `caption`, `border-strong`; pressed it turns to `surface-hover`
 * with `text` and `border-control`. The label and the count come from the caller.
 */
export function FilterChip({ pressed, count, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={[
        'inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-sm border px-2 text-caption whitespace-nowrap',
        'transition-colors duration-150',
        pressed
          ? 'border-border-control bg-surface-hover text-text'
          : 'border-border-strong bg-surface text-text-muted hover:bg-surface-hover hover:text-text',
        'outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
      {count === undefined ? null : <span className="font-mono">{count}</span>}
    </button>
  );
}
