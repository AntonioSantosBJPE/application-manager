import { Slot, Slottable } from '@radix-ui/react-slot';
import type { LucideIcon } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { Logo } from '../../components/logo';
import { Icon } from '../../icons/icon';

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
 * Navigation column (PRU-04): 232px on `surface-raised` with a right border from `md` up. Below
 * `md` the same markup becomes a bar on top of the content: the parts sit in a row that wraps,
 * so nothing pushes the page sideways.
 */
function Sidebar({ className, ...props }: AppShellSidebarProps) {
  return (
    <nav
      className={join(
        'flex flex-row flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-surface-raised px-4 py-2',
        'md:w-sidebar md:shrink-0 md:flex-col md:flex-nowrap md:items-stretch md:gap-x-0 md:gap-y-0.5 md:border-r md:border-b-0 md:px-2 md:py-3',
        className,
      )}
      {...props}
    />
  );
}

export type AppShellBrandProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** Accessible name of the logo; without it the logo is decoration. */
  title?: string;
  /** A small tag after the wordmark, such as the area the shell belongs to. */
  tag?: ReactNode;
};

/** The top of the sidebar: the wordmark and an optional tag. */
function Brand({ title, tag, className, ...props }: AppShellBrandProps) {
  return (
    <div className={join('flex h-8 items-center gap-2 px-2 md:mb-2', className)} {...props}>
      <Logo variant="wordmark" title={title} />
      {tag === undefined ? null : <span className="text-caption text-text-muted">{tag}</span>}
    </div>
  );
}

export type AppShellSectionProps = Omit<ComponentProps<'div'>, 'title'> & {
  /** Heading of the group of items. Below `md` it stays for assistive technology only. */
  title?: ReactNode;
};

/** A group of navigation items under an optional title. */
function Section({ title, className, children, ...props }: AppShellSectionProps) {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={title === undefined ? undefined : titleId}
      className={join('flex flex-row flex-wrap gap-1 md:flex-col md:gap-0.5', className)}
      {...props}
    >
      {title === undefined ? null : (
        <span
          id={titleId}
          className="sr-only px-2 text-label text-text-muted md:not-sr-only md:pt-3 md:pb-1"
        >
          {title}
        </span>
      )}
      {children}
    </div>
  );
}

export type NavItemProps = ComponentProps<'a'> & {
  /** Render the child element, so the router link keeps its own navigation behavior. */
  asChild?: boolean;
  /** Marks the item of the current page. */
  current?: boolean;
  /** A Lucide icon shown before the label, 14px. */
  icon?: LucideIcon;
  /** A count shown at the right end, in monospace. */
  count?: ReactNode;
};

/** One navigation entry, as a link or as the caller's own link component through `asChild`. */
function NavItem({
  asChild = false,
  current = false,
  icon,
  count,
  className,
  children,
  ...props
}: NavItemProps) {
  const Component = asChild ? Slot : 'a';

  return (
    <Component
      aria-current={current ? 'page' : undefined}
      className={join(
        // The ring color is set at all times so `transition-colors` never fades it in from the label color.
        'flex h-7.5 items-center gap-2 rounded-sm px-2 text-body whitespace-nowrap outline-focus transition-colors duration-150',
        current
          ? 'bg-accent-subtle font-medium text-accent-text'
          : 'text-text-muted hover:bg-surface-hover hover:text-text',
        className,
      )}
      {...props}
    >
      {icon === undefined ? null : <Icon icon={icon} size="sm" />}
      <Slottable>{children}</Slottable>
      {count === undefined ? null : (
        <>
          {/* A real space keeps the name the reader announces as "Label 24", not "Label24"; a flex row draws no gap for it. */}
          {' '}
          <span className="ml-auto pl-2 font-mono text-caption">{count}</span>
        </>
      )}
    </Component>
  );
}

export type AppShellUserProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** The initials in the avatar, from the caller. Empty draws the circle without letters. */
  initials?: string;
  /** The person's name; a long one is cut with an ellipsis. */
  name: string;
  /** The action beside the name, such as the sign-out button; it always stays visible. */
  children?: ReactNode;
};

/** The person at the bottom of the sidebar: avatar, name and the action as the child. */
function User({ initials = '', name, className, children, ...props }: AppShellUserProps) {
  return (
    <div
      className={join(
        'ml-auto flex max-w-full min-w-0 items-center gap-2',
        'md:mt-auto md:ml-0 md:border-t md:border-border md:p-2',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-kbd font-semibold text-accent-text"
      >
        {initials}
      </span>
      <span className="min-w-0 truncate text-body">{name}</span>
      {children === undefined ? null : <span className="ml-auto flex shrink-0">{children}</span>}
    </div>
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
  return <Component className={join('flex min-w-0 flex-1 flex-col', className)} {...props} />;
}

/**
 * The bar that opens every page (PRU-04): 48px, the title or breadcrumb at the left and the page
 * actions at the right. The caller passes the two as children.
 */
function Topbar({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={join(
        'flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-6',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Application shell (PRU-04): a navigation landmark and the main landmark. Below `md` the sidebar
 * is a bar on top; from `md` up the columns sit side by side.
 *
 * The document keeps exactly one `main` landmark: either `Main` renders it, or, when the content
 * is a page archetype, `Main asChild` hands the shell classes to the archetype and the archetype
 * stays the only one.
 */
export const AppShell = { Root, Sidebar, Brand, Section, NavItem, User, Main, Topbar };
