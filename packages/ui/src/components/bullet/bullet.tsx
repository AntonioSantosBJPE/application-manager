import { TriangleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '../../icons/icon';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type BulletRootProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** The grip at the left, such as a `Sortable.Handle`; the column is 16px wide whether or not it is there. */
  handle?: ReactNode;
  /** What sits at the right end: a menu (`Bullet.Actions`) or a notice (`Bullet.Notice`). */
  aside?: ReactNode;
  /** The text and the tags, as `Bullet.Text` and `Bullet.Tags`. */
  children?: ReactNode;
};

/**
 * A bullet of the resume (PRU-07), as the card draws it: three columns, the handle, the content and the
 * area at the right, `radius-sm`, with the `surface-hover` fill under the pointer or the focus.
 */
function Root({ handle, aside, className, children, ...props }: BulletRootProps) {
  return (
    <div
      className={join(
        'group/bullet grid grid-cols-[1rem_minmax(0,1fr)_auto] items-start gap-x-2 rounded-sm px-2 py-1.5',
        'transition-colors duration-150 hover:bg-surface-hover focus-within:bg-surface-hover',
        className,
      )}
      {...props}
    >
      <div className="mt-0.5 flex min-h-5.5 items-center">{handle}</div>
      <div className="min-w-0">{children}</div>
      {aside === undefined ? null : <div className="flex min-h-5.5 items-center">{aside}</div>}
    </div>
  );
}

/** The sentence of the bullet, in `body-lg`. */
function Text({ className, ...props }: ComponentProps<'p'>) {
  return <p className={join('text-body-lg', className)} {...props} />;
}

/** The row of skill tags below the text; the caller puts `SkillTag`s in it, and it draws nothing when empty. */
function Tags({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={join('mt-1 flex flex-wrap gap-1 empty:hidden', className)} {...props}>
      {children}
    </div>
  );
}

export type BulletActionsProps = ComponentProps<'div'> & {
  /** Keeps the menu in view at rest; without it, a wide screen shows it only under the pointer or the focus. */
  alwaysVisible?: boolean;
};

/**
 * The menu area at the right. On a wide screen it shows while the pointer is over the bullet or the
 * focus is inside it (or at rest, with `alwaysVisible`), and it is always there on a touch screen; the
 * caller puts the menu button in it.
 */
function Actions({ alwaysVisible = false, className, ...props }: BulletActionsProps) {
  return (
    <div
      className={join(
        'flex items-center gap-1',
        alwaysVisible
          ? undefined
          : 'transition-opacity duration-150 md:opacity-0 md:group-hover/bullet:opacity-100 md:group-focus-within/bullet:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

/** A warning at the right end ("sem skill"): the triangle and the caller's words, in `warning`. */
function Notice({ className, children, ...props }: ComponentProps<'span'>) {
  return (
    <span className={join('inline-flex items-center gap-1 text-caption text-warning', className)} {...props}>
      <Icon icon={TriangleAlert} size="sm" />
      {children}
    </span>
  );
}

/** A bullet of the resume: the sentence, its skills, a handle and an area for a menu or a notice. */
export const Bullet = { Root, Text, Tags, Actions, Notice };
