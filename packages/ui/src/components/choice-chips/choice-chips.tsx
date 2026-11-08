import { useContext, useRef } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { FieldContext, join } from '../field/field-context';

export type ChoiceChipOption = {
  /** Identifies the option; what the caller keeps when it is chosen. */
  value: string;
  /** What the person reads on the chip. */
  label: ReactNode;
};

export type ChoiceChipsProps = Omit<
  ComponentProps<'div'>,
  'role' | 'onChange' | 'children' | 'defaultValue'
> & {
  /** The chips, in order. */
  options: readonly ChoiceChipOption[];
  /** The chosen option, or `null` when none is chosen yet. The caller owns it. */
  value: string | null;
  /** Called with the value of the option the person chose, by click or by the arrows. */
  onValueChange: (value: string) => void;
};

/**
 * A single choice drawn as chips (APP-57, APP-72), in the WAI-ARIA radio group pattern: the container is
 * a `radiogroup` and each chip a `radio` with `aria-checked`. The group is one tab stop (the chosen chip,
 * or the first when none is chosen); the arrows move to the next or previous chip, wrapping around, and
 * choose it. The look is the `FilterChip`: 26px, `caption`, `border-strong`; chosen it turns to
 * `surface-hover` with `border-control`. The caller names the group (`aria-label` or `aria-labelledby`);
 * inside a `Field.Root` it takes the description and the invalid state from it, and the chips draw the
 * `danger` border while it is invalid.
 */
export function ChoiceChips({
  options,
  value,
  onValueChange,
  className,
  onKeyDown,
  ...props
}: ChoiceChipsProps) {
  const field = useContext(FieldContext);
  const group = useRef<HTMLDivElement>(null);
  const invalid = field?.invalid ?? false;
  const chosen = options.findIndex((option) => option.value === value);
  const tabbable = chosen === -1 ? 0 : chosen;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || options.length === 0) return;
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !backward) return;
    const radios = group.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    if (radios === undefined) return;
    const current = [...radios].findIndex((radio) => radio === document.activeElement);
    if (current === -1) return;
    event.preventDefault();
    const next = (current + (forward ? 1 : -1) + options.length) % options.length;
    onValueChange(options[next]!.value);
    radios[next]?.focus();
  }

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-describedby={field?.describedBy}
      aria-invalid={invalid || undefined}
      className={join('flex flex-wrap items-center gap-1', className)}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {options.map((option, index) => {
        const checked = index === chosen;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabbable ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={join(
              'inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-sm border px-2 text-caption whitespace-nowrap',
              'transition-colors duration-150',
              checked
                ? 'border-border-control bg-surface-hover text-text'
                : 'bg-surface text-text-muted hover:bg-surface-hover hover:text-text',
              checked ? undefined : invalid ? 'border-danger' : 'border-border-strong',
              'outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
