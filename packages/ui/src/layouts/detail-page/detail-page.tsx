import type { ComponentProps, ReactNode } from 'react';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * The page: a `main` with the content on one side and the properties on the other (stacked when
 * narrow, side by side from `md` up).
 */
function Root({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="detail"
      className={join(
        'flex min-w-0 flex-1 flex-col bg-surface text-text md:flex-row',
        className,
      )}
      {...props}
    />
  );
}

/** The content of the item: sections of `space-6` apart, whose titles the caller writes in `heading-sm`. */
function Main({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={join('flex min-w-0 flex-1 flex-col gap-6 px-6 py-6 md:px-8', className)}
      {...props}
    />
  );
}

export type DetailPageSidebarProps = ComponentProps<'aside'> & {
  /** The caller names the region; the design system ships no product copy of its own. */
  'aria-label': string;
};

/** The properties column: 280px with a border on the left from `md` up, below the content when narrow. */
function Sidebar({ className, ...props }: DetailPageSidebarProps) {
  return (
    <aside
      className={join(
        'flex flex-col gap-4 border-t border-border bg-surface p-4',
        'md:w-properties md:shrink-0 md:border-t-0 md:border-l',
        className,
      )}
      {...props}
    />
  );
}

/** The definition list that holds the `Property` rows. */
function Properties({ className, ...props }: ComponentProps<'dl'>) {
  return <dl className={join('flex flex-col gap-1', className)} {...props} />;
}

export type DetailPagePropertyProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** The name of the property, in `caption` and `text-muted`. */
  name: ReactNode;
  /** The value: a row of 28px that takes `surface-hover` under the pointer. */
  children: ReactNode;
};

/** One property of the item: its name and its value side by side. */
function Property({ name, children, className, ...props }: DetailPagePropertyProps) {
  return (
    <div className={join('flex items-center gap-1', className)} {...props}>
      <dt className="w-24 shrink-0 text-caption text-text-muted">{name}</dt>
      <dd className="flex min-h-7 min-w-0 flex-1 items-center rounded-sm px-1.5 text-body transition-colors duration-150 hover:bg-surface-hover">
        {children}
      </dd>
    </div>
  );
}

/**
 * Archetype for one item with properties (PRU-07): the content at the left and the properties at the
 * right, inside the main landmark.
 */
export const DetailPage = { Root, Main, Sidebar, Properties, Property };
