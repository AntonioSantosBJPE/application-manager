import type { ComponentProps } from 'react';
import { Alert } from '../alert';
import { Button } from '../button';

/** Whether the last copy attempt succeeded; the caller owns the state and the clipboard call. */
export type CopyFieldStatus = 'idle' | 'copied' | 'failed';

export type CopyFieldProps = Omit<ComponentProps<'div'>, 'children'> & {
  value: string;
  /** Runs on the copy action. The clipboard belongs to the caller, so this stays testable. */
  onCopy: () => void;
  status?: CopyFieldStatus;
  copyLabel: string;
  copiedLabel: string;
  /** Shown when the copy failed, beside the value that the user can still select. */
  failureMessage: string;
  /** Accessible name of the value, since the field has no visible label of its own. */
  valueLabel: string;
};

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * A read-only value with a copy action (UI-21). The value sits in a read-only input, so it
 * stays focusable and selectable when the clipboard fails; the caller passes the status and
 * the messages, since the component knows no product copy.
 */
export function CopyField({
  value,
  onCopy,
  status = 'idle',
  copyLabel,
  copiedLabel,
  failureMessage,
  valueLabel,
  className,
  ...props
}: CopyFieldProps) {
  return (
    <div className={join('flex flex-col gap-2', className)} {...props}>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          aria-label={valueLabel}
          className="h-8 flex-1 rounded-sm border border-border bg-surface px-2 text-xs text-text"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button intent="secondary" onClick={onCopy}>
          {status === 'copied' ? copiedLabel : copyLabel}
        </Button>
      </div>
      {status === 'failed' ? <Alert intent="danger">{failureMessage}</Alert> : null}
    </div>
  );
}
