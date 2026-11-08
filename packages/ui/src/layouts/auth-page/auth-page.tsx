import type { ComponentProps } from 'react';
import { Logo } from '../../components/logo';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * The page: a `main` on `surface` with one column of `auth-max` (360px) a little above the center.
 * Whatever the caller puts inside lands in that column, one `space-6` apart.
 */
function Root({ className, children, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="auth"
      className={join(
        // The bottom padding is larger than the top one, which lifts the column above the center.
        'flex min-h-screen flex-col items-center justify-center bg-surface px-6 pt-6 pb-24 text-text',
        className,
      )}
      {...props}
    >
      <div className="flex w-full max-w-auth flex-col gap-6">{children}</div>
    </main>
  );
}

/**
 * The mark of the product at 20px, then what the caller composes: the title (`heading-xl`) and a
 * line in `text-muted`.
 */
function Header({ className, children, ...props }: ComponentProps<'header'>) {
  return (
    <header className={join('flex flex-col gap-3', className)} {...props}>
      <Logo variant="mark" size={20} />
      <div className="flex flex-col gap-1">{children}</div>
    </header>
  );
}

/** The fields, one `space-4` apart; a button placed straight inside takes the full width. */
function Form({ className, ...props }: ComponentProps<'form'>) {
  return <form className={join('flex w-full flex-col gap-4', className)} {...props} />;
}

/** A rule and a note in `caption`, `text-muted`. */
function Footer({ className, ...props }: ComponentProps<'footer'>) {
  return (
    <footer
      className={join(
        'w-full border-t border-border pt-4 text-caption text-text-muted',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Archetype for the entry screens (PRU-04): a 360px column inside the main landmark, with no card
 * and no hero. Alerts go between the header and the first field.
 */
export const AuthPage = { Root, Header, Form, Footer };
