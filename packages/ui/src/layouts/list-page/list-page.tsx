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

/** The filter row; a `search` landmark, so keyboard users can jump straight to it. */
function Filters({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      role="search"
      aria-label={props['aria-label'] ?? 'Filtros'}
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
 * Archetype for collection screens (ADM-15): a header with the page action, a filter row and
 * the list, inside the main landmark. No card around the list; rows carry the density.
 */
export const ListPage = { Root, Header, Filters, Content };
