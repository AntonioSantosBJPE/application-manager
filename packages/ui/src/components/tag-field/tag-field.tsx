import { useContext, useRef } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Combobox, type ComboboxOption, type ComboboxProps } from '../combobox';
import { FieldContext, join } from '../field/field-context';
import { SkillTag, type SkillTagVariant } from '../skill-tag';

export type TagFieldTag = {
  /** Identifies the tag; what `onRemove` hands back. */
  id: string;
  /** The name drawn on the tag. */
  label: string;
  variant: SkillTagVariant;
  /** The accessible name of the "×" of this tag, from the caller ("Remover Node.js"). */
  removeLabel: string;
};

export type TagFieldProps = Omit<ComboboxProps, 'wrapperClassName' | 'selected' | 'onSelect'> & {
  /** The tags already chosen, in order, drawn before the field. */
  tags: readonly TagFieldTag[];
  /** Called with the id of the tag to take out: its "×", or `Backspace` in the empty field (the last tag). */
  onRemove: (id: string) => void;
  /**
   * Called with the option the person chose. The tag field clears the text after it, so the caller adds
   * the tag and nothing else; the options it offers should leave out the tags already chosen.
   */
  onSelect: (option: ComboboxOption) => void;
  /** Classes of the box that holds the tags and the field, to set its width. */
  boxClassName?: string;
};

/**
 * A field of tags (APP-59): the chosen tags, each a removable `SkillTag`, followed by a `Combobox` that
 * suggests more, all in one box that looks and behaves as a single control. A click anywhere in the box
 * focuses the field; `Backspace` in the empty field removes the last tag; after a tag is removed the
 * focus is back in the field. The caller owns the tags, the query and the options, and every word,
 * including the name of each "×". The props of the `Combobox` (query, options and the accessible name) go on the field. Inside a `Field.Root` it takes the invalid state and the
 * description from it.
 */
export function TagField({
  tags,
  onRemove,
  onSelect,
  boxClassName,
  onKeyDown,
  ref,
  ...combobox
}: TagFieldProps) {
  const field = useContext(FieldContext);
  const input = useRef<HTMLInputElement | null>(null);
  const invalid = field?.invalid ?? false;
  // The Combobox follows a choice by writing the option's label in the field; a tag field wants it empty.
  const chosen = useRef<string | null>(null);

  function remove(id: string) {
    onRemove(id);
    input.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const last = tags.at(-1);
    if (event.key === 'Backspace' && combobox.query === '' && last !== undefined) {
      event.preventDefault();
      remove(last.id);
    }
  }

  function focusField(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) input.current?.focus();
  }

  return (
    <div
      // A click on the empty part of the box is a click on the field; the tags and the field handle their own.
      onClick={focusField}
      className={join(
        'relative flex min-h-control-md w-full min-w-0 flex-wrap items-center gap-1 rounded-sm border bg-surface px-1.5 py-1 text-body text-text',
        'transition-colors duration-150',
        invalid ? 'border-danger' : 'border-border-control hover:border-text-muted',
        'outline-focus focus-within:border-focus focus-within:outline-2 focus-within:-outline-offset-1',
        boxClassName,
      )}
    >
      {tags.map((tag) => (
        <SkillTag
          key={tag.id}
          variant={tag.variant}
          onRemove={() => remove(tag.id)}
          removeLabel={tag.removeLabel}
        >
          {tag.label}
        </SkillTag>
      ))}
      <Combobox
        {...combobox}
        selected={null}
        onSelect={(option) => {
          if (option === null) return;
          chosen.current = option.label;
          onSelect(option);
        }}
        onQueryChange={(query) => {
          if (chosen.current !== null && query === chosen.current) {
            chosen.current = null;
            combobox.onQueryChange('');
          } else {
            combobox.onQueryChange(query);
          }
        }}
        ref={(element) => {
          input.current = element;
          if (typeof ref === 'function') ref(element);
          else if (ref) ref.current = element;
        }}
        wrapperClassName="static! min-w-24 flex-1"
        className={join(
          'h-6! border-0! bg-transparent! px-1! outline-0! focus-visible:outline-0!',
          combobox.className,
        )}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
