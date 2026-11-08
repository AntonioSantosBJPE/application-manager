import {
  skillTextSchema,
  type AdminSkill,
  type Skill,
  type SkillCategory,
  type UpdateSkillRequest,
} from '@am/contracts';
import { Alert, Button, Dialog, Field, FilterChip } from '@am/ui';
import { useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import { MESSAGES } from '../../identity';
import type { Outcome } from '../../../lib/bff';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../model/categories';
import { SKILLS_MESSAGES } from '../model/messages';
import { fieldFailureOf, type FieldFailure } from '../model/save-failure';

export interface EditSkillDialogProps {
  skill: AdminSkill;
  /** Sends the changed fields; the catalog calls the api and shows the answer on the row (SKL-72). */
  onSave: (body: UpdateSkillRequest) => Promise<Outcome<Skill>>;
  /** The dialog is done: saved, cancelled or closed with Esc. */
  onClose: () => void;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** Where the focus goes once the dialog closes; the catalog sends it back to the row menu. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * "Editar skill" (SKL-72, SKL-73): the name and the category of a global skill, filled with the current
 * values. The contract checks the name before the call; a `409` or `400` from the api lands on the field
 * it belongs to and the dialog stays open. While the call runs the save button is disabled and busy
 * (SKL-50), so a second click sends nothing.
 */
export function EditSkillDialog({ skill, onSave, onClose, onExpired, onCloseAutoFocus }: EditSkillDialogProps) {
  const id = useId();
  const [failure, setFailure] = useState<FieldFailure | undefined>();
  const [unavailable, setUnavailable] = useState(false);

  const form = useForm({
    defaultValues: { name: skill.name, category: skill.category as SkillCategory },
    onSubmit: async ({ value }) => {
      setFailure(undefined);
      setUnavailable(false);
      const name = skillTextSchema.parse(value.name);
      const body: UpdateSkillRequest = {};
      if (name !== skill.name) body.name = name;
      if (value.category !== skill.category) body.category = value.category;
      if (body.name === undefined && body.category === undefined) {
        onClose();
        return;
      }
      let outcome: Outcome<Skill>;
      try {
        outcome = await onSave(body);
      } catch {
        setUnavailable(true);
        return;
      }
      if (outcome.ok) {
        onClose();
        return;
      }
      if (onExpired(outcome)) return;
      const field = fieldFailureOf(outcome, {
        conflict: { field: 'name', message: SKILLS_MESSAGES.nameConflict },
        fields: ['name', 'category'],
        defaultField: 'name',
      });
      if (field === undefined) setUnavailable(true);
      else setFailure(field);
    },
  });

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !form.state.isSubmitting) onClose();
      }}
    >
      <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <Dialog.Title>{SKILLS_MESSAGES.editTitle}</Dialog.Title>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (form.state.isSubmitting) return;
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="name"
            validators={{
              onSubmit: ({ value }) =>
                skillTextSchema.safeParse(value).success ? undefined : SKILLS_MESSAGES.invalidText,
            }}
          >
            {(field) => {
              const serverError = failure?.field === 'name' ? failure.message : undefined;
              return (
                <Field.Root invalid={field.state.meta.errors.length > 0 || serverError !== undefined}>
                  <Field.Label htmlFor={`${id}-name`}>Nome</Field.Label>
                  <Field.Control
                    id={`${id}-name`}
                    autoComplete="off"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      setFailure(undefined);
                      field.handleChange(event.target.value);
                    }}
                  />
                  <Field.Error>{serverError ?? field.state.meta.errors.map(String).join(' ')}</Field.Error>
                </Field.Root>
              );
            }}
          </form.Field>
          <form.Field name="category">
            {(field) => (
              <div className="flex flex-col gap-1">
                <span id={`${id}-category`} className="text-label text-text">
                  Categoria
                </span>
                <div role="group" aria-labelledby={`${id}-category`} className="flex flex-wrap gap-1">
                  {CATEGORY_ORDER.map((category) => (
                    <FilterChip
                      key={category}
                      pressed={field.state.value === category}
                      onClick={() => {
                        setFailure(undefined);
                        field.handleChange(category);
                      }}
                    >
                      {CATEGORY_LABELS[category]}
                    </FilterChip>
                  ))}
                </div>
                {failure?.field === 'category' ? (
                  <p className="text-caption text-danger">{failure.message}</p>
                ) : null}
              </div>
            )}
          </form.Field>
          {unavailable ? <Alert intent="danger">{MESSAGES.unavailable}</Alert> : null}
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button intent="secondary" disabled={form.state.isSubmitting}>
                {SKILLS_MESSAGES.cancel}
              </Button>
            </Dialog.Close>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  intent="primary"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting ? true : undefined}
                >
                  {SKILLS_MESSAGES.save}
                </Button>
              )}
            </form.Subscribe>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
