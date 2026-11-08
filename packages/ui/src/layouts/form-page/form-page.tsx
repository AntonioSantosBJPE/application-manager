import { type ComponentProps, type ReactNode, useId } from 'react';

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
 * Archetype for long editing (PRU-07): an index of sections, the sections in a 720px reading column
 * and the actions, inside the main landmark.
 */
export const FormPage = { Root, Index, Content, Section, Actions };
