import type { ComponentProps, ReactElement } from 'react';

export type PipelineStatusValue =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted';

/** Color of each status, one token each. Written out so Tailwind finds every class. */
const colors: Record<PipelineStatusValue, string> = {
  saved: 'text-status-saved',
  applied: 'text-status-applied',
  interviewing: 'text-status-interviewing',
  offer: 'text-status-offer',
  accepted: 'text-status-accepted',
  rejected: 'text-status-rejected',
  withdrawn: 'text-status-withdrawn',
  ghosted: 'text-status-ghosted',
};

/** The ring every status shares: 14px, a 1.5px line inside the box. */
const ring = (props: ComponentProps<'circle'> = {}) => (
  <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" {...props} />
);

/**
 * The glyph of each status, in a 14px box (docs/design/system/prumo.md): the fill grows as the
 * process advances (dashed, empty, half, three quarters, full) and the negative endings get a mark of
 * their own (X, bar, dots). The marks inside a full circle are drawn in `surface`.
 */
const glyphs: Record<PipelineStatusValue, ReactElement> = {
  saved: ring({ strokeDasharray: '3.1 2.5' }),
  applied: ring(),
  interviewing: (
    <>
      {ring()}
      <path d="M7 7V2.75A4.25 4.25 0 0 1 7 11.25Z" fill="currentColor" />
    </>
  ),
  offer: (
    <>
      {ring()}
      <path d="M7 7V2.75A4.25 4.25 0 1 1 2.75 7Z" fill="currentColor" />
    </>
  ),
  accepted: (
    <>
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      <path
        d="M4.2 7.2 6.2 9.2 9.8 4.8"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-surface"
      />
    </>
  ),
  rejected: (
    <>
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      <path
        d="M4.5 4.5 9.5 9.5M9.5 4.5 4.5 9.5"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="stroke-surface"
      />
    </>
  ),
  withdrawn: (
    <>
      {ring()}
      <path d="M3.5 10.5 10.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  ghosted: ring({ r: 6, strokeWidth: 2, strokeDasharray: '0.01 3.14', strokeLinecap: 'round' }),
};

export type PipelineStatusProps = Omit<ComponentProps<'span'>, 'children'> & {
  status: PipelineStatusValue;
  /** The name of the status, from the caller ("Enviada"). With `iconOnly` it becomes the `aria-label`. */
  label: string;
  /** Show the icon alone, for dense rows. */
  iconOnly?: boolean;
};

/**
 * One of the eight statuses of an application (PRU-07): a 14px icon in the color of the status and
 * the label from the caller in `text`. The color is never alone: every status has its own shape and
 * its own label, so green (accepted) and red (rejected) are told apart without color.
 */
export function PipelineStatus({
  status,
  label,
  iconOnly = false,
  className,
  ...props
}: PipelineStatusProps) {
  const icon = (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      aria-hidden="true"
      data-status-icon={status}
      className={`shrink-0 ${colors[status]}`}
    >
      {glyphs[status]}
    </svg>
  );

  return (
    <span
      className={['inline-flex items-center gap-1.5 whitespace-nowrap text-body', className]
        .filter(Boolean)
        .join(' ')}
      {...(iconOnly ? { role: 'img', 'aria-label': label } : {})}
      {...props}
    >
      {icon}
      {iconOnly ? null : <span className="text-text">{label}</span>}
    </span>
  );
}
