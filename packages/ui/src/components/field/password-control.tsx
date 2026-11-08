import { Eye, EyeOff } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ComponentProps, Ref } from 'react';
import { Icon } from '../../icons/icon';
import { Button } from '../button';
import { controlClassName, join, useField } from './field-context';

export type FieldPasswordControlProps = Omit<ComponentProps<'input'>, 'type'> & {
  /** Accessible name of the toggle while the password is hidden, such as "Mostrar senha". */
  showLabel: string;
  /** Accessible name of the toggle while the password is visible, such as "Ocultar senha". */
  hideLabel: string;
};

/** Hands the input node to the caller's ref as well as to ours. */
function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref !== null && ref !== undefined) ref.current = node;
}

/**
 * A password control with a show and hide toggle at its right end (PRU-03). The password starts
 * hidden; the toggle is a `type="button"` without a name, so it never submits the form nor goes
 * with it, and it comes right after the control in the tab order. Switching the type keeps the
 * value and the caret, and leaves `autoComplete` and the `aria-*` of the field as they are.
 */
export function FieldPasswordControl({
  showLabel,
  hideLabel,
  className,
  readOnly,
  disabled,
  ref,
  ...props
}: FieldPasswordControlProps) {
  const { describedBy, invalid } = useField('PasswordControl');
  const [visible, setVisible] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const caret = useRef<{ start: number | null; end: number | null } | null>(null);

  // A browser may move the caret when the type of an input changes; put it back where it was.
  useLayoutEffect(() => {
    const node = input.current;
    const saved = caret.current;
    caret.current = null;
    if (node === null || saved === null || saved.start === null || saved.end === null) return;
    node.setSelectionRange(saved.start, saved.end);
  }, [visible]);

  function toggle() {
    const node = input.current;
    caret.current = node === null ? null : { start: node.selectionStart, end: node.selectionEnd };
    setVisible((current) => !current);
  }

  return (
    <div className="relative flex items-center">
      <input
        ref={(node) => {
          input.current = node;
          assignRef(ref, node);
        }}
        type={visible ? 'text' : 'password'}
        className={join('h-control-md pr-9', controlClassName(invalid, readOnly), className)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        readOnly={readOnly}
        disabled={disabled}
        {...props}
      />
      <Button
        intent="ghost"
        size="sm"
        className="absolute right-0.5 w-control-sm px-0"
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        disabled={disabled}
        onClick={toggle}
      >
        <Icon icon={visible ? EyeOff : Eye} />
      </Button>
    </div>
  );
}
