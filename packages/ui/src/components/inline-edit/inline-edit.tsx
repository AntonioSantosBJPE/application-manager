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
  /**
   * A sentence that wraps: the value is shown over as many lines as it needs, and it is edited in a
   * `textarea` that grows with the text. `Enter` still confirms, and a line break never enters the text
   * (typed or pasted), so it stays one paragraph. The type size is the parent's, so the caller sets it
   * (`text-body-lg`) around the field.
   */
  multiline?: boolean;
  /**
   * Checks the text before it is committed: a sentence (from the caller) keeps the field open, shows the
   * sentence under it and commits nothing; `null` lets the text through. `Esc` still drops the edit.
   */
  validate?: (value: string) => string | null;
};

/**
 * A value that is edited where it stands (APP-68): a button that reads like text, and on click turns into a
 * `Field.Control` with the focus in it and the text selected. `Enter` or leaving the field calls
 * `onCommit` with the text; `Esc` drops the edit, brings back the saved value and puts the focus on the
 * button again. Both states are `control-md` tall, so the line does not jump (`multiline` is at least that
 * tall and grows). The props of the input (`maxLength`, `placeholder`, `id`) go to the field; every word
 * comes from the caller.
 */
export function InlineEdit({
  value,
  onCommit,
  label,
  emptyText,
  visibleFrom,
  invalid = false,
  multiline = false,
  validate,
  className,
  ...inputProps
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Set once the edit is settled by Enter or Esc, so the blur that follows does not settle it again.
  const settled = useRef(false);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (editing) {
      const field = multiline ? textarea.current : input.current;
      field?.focus();
      field?.select();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      button.current?.focus();
    }
  }, [editing, multiline]);

  function start() {
    settled.current = false;
    setDraft(value);
    setProblem(null);
    setEditing(true);
  }

  function finish(commit: boolean, refocus: boolean) {
    if (settled.current) return;
    if (commit && validate !== undefined) {
      const found = validate(draft);
      if (found !== null) {
        // The edit stays open with the text as it was typed or pasted; nothing is committed.
        setProblem(found);
        return;
      }
    }
    settled.current = true;
    setProblem(null);
    restoreFocus.current = refocus;
    setEditing(false);
    if (commit) onCommit(draft);
    else setDraft(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
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
          'flex w-full min-w-0 cursor-text items-center rounded-sm px-2 text-left',
          multiline ? 'min-h-control-md border border-transparent py-1.5 break-words' : 'h-control-md text-body',
          'transition-colors duration-150 hover:bg-surface-hover',
          'outline-focus focus-visible:outline-2 focus-visible:-outline-offset-1',
          empty ? 'text-text-muted' : 'text-text',
          className,
        )}
      >
        <span className="sr-only">{label}</span>{' '}
        <span className={multiline ? 'min-w-0' : 'min-w-0 truncate'}>
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

  if (multiline) {
    return (
      <Field.Root invalid={invalid || problem !== null} className={className}>
        <Field.Textarea
          {...(inputProps as ComponentProps<'textarea'>)}
          ref={textarea}
          aria-label={label}
          rows={1}
          value={draft}
          // The styles beat the defaults of `Field.Textarea` (88px tall, resizable, `body` size); the type
          // size comes from the parent, as it does on the button, and `field-sizing` makes the box follow its text.
          style={{
            minHeight: 'var(--spacing-control-md)',
            resize: 'none',
            fontSize: 'inherit',
            lineHeight: 'inherit',
          }}
          className="field-sizing-content"
          onChange={(event) => {
            setDraft(event.target.value.replace(/\r?\n/g, ' '));
            setProblem(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => finish(true, false)}
        />
        <Field.Error>{problem}</Field.Error>
      </Field.Root>
    );
  }

  return (
    <Field.Root invalid={invalid || problem !== null} className={className}>
      <Field.Control
        {...inputProps}
        ref={input}
        aria-label={label}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setProblem(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => finish(true, false)}
      />
      <Field.Error>{problem}</Field.Error>
    </Field.Root>
  );
}
