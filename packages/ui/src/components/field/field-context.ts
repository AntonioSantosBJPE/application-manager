import { createContext, useContext } from 'react';

/*
 * What the parts of a field share: the context `Field.Root` provides and the look of a text
 * control. It lives apart from field.tsx so `Field.PasswordControl` reads it without an import cycle.
 */

export type FieldContextValue = {
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

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(part: string): FieldContextValue {
  const value = useContext(FieldContext);
  if (value === null) throw new globalThis.Error(`Field.${part} needs a Field.Root above it.`);
  return value;
}

export function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * The look every text control of a field shares (PRU-02): a `border-control` border that turns
 * `danger` when invalid, a read-only fill in `surface-raised` with `text-muted`, and on keyboard
 * focus the 2px ring drawn 1px inside with the border in `focus` too (PRU-01 AC13).
 */
export function controlClassName(invalid: boolean, readOnly: boolean | undefined): string {
  return join(
    'w-full min-w-0 rounded-sm border px-2 text-body placeholder:text-text-muted',
    'transition-colors duration-150',
    readOnly ? 'bg-surface-raised text-text-muted' : 'bg-surface text-text',
    invalid ? 'border-danger' : 'border-border-control hover:border-text-muted',
    'outline-focus focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-1',
  );
}
