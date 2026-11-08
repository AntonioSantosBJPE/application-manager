import { useContext, useId, useState } from 'react';
import type { ComponentProps, KeyboardEvent } from 'react';
import { controlClassName, FieldContext, join } from '../field/field-context';

export type ComboboxOption = {
  /** Identifies the option; what the caller keeps when it is chosen. */
  id: string;
  /** The text the person reads and the text the field shows once the option is chosen. */
  label: string;
};

export type ComboboxProps = Omit<
  ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'onSelect' | 'role' | 'type' | 'children'
> & {
  /** The text in the field. The caller owns it, and the component searches nothing by itself. */
  query: string;
  /** The options to offer for `query`, already filtered and ordered by the caller. */
  options: readonly ComboboxOption[];
  onQueryChange: (query: string) => void;
  /** The chosen option, or `null` when none is chosen: text typed without choosing is not a value. */
  selected: ComboboxOption | null;
  /** Called with the option chosen, and with `null` when the text is edited after a choice. */
  onSelect: (option: ComboboxOption | null) => void;
  /** Classes of the wrapper that holds the input and the list, to set its width. */
  wrapperClassName?: string;
};

/**
 * A field that suggests options while the person types, in the WAI-ARIA 1.2 pattern for an editable
 * combobox with a listbox popup: the input has `role="combobox"`, `aria-expanded`, `aria-controls` and
 * `aria-activedescendant`, and the options are `role="option"` in a `listbox`. The arrows move the
 * active option, Enter chooses it, Esc closes the list. It is controlled and knows no copy; the
 * accessible name comes from the caller (`aria-label` or a `<label htmlFor>`), and inside a
 * `Field.Root` it takes the description and the invalid state from it.
 */
export function Combobox({
  query,
  options,
  onQueryChange,
  selected,
  onSelect,
  wrapperClassName,
  className,
  onKeyDown,
  onBlur,
  onFocus,
  ...props
}: ComboboxProps) {
  const field = useContext(FieldContext);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const expanded = open && options.length > 0;
  const activeOption = expanded ? options[active] : undefined;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(option: ComboboxOption) {
    onSelect(option);
    onQueryChange(option.label);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    const last = options.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (options.length === 0) return;
      event.preventDefault();
      const forward = event.key === 'ArrowDown';
      setOpen(true);
      if (!expanded) setActive(forward ? 0 : last);
      else setActive(forward ? (active >= last ? 0 : active + 1) : active <= 0 ? last : active - 1);
    } else if (event.key === 'Enter' && activeOption !== undefined) {
      // Choosing must not also submit the form around the field.
      event.preventDefault();
      choose(activeOption);
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className={join('relative', wrapperClassName)}>
      <input
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption === undefined ? undefined : optionId(active)}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        autoComplete="off"
        className={join('h-control-md', controlClassName(field?.invalid ?? false, false), className)}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          if (selected !== null) onSelect(null);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        onBlur={(event) => {
          onBlur?.(event);
          setOpen(false);
          setActive(-1);
        }}
        {...props}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!expanded}
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        className={
          expanded
            ? 'absolute top-full left-0 z-10 mt-1 flex max-h-60 w-full flex-col overflow-y-auto rounded-md border border-border-strong bg-surface-overlay p-1 text-text shadow-overlay'
            : undefined
        }
      >
        {expanded
          ? options.map((option, index) => (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                aria-selected={selected?.id === option.id}
                data-active={index === active || undefined}
                // Keeps the focus in the input: a click on an option must not blur the field first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className="flex h-7.5 cursor-pointer items-center rounded-sm px-2 text-body text-text data-active:bg-surface-hover aria-selected:font-medium"
              >
                {option.label}
              </li>
            ))
          : null}
      </ul>
    </div>
  );
}
