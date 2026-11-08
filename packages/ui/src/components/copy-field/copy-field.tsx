import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../../icons/icon';
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
 * A read-only value with a copy action (UI-21, UI-25). The value sits in a read-only text box, in
 * `font-mono` on `surface-raised`, so it stays focusable and selectable when the clipboard fails;
 * after a copy the action shows the check icon with `copiedLabel` (PRU-02). The caller passes the
 * status and the messages, since the component knows no product copy.
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
      <div className="flex items-start gap-2">
        {/* A textarea, not an input: a link wider than the line wraps whole instead of being cut. */}
        <textarea
          readOnly
          rows={1}
          value={value}
          aria-label={valueLabel}
          className="field-sizing-content min-h-control-md min-w-0 flex-1 resize-none rounded-sm border border-border-control bg-surface-raised px-2 py-1.5 font-mono text-mono break-all text-text outline-focus focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-1"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button intent="secondary" className="shrink-0" onClick={onCopy}>
          {status === 'copied' ? (
            <>
              <Icon icon={Check} size="sm" />
              {copiedLabel}
            </>
          ) : (
            copyLabel
          )}
        </Button>
      </div>
      {status === 'failed' ? <Alert intent="danger">{failureMessage}</Alert> : null}
    </div>
  );
}
