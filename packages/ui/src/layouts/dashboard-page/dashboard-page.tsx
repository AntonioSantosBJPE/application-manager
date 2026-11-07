import type { ComponentProps } from 'react';

function Root({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="dashboard"
      className={['min-h-screen bg-surface px-6 py-8 text-text', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}

function Header({ className, ...props }: ComponentProps<'header'>) {
  return (
    <header
      className={['mb-6 border-b border-border pb-4', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

function Grid({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={['grid grid-cols-1 gap-4 md:grid-cols-2', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

/** Archetype for insight pages: a header and a grid of widgets inside the main landmark. */
export const DashboardPage = { Root, Header, Grid };
