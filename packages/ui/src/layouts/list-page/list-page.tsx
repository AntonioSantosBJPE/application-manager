import type { ComponentProps } from 'react';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function Root({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="list"
      className={join('flex min-h-screen flex-col gap-4 bg-surface px-6 py-8 text-text', className)}
      {...props}
    />
  );
}

function Header({ className, ...props }: ComponentProps<'header'>) {
  return (
    <header
      className={join(
        'flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4',
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
      className={join('flex flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}

/** The collection itself: rows, empty state or the load-more action the caller composes. */
function Content({ className, ...props }: ComponentProps<'div'>) {
  return <div className={join('flex flex-col gap-2', className)} {...props} />;
}

/**
 * One row of the collection (a `li`, inside a `ul` the caller owns). The row wraps: on a narrow screen the
 * text takes the whole line and the action drops below it, so no column is squeezed (UI-28).
 */
function Row({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      className={join(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-2 text-xs',
        className,
      )}
      {...props}
    />
  );
}

/** The text of a row: the full line when narrow, the space the action leaves when wide; long words break. */
function RowText({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={join('min-w-0 basis-full break-all sm:flex-1 sm:basis-0', className)}
      {...props}
    />
  );
}

/**
 * Archetype for collection screens (ADM-15): a header with the page action, a filter row and
 * the list, inside the main landmark. No card around the list; rows carry the density.
 */
export const ListPage = { Root, Header, Filters, Content, Row, RowText };
