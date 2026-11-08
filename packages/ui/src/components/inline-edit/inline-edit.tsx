import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { Field } from '../field';
import { join } from '../field/field-context';

export type InlineEditProps = Omit<
  ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'onKeyDown' | 'type' | 'children' | 'aria-label'
> & {
  /** The value saved so far. The caller owns it and updates it from `onCommit`. */
  value: string;
  /**
   * Called with the text in the field when the person confirms with `Enter` or leaves the field, once per
   * edit. It is also called when the text did not change, so the caller decides whether that is a save.
   */
  onCommit: (value: string) => void;
  /**
   * The name of the value, from the caller ("Editar local"). It is the accessible name of the field, and
   * the button reads it before the visible value ("Editar local Recife, PE"), so the name always contains
   * the text on the button (WCAG 2.5.3).
   */
  label: string;
  /**
   * Where the drawn text of a saved value starts: "https://" is not drawn in a link, so the button reads
   * "vagas.exemplo.com/1" while the accessible name keeps the whole value, and so does the edit field.
   * What comes before stays in the text for assistive technology and is cut only visually.
   */
  visibleFrom?: (value: string) => number;
  /** What the button shows while the value is empty, in `text-muted`; the caller owns the words. */
  emptyText?: ReactNode;
  /** Marks the field invalid while it is being edited, as a `Field.Root` does. */
  invalid?: boolean;
};

/**
 * A value that is edited where it stands (APP-68): a button that reads like text, and on click turns into a
 * `Field.Control` with the focus in it and the text selected. `Enter` or leaving the field calls
 * `onCommit` with the text; `Esc` drops the edit, brings back the saved value and puts the focus on the
 * button again. Both states are `control-md` tall, so the line does not jump. The props of the input
 * (`maxLength`, `placeholder`, `id`) go to the field; every word comes from the caller.
 */
export function InlineEdit({
  value,
  onCommit,
  label,
  emptyText,
  visibleFrom,
  invalid = false,
  className,
  ...inputProps
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Set once the edit is settled by Enter or Esc, so the blur that follows does not settle it again.
  const settled = useRef(false);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      button.current?.focus();
    }
  }, [editing]);

  function start() {
    settled.current = false;
    setDraft(value);
    setEditing(true);
  }

  function finish(commit: boolean, refocus: boolean) {
    if (settled.current) return;
    settled.current = true;
    restoreFocus.current = refocus;
    setEditing(false);
    if (commit) onCommit(draft);
    else setDraft(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // The field may sit inside a form; confirming the edit must not submit it.
      event.preventDefault();
      finish(true, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false, true);
    }
  }

  if (!editing) {
    const empty = value === '';
    const from = visibleFrom === undefined ? 0 : Math.min(Math.max(visibleFrom(value), 0), value.length);
    return (
      <button
        ref={button}
        type="button"
        onClick={start}
        className={join(
          'flex h-control-md w-full min-w-0 cursor-text items-center rounded-sm px-2 text-left text-body',
          'transition-colors duration-150 hover:bg-surface-hover',
          'outline-focus focus-visible:outline-2 focus-visible:-outline-offset-1',
          empty ? 'text-text-muted' : 'text-text',
          className,
        )}
      >
        <span className="sr-only">{label}</span>{' '}
        <span className="min-w-0 truncate">
          {empty ? (
            emptyText
          ) : (
            <>
              <span className="sr-only">{value.slice(0, from)}</span>
              {value.slice(from)}
            </>
          )}
        </span>
      </button>
    );
  }

  return (
    <Field.Root invalid={invalid} className={className}>
      <Field.Control
        {...inputProps}
        ref={input}
        aria-label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => finish(true, false)}
      />
    </Field.Root>
  );
}
