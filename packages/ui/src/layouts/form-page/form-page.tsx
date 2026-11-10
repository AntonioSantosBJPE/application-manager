import { type ComponentProps, type ReactNode, useId } from 'react';
import { AppShell, type NavItemProps } from '../app-shell/app-shell';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * The page: a `main` with the index of sections at the left, the sections in a column of reading
 * width and, on a row of its own, the actions. Stacked when narrow.
 */
function Root({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="form"
      className={join(
        'flex min-w-0 flex-1 flex-col gap-8 bg-surface px-6 py-6 text-text md:flex-row md:flex-wrap md:px-8',
        className,
      )}
      {...props}
    />
  );
}

export type FormPageIndexProps = ComponentProps<'nav'> & {
  /** The caller names the index; the design system ships no product copy of its own. */
  'aria-label': string;
};

/** The index of sections, 200px wide, that stays in view while the sections scroll. */
function Index({ className, ...props }: FormPageIndexProps) {
  return (
    <nav
      className={join(
        'flex flex-col gap-0.5 md:sticky md:top-6 md:w-50 md:shrink-0 md:self-start',
        className,
      )}
      {...props}
    />
  );
}

export type FormPageIndexLinkProps = Omit<NavItemProps, 'icon' | 'count'> & {
  /** How many items the section has; shown at the right in monospace, and omitted when it is zero. */
  count?: number;
};

/**
 * One link of the index: the label, marked as the current page with `current`, and `count` at the right
 * in monospace. A count of zero (or none) is not drawn, so a section with nothing in it shows no number.
 */
function IndexLink({ count, ...props }: FormPageIndexLinkProps) {
  return <AppShell.NavItem count={count === 0 ? undefined : count} {...props} />;
}

/** The column that holds the sections, as wide as 720px (the reading width). */
function Content({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={join('flex min-w-0 flex-1 basis-0 flex-col gap-8 md:max-w-form', className)}
      {...props}
    />
  );
}

export type FormPageSectionProps = Omit<ComponentProps<'section'>, 'title'> & {
  /** The title of the section, in `heading-md`. */
  title: ReactNode;
  /** The controls at the right of the title, such as an "add item" button. */
  actions?: ReactNode;
};

/** A section of the form: the title, an area for its actions and the fields the caller composes. */
function Section({ title, actions, className, children, ...props }: FormPageSectionProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={join('flex flex-col gap-4', className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-heading-md">
          {title}
        </h2>
        {actions === undefined ? null : (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}

/** An item of a section (an experience, a project...): a `radius-md` box with a header and a body. */
function Item({ className, ...props }: ComponentProps<'article'>) {
  return (
    <article
      className={join('flex flex-col gap-2 rounded-md border border-border px-4 py-3', className)}
      {...props}
    />
  );
}

export type FormPageItemHeaderProps = ComponentProps<'div'> & {
  /** The grip that moves the item, at the left; the caller passes a `Sortable.Handle`. */
  handle?: ReactNode;
  /** The controls at the right, such as the edit and expand buttons. */
  actions?: ReactNode;
};

/** The header of an item: the handle, the title and subtitle the caller composes, and the actions. */
function ItemHeader({ handle, actions, className, children, ...props }: FormPageItemHeaderProps) {
  return (
    <div className={join('flex items-center gap-2', className)} {...props}>
      {handle}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {actions === undefined ? null : <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

/** What an item shows when it is open: its fields or its list. */
function ItemBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={join('flex flex-col gap-2', className)} {...props} />;
}

/** The bar with the actions of the page, on a row of its own and fixed to the bottom while scrolling. */
function Actions({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={join(
        'sticky bottom-0 flex w-full flex-wrap items-center justify-end gap-2 border-t border-border bg-surface py-3',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Archetype for long editing (PRU-07): an index of sections (`Index` with an `IndexLink` each), the
 * sections in a 720px reading column (with `Item`s that carry a handle, a header and a body) and the
 * actions, inside the main landmark.
 */
export const FormPage = { Root, Index, IndexLink, Content, Section, Item, ItemHeader, ItemBody, Actions };
