import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '../../icons/icon';

function join(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function Root({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="list"
      className={join('flex min-h-screen min-w-0 flex-1 flex-col bg-surface text-text', className)}
      {...props}
    />
  );
}

/**
 * The topbar of the page (48px): the title in `heading-md` at the left, then the count in
 * `font-mono` and, pushed to the right with `ml-auto`, the primary action in `size="sm"`.
 */
function Header({ className, ...props }: ComponentProps<'header'>) {
  return (
    <header
      className={join(
        'flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-6 text-heading-md',
        className,
      )}
      {...props}
    />
  );
}

export type ListPageFiltersProps = ComponentProps<'section'> & {
  /** The caller names the region; the design system ships no product copy of its own. */
  'aria-label': string;
};

/** The filter row; a `search` landmark, so keyboard users can jump straight to it. */
function Filters({ 'aria-label': ariaLabel, className, ...props }: ListPageFiltersProps) {
  return (
    <section
      role="search"
      aria-label={ariaLabel}
      className={join(
        'flex min-h-11 flex-wrap items-center gap-2 border-b border-border px-6 py-1.5',
        className,
      )}
      {...props}
    />
  );
}

/** The collection itself: groups and rows, an empty state or the load-more action the caller composes. */
function Content({ className, ...props }: ComponentProps<'div'>) {
  return <div className={join('flex flex-col', className)} {...props} />;
}

export type ListPageGroupProps = ComponentProps<'h2'> & {
  /** How many rows the group holds, shown after the label in `font-mono`. */
  count?: ReactNode;
  /**
   * An action for the group, drawn at the right of the header (a ghost icon `Button` with its own
   * `aria-label`, such as the "+"). It sits beside the `h2`, never inside it, so it stays out of the
   * heading's name.
   */
  action?: ReactNode;
};

const groupHeaderClassName =
  'flex h-9 items-center gap-2 border-b border-border bg-surface-raised px-6 text-heading-sm';

/**
 * The header of a group of rows (36px on `surface-raised`): the label in `heading-sm` and the count.
 * With `action` the header becomes a `div` holding the `h2` and the action pushed to the right; the
 * `className` then goes on that `div`, and the other props stay on the `h2`.
 */
function Group({ count, action, className, children, ...props }: ListPageGroupProps) {
  const label = (
    <>
      {children}
      {count === undefined ? null : (
        <span className="font-mono text-caption font-normal text-text-muted">{count}</span>
      )}
    </>
  );
  if (action === undefined) {
    return (
      <h2 className={join(groupHeaderClassName, className)} {...props}>
        {label}
      </h2>
    );
  }
  return (
    <div className={join(groupHeaderClassName, className)}>
      <h2 className="flex min-w-0 items-center gap-2 text-heading-sm" {...props}>
        {label}
      </h2>
      <div className="ml-auto flex shrink-0 items-center">{action}</div>
    </div>
  );
}

export type ListPageRowProps = ComponentProps<'li'> & {
  /** Marks the row the person has selected: `accent-subtle` instead of the hover fill. */
  selected?: boolean;
};

/**
 * One row of the collection (a `li`, inside a `ul` the caller owns), at least 40px tall, with the
 * `space-6` gutter as padding: the fill of hover and selection still runs edge to edge (UI-28). The
 * row wraps:
 * on a narrow screen the text takes the whole line and the metadata drops below it, so no column is
 * squeezed (PRU-04).
 */
function Row({ selected = false, className, ...props }: ListPageRowProps) {
  return (
    <li
      aria-current={selected ? 'true' : undefined}
      className={join(
        'flex min-h-row flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-6 py-1.5 text-body transition-colors duration-150',
        selected ? 'bg-accent-subtle' : 'hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  );
}

export type ListPageRowTextProps = ComponentProps<'span'> & {
  /** A Lucide icon before the text, 14px in `text-muted`, hidden from assistive technology. */
  icon?: LucideIcon;
};

/**
 * The text of a row: the full line when narrow, the space the metadata leaves when wide; a long one
 * is cut. An optional icon sits before it and never shrinks.
 */
function RowText({ icon, className, children, ...props }: ListPageRowTextProps) {
  if (icon === undefined) {
    return (
      <span
        className={join('min-w-0 basis-full truncate sm:flex-1 sm:basis-0', className)}
        {...props}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={join('flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-0', className)}
      {...props}
    >
      <Icon icon={icon} size="sm" className="shrink-0 text-text-muted" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/**
 * The metadata of a row, at the right and in `text-muted`. Give each cell a width (`w-24`) so the
 * columns line up from row to row; dates and counts use `font-mono`.
 */
function RowMeta({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={join('flex shrink-0 items-center gap-3 text-text-muted', className)}
      {...props}
    />
  );
}

/**
 * Archetype for collection screens (PRU-04): a topbar with the title, count and primary action, a
 * filter row and the list in groups, inside the main landmark. No card around the list; rows carry
 * the density.
 */
export const ListPage = { Root, Header, Filters, Content, Group, Row, RowText, RowMeta };
