import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { Button, type ButtonProps } from '../../components/button';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** The page: a `main` with `space-6` of padding, as wide as 1120px. */
function Root({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="dashboard"
      className={join(
        'flex w-full max-w-content flex-col gap-6 bg-surface p-6 text-text',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The head of the page: the caller writes the `h1` in `heading-lg` and, under it, a context line in
 * `text-muted`.
 */
function Header({ className, ...props }: ComponentProps<'header'>) {
  return <header className={join('flex flex-col gap-1', className)} {...props} />;
}

/** 12 columns from `md` up, one `space-4` apart; below `md` the widgets stack in one column. */
function Grid({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={join('grid grid-cols-1 gap-4 md:grid-cols-12', className)} {...props} />
  );
}

const widgetVariants = cva(
  'flex min-w-0 flex-col gap-3 rounded-md border border-border bg-surface p-4',
  {
    variants: {
      /** How many of the 12 columns the widget takes from `md` up. */
      span: {
        3: 'md:col-span-3',
        4: 'md:col-span-4',
        5: 'md:col-span-5',
        6: 'md:col-span-6',
        7: 'md:col-span-7',
        8: 'md:col-span-8',
        12: 'md:col-span-12',
      },
    },
    defaultVariants: { span: 12 },
  },
);

export type DashboardWidgetProps = ComponentProps<'section'> &
  VariantProps<typeof widgetVariants>;

/** A panel of the grid on `surface`, with a `border`, `radius-md` and `space-4` of padding. */
function WidgetRoot({ span, className, ...props }: DashboardWidgetProps) {
  return <section className={widgetVariants({ span, className })} {...props} />;
}

/** The top of a widget: the title at the left and an optional action at the right. */
function WidgetHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={join('flex items-center justify-between gap-2', className)} {...props} />
  );
}

/** The title of a widget, in `heading-sm`. */
function WidgetTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={join('text-heading-sm', className)} {...props} />;
}

/** The `ghost` action of a widget (it leads somewhere); `asChild` hands it to a link. */
function WidgetAction(props: Omit<ButtonProps, 'intent' | 'size'>) {
  return <Button intent="ghost" size="sm" {...props} />;
}

const Widget = Object.assign(WidgetRoot, {
  Header: WidgetHeader,
  Title: WidgetTitle,
  Action: WidgetAction,
});

/** Archetype for insight pages (PRU-04): a header and a 12-column grid of widgets in the main landmark. */
export const DashboardPage = { Root, Header, Grid, Widget };
