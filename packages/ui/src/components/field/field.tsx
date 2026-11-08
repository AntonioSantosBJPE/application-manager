import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Icon } from '../../icons/icon';

type FieldContextValue = {
  /**
   * Ids of the elements that describe the control right now: the hint when it is rendered,
   * plus the error when the field is invalid and the error is rendered. Absent when neither
   * part is on screen, so the attribute never points at an id that does not exist.
   */
  describedBy: string | undefined;
  hintId: string;
  errorId: string;
  invalid: boolean;
  /** Whether `Field.Hint` is rendered; the hint reports it on mount and on unmount. */
  registerHint: (present: boolean) => void;
  /** Whether `Field.Error` is rendered; the error reports it on mount and on unmount. */
  registerError: (present: boolean) => void;
};

const FieldContext = createContext<FieldContextValue | null>(null);

function useField(part: string): FieldContextValue {
  const value = useContext(FieldContext);
  if (value === null) throw new globalThis.Error(`Field.${part} needs a Field.Root above it.`);
  return value;
}

/**
 * Layout effect on the client, plain effect during server rendering. The registration has to
 * land before the paint on the client, and the server has no layout effects at all.
 */
const useRegistrationEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type FieldRootProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** Marks the control invalid and adds the error to the description. */
  invalid?: boolean;
  children?: ReactNode;
};

/** Owns `invalid` and generates the ids that tie the control to its hint and its error. */
function FieldRoot({ invalid = false, className, children, ...props }: FieldRootProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [present, setPresent] = useState({ hint: false, error: false });

  const registerHint = useCallback((value: boolean) => {
    setPresent((current) => (current.hint === value ? current : { ...current, hint: value }));
  }, []);
  const registerError = useCallback((value: boolean) => {
    setPresent((current) => (current.error === value ? current : { ...current, error: value }));
  }, []);

  const describedBy =
    [present.hint ? hintId : null, invalid && present.error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <FieldContext.Provider
      value={{ describedBy, hintId, errorId, invalid, registerHint, registerError }}
    >
      <div className={join('flex flex-col gap-1', className)} {...props}>
        {children}
      </div>
    </FieldContext.Provider>
  );
}

function FieldLabel({ className, ...props }: ComponentProps<'label'>) {
  return <label className={join('text-label text-text', className)} {...props} />;
}

/**
 * The look every text control of a field shares (PRU-02): a `border-control` border that turns
 * `danger` when invalid, a read-only fill in `surface-raised` with `text-muted`, and on keyboard
 * focus the 2px ring drawn 1px inside with the border in `focus` too (PRU-01 AC13).
 */
function controlClassName(invalid: boolean, readOnly: boolean | undefined): string {
  return join(
    'w-full min-w-0 rounded-sm border px-2 text-body placeholder:text-text-muted',
    'transition-colors duration-150',
    readOnly ? 'bg-surface-raised text-text-muted' : 'bg-surface text-text',
    invalid ? 'border-danger' : 'border-border-control hover:border-text-muted',
    'outline-focus focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-1',
  );
}

/** The form control; carries `aria-describedby` and `aria-invalid` without the caller wiring ids. */
function FieldControl({ className, readOnly, ...props }: ComponentProps<'input'>) {
  const { describedBy, invalid } = useField('Control');

  return (
    <input
      className={join('h-control-md', controlClassName(invalid, readOnly), className)}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      readOnly={readOnly}
      {...props}
    />
  );
}

/** A multi-line control with the wiring and the border of `Field.Control`, at least 88px tall. */
function FieldTextarea({ className, readOnly, ...props }: ComponentProps<'textarea'>) {
  const { describedBy, invalid } = useField('Textarea');

  return (
    <textarea
      className={join('min-h-22 resize-y py-1.5', controlClassName(invalid, readOnly), className)}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      readOnly={readOnly}
      {...props}
    />
  );
}

function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  const { hintId, registerHint } = useField('Hint');

  useRegistrationEffect(() => {
    registerHint(true);
    return () => registerHint(false);
  }, [registerHint]);

  return <p id={hintId} className={join('text-caption text-text-muted', className)} {...props} />;
}

/** Renders only while the field is invalid, so the error never competes with the hint. */
function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  const { errorId, invalid, registerError } = useField('Error');

  useRegistrationEffect(() => {
    if (!invalid) return;
    registerError(true);
    return () => registerError(false);
  }, [invalid, registerError]);

  if (!invalid) return null;

  return (
    <p
      id={errorId}
      className={join('flex items-center gap-1 text-caption text-danger', className)}
      {...props}
    >
      <Icon icon={CircleAlert} size="sm" className="shrink-0" />
      {children}
    </p>
  );
}

/**
 * Compound field (UI-21, UI-22). `Field.Root` owns `invalid` and generates the ids; `Label`,
 * `Control`, `Textarea`, `Hint` and `Error` read them from context, so the caller never repeats an id.
 * `Hint` and `Error` report that they are on screen, so the control describes itself only with
 * the elements that exist: the hint, and the error when the field is invalid.
 */
export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Control: FieldControl,
  Textarea: FieldTextarea,
  Hint: FieldHint,
  Error: FieldError,
};
