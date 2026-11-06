import { createContext, useContext, useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';

type FieldContextValue = {
  /** Ids of the elements that describe the control: the hint, plus the error when invalid. */
  describedBy: string;
  hintId: string;
  errorId: string;
  invalid: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

function useField(part: string): FieldContextValue {
  const value = useContext(FieldContext);
  if (value === null) throw new globalThis.Error(`Field.${part} needs a Field.Root above it.`);
  return value;
}

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type FieldRootProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** Marks the control invalid and swaps the hint for the error as the description. */
  invalid?: boolean;
  children?: ReactNode;
};

/** Owns `invalid` and generates the ids that tie the control to its hint and its error. */
function FieldRoot({ invalid = false, className, children, ...props }: FieldRootProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Without an error there is nothing to point at, so only the hint describes the control.
  const describedBy = invalid ? `${hintId} ${errorId}` : hintId;

  return (
    <FieldContext.Provider value={{ describedBy, hintId, errorId, invalid }}>
      <div className={join('flex flex-col gap-1', className)} {...props}>
        {children}
      </div>
    </FieldContext.Provider>
  );
}

function FieldLabel({ className, ...props }: ComponentProps<'label'>) {
  return <label className={join('text-xs font-medium text-text', className)} {...props} />;
}

/** The form control; carries `aria-describedby` and `aria-invalid` without the caller wiring ids. */
function FieldControl({ className, ...props }: ComponentProps<'input'>) {
  const { describedBy, invalid } = useField('Control');

  return (
    <input
      className={join(
        'h-8 rounded-sm border bg-surface px-2 text-xs text-text',
        invalid ? 'border-danger' : 'border-border',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  const { hintId } = useField('Hint');

  return <p id={hintId} className={join('text-xs text-text-muted', className)} {...props} />;
}

/** Renders only while the field is invalid, so the error never competes with the hint. */
function FieldError({ className, ...props }: ComponentProps<'p'>) {
  const { errorId, invalid } = useField('Error');

  if (!invalid) return null;

  return <p id={errorId} className={join('text-xs text-danger', className)} {...props} />;
}

/**
 * Compound field (UI-21, UI-22). `Field.Root` owns `invalid` and generates the ids; `Label`,
 * `Control`, `Hint` and `Error` read them from context, so the caller never repeats an id and
 * the control always describes itself with the hint and, when invalid, with the error too.
 */
export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Control: FieldControl,
  Hint: FieldHint,
  Error: FieldError,
};
