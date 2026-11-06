import type { ComponentProps } from 'react';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function Root({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-archetype="auth"
      className={join(
        'flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-8 text-text',
        className,
      )}
      {...props}
    />
  );
}

function Header({ className, ...props }: ComponentProps<'header'>) {
  return <header className={join('mb-6 flex flex-col gap-1', className)} {...props} />;
}

function Form({ className, ...props }: ComponentProps<'form'>) {
  return <form className={join('flex w-full max-w-sm flex-col gap-4', className)} {...props} />;
}

function Footer({ className, ...props }: ComponentProps<'footer'>) {
  return (
    <footer
      className={join('mt-6 w-full max-w-sm border-t border-border pt-4', className)}
      {...props}
    />
  );
}

/**
 * Archetype for the entry screens (UI-21): a narrow column inside the main landmark, with no
 * card and no hero. The caller passes the title, the form and any footer note.
 */
export const AuthPage = { Root, Header, Form, Footer };
