import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';

function join(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** The page frame: the navigation comes before the content. */
function Root({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-archetype="shell"
      className={join('flex min-h-screen flex-col bg-surface text-text md:flex-row', className)}
      {...props}
    />
  );
}

export type AppShellSidebarProps = ComponentProps<'nav'> & {
  /** The caller names the navigation; the design system ships no product copy of its own. */
  'aria-label': string;
};

/**
 * Navigation column. The same classes keep it above the content on a narrow screen and
 * beside it from `md` up, so one markup serves both widths.
 */
function Sidebar({ className, ...props }: AppShellSidebarProps) {
  return (
    <nav
      className={join(
        'flex flex-row items-center gap-1 border-b border-border px-4 py-2 md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-2 md:py-4',
        className,
      )}
      {...props}
    />
  );
}

export type NavItemProps = ComponentProps<'a'> & {
  /** Render the child element, so the router link keeps its own navigation behavior. */
  asChild?: boolean;
  /** Marks the item of the current page. */
  current?: boolean;
};

/** One navigation entry, as a link or as the caller's own link component through `asChild`. */
function NavItem({ asChild = false, current = false, className, ...props }: NavItemProps) {
  const Component = asChild ? Slot : 'a';

  return (
    <Component
      aria-current={current ? 'page' : undefined}
      className={join(
        'rounded-sm px-2 py-1 text-xs text-text-muted hover:bg-surface-raised hover:text-text',
        'outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        current ? 'bg-surface-raised text-text' : undefined,
        className,
      )}
      {...props}
    />
  );
}

export type AppShellMainProps = ComponentProps<'main'> & {
  /**
   * Render the child element as the content area. A page archetype is already a `main`, so the
   * shell must not wrap it in a second one: the archetype stays the single main landmark.
   */
  asChild?: boolean;
};

/** The content area, filling the rest of the frame. */
function Main({ asChild = false, className, ...props }: AppShellMainProps) {
  const Component = asChild ? Slot : 'main';
  return (
    <Component
      className={join('flex min-w-0 flex-1 flex-col gap-4 px-6 py-8', className)}
      {...props}
    />
  );
}

/**
 * Application shell (UI-21, UI-22): a navigation landmark and the main landmark. On a narrow
 * screen the columns stack, navigation first; from `md` up they sit side by side.
 *
 * The document keeps exactly one `main` landmark: either `Main` renders it, or, when the content
 * is a page archetype, `Main asChild` hands the shell classes to the archetype and the archetype
 * stays the only one.
 */
export const AppShell = { Root, Sidebar, NavItem, Main };
