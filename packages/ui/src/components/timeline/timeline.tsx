import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Icon } from '../../icons/icon';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** The list of events, newest first or oldest first as the caller orders them: a semantic `ol`. */
function Root({ className, ...props }: ComponentProps<'ol'>) {
  return <ol className={join('flex flex-col', className)} {...props} />;
}

export type TimelineItemProps = Omit<ComponentProps<'li'>, 'children'> & {
  /** A Lucide icon in the 20px column, 14px in `text-muted`; decorative, so it is hidden from assistive technology. */
  icon?: LucideIcon;
  /** A custom glyph for that column (a status ring, for instance), when no Lucide icon fits; also decorative. */
  marker?: ReactNode;
  /** The date of the event, in `font-mono` at the right; the caller formats it. */
  date?: ReactNode;
  /** What happened, in `text-muted`; wrap the key words in `Timeline.Emphasis` to bring them to `text`. */
  children?: ReactNode;
};

/**
 * One event: the icon column, the text and the date. A 1px line in `border` runs from the icon down to
 * the next item and is left out after the last one, so it only ever links two events. The words come
 * from the caller; the icon says nothing a screen reader needs, so the text carries the meaning.
 */
function Item({ icon, marker, date, className, children, ...props }: TimelineItemProps) {
  return (
    <li
      className={join(
        'relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 py-1.5 text-body',
        'before:absolute before:top-6.5 before:-bottom-1.5 before:left-2.375 before:w-px before:bg-border last:before:hidden',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="flex size-5 items-center justify-center text-text-muted">
        {icon === undefined ? marker : <Icon icon={icon} size="sm" />}
      </span>
      <span className="min-w-0 text-text-muted wrap-anywhere">
        {children}
      </span>
      {date === undefined ? null : (
        <span className="font-mono text-caption leading-5 whitespace-nowrap text-text-muted">{date}</span>
      )}
    </li>
  );
}

/** The key words of an event: `text` at weight 500 inside the muted sentence. */
function Emphasis({ className, ...props }: ComponentProps<'b'>) {
  return <b className={join('font-medium text-text', className)} {...props} />;
}

/** The history of an application (APP-70): events with an icon, a line between them and the date in `mono`. */
export const Timeline = { Root, Item, Emphasis };
