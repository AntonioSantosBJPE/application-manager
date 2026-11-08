import { aliasRequestSchema, skillTextSchema, type Alias, type AliasRequest } from '@am/contracts';
import { Alert, Button, Field } from '@am/ui';
import { useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import { MESSAGES } from '../../identity';
import type { Outcome } from '../../../lib/bff';
import { SKILLS_MESSAGES } from '../model/messages';
import { fieldFailureOf } from '../model/save-failure';

export interface AliasInputProps {
  /** The name of the field: visible above it, or only for assistive technology with `labelHidden`. */
  label: string;
  labelHidden?: boolean;
  initial?: string;
  submitLabel: string;
  /** Saves the alias; the dialog calls the api and shows the answer on the list and on the row. */
  onSubmit: (body: AliasRequest) => Promise<Outcome<Alias>>;
  /** The save went through. */
  onSaved: () => void;
  /** Shows a "Cancelar" button that calls this; the edit in place uses it, the add form does not. */
  onCancel?: () => void;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
  autoFocus?: boolean;
  /** Set on the field so a caller can find it to move the focus there. */
  controlId?: string;
}

/**
 * One alias field with its own submit (SKL-75, SKL-74): the contract checks the text before the call; a
 * `409` stays on the field as "Esse apelido já pertence a outra skill." and a `400` as the rule of the
 * text, and the field stays open. While the call runs the button is disabled and busy (SKL-50).
 */
export function AliasInput({
  label,
  labelHidden = false,
  initial = '',
  submitLabel,
  onSubmit,
  onSaved,
  onCancel,
  onExpired,
  autoFocus = false,
  controlId,
}: AliasInputProps) {
  const generated = useId();
  const id = controlId ?? generated;
  const [serverError, setServerError] = useState<string | undefined>();
  const [unavailable, setUnavailable] = useState(false);

  const form = useForm({
    defaultValues: { alias: initial },
    onSubmit: async ({ value, formApi }) => {
      setServerError(undefined);
      setUnavailable(false);
      let outcome: Outcome<Alias>;
      try {
        outcome = await onSubmit(aliasRequestSchema.parse(value));
      } catch {
        setUnavailable(true);
        return;
      }
      if (outcome.ok) {
        formApi.reset();
        onSaved();
        return;
      }
      if (onExpired(outcome)) return;
      const failure = fieldFailureOf(outcome, {
        conflict: { field: 'alias', message: SKILLS_MESSAGES.aliasConflict },
        fields: ['alias'],
        defaultField: 'alias',
      });
      if (failure === undefined) setUnavailable(true);
      else setServerError(failure.message);
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (form.state.isSubmitting) return;
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="alias"
        validators={{
          onSubmit: ({ value }) =>
            skillTextSchema.safeParse(value).success ? undefined : SKILLS_MESSAGES.invalidText,
        }}
      >
        {(field) => (
          <Field.Root invalid={field.state.meta.errors.length > 0 || serverError !== undefined}>
            {labelHidden ? null : <Field.Label htmlFor={id}>{label}</Field.Label>}
            <Field.Control
              id={id}
              aria-label={labelHidden ? label : undefined}
              autoComplete="off"
              autoFocus={autoFocus}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => {
                setServerError(undefined);
                field.handleChange(event.target.value);
              }}
            />
            <Field.Error>{serverError ?? field.state.meta.errors.map(String).join(' ')}</Field.Error>
          </Field.Root>
        )}
      </form.Field>
      {unavailable ? <Alert intent="danger">{MESSAGES.unavailable}</Alert> : null}
      <div className="flex gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <>
              <Button
                type="submit"
                intent="secondary"
                size="sm"
                disabled={isSubmitting}
                aria-busy={isSubmitting ? true : undefined}
              >
                {submitLabel}
              </Button>
              {onCancel === undefined ? null : (
                <Button intent="ghost" size="sm" disabled={isSubmitting} onClick={onCancel}>
                  {SKILLS_MESSAGES.cancel}
                </Button>
              )}
            </>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
