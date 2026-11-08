import { cva } from 'class-variance-authority';
import type { ComponentProps } from 'react';

/** Where each part of the logo takes its color from, per tone (PRU-05). */
const toneVariants = {
  mark: cva('shrink-0', {
    variants: { tone: { accent: 'text-accent', text: 'text-text', surface: 'text-surface' } },
  }),
  rumo: cva('font-semibold', {
    variants: { tone: { accent: 'text-text', text: 'text-text', surface: 'text-surface' } },
  }),
  carreira: cva('font-normal', {
    variants: { tone: { accent: 'text-text-muted', text: 'text-text', surface: 'text-surface' } },
  }),
};

export type LogoTone = 'accent' | 'text' | 'surface';

export type LogoProps = Omit<ComponentProps<'span'>, 'children' | 'title'> & {
  /** `mark` is the ring alone; `wordmark` adds "rumo carreira" beside it. */
  variant: 'mark' | 'wordmark';
  /** Height of the mark in px; the wordmark text and the gap follow it. 20 by default. */
  size?: number;
  /**
   * The colors allowed by the brand: `accent` (mark in accent, "rumo" in text, "carreira" in
   * text-muted), `text` (everything in text) or `surface` (everything in surface, on an accent block).
   */
  tone?: LogoTone;
  /** Accessible name. Without it the logo is decoration and hidden from assistive technology. */
  title?: string;
};

/**
 * The Rumo Carreira mark: the status ring three quarters full, the open quarter pointing forward
 * (geometry of docs/design/system/assets/logos/rumo-mark.svg), drawn inline in `currentColor`. The
 * wordmark sets "rumo" in Geist 600 and "carreira" in Geist 400, lowercase, tracking -0.03em, half
 * a mark away from the ring. The name is the logo itself, so it is the one text this component owns.
 */
export function Logo({
  variant,
  size = 20,
  tone = 'accent',
  title,
  className,
  style,
  ...props
}: LogoProps) {
  const label = title === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title };

  return (
    <span
      className={['inline-flex items-center', className].filter(Boolean).join(' ')}
      style={{ gap: size / 2, ...style }}
      {...label}
      {...props}
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        aria-hidden="true"
        className={toneVariants.mark({ tone })}
      >
        <circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M16 16H23A7 7 0 1 1 16 9Z" fill="currentColor" />
      </svg>
      {variant === 'wordmark' ? (
        <span
          className="whitespace-nowrap"
          style={{ fontSize: size * 0.8, lineHeight: 1, letterSpacing: '-0.03em' }}
        >
          <span className={toneVariants.rumo({ tone })}>rumo</span>{' '}
          <span className={toneVariants.carreira({ tone })}>carreira</span>
        </span>
      ) : null}
    </span>
  );
}
