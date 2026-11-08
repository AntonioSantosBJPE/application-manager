import {
  aliasRequestSchema,
  skillTextSchema,
  type AdminSkillsPage,
  type Alias,
  type AliasRequest,
} from '@am/contracts';
import { Alert, Button, Combobox, Dialog, Field, type ComboboxOption } from '@am/ui';
import { useForm } from '@tanstack/react-form';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type ReactNode } from 'react';
import { MESSAGES } from '../../identity';
import type { Outcome } from '../../../lib/bff';
import { SKILLS_MESSAGES } from '../model/messages';
import { fieldFailureOf, type FieldFailure } from '../model/save-failure';

export interface AddAliasDialogProps {
  /** The button that opens the dialog and gets the focus back when it closes. */
  trigger: ReactNode;
  /** Reads the global skills that match a text, by name or alias; the api decides which and in what order. */
  searchSkills: (q: string) => Promise<Outcome<AdminSkillsPage>>;
  /** Saves the alias; the catalog calls the api and shows the alias on the row (SKL-48). */
  onSave: (skillId: string, body: AliasRequest) => Promise<Outcome<Alias>>;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

interface FormProps extends Omit<AddAliasDialogProps, 'trigger'> {
  onDone: () => void;
  /** Tells the dialog whether the save is running, so it cannot be closed in the middle of it. */
  onBusyChange: (busy: boolean) => void;
}

function AddAliasForm({ searchSkills, onSave, onExpired, onDone, onBusyChange }: FormProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ComboboxOption | null>(null);
  const [skillError, setSkillError] = useState<string | undefined>();
  const [failure, setFailure] = useState<FieldFailure | undefined>();
  const [unavailable, setUnavailable] = useState(false);

  const suggestions = useQuery({
    queryKey: ['skills', 'search', query],
    queryFn: async () => {
      const outcome = await searchSkills(query);
      if (outcome.ok) return outcome.data.items.map((skill) => ({ id: skill.id, label: skill.name }));
      onExpired(outcome);
      throw new Error(`the skills search answered ${outcome.status}`);
    },
    placeholderData: keepPreviousData,
    retry: false,
  });

  const form = useForm({
    defaultValues: { alias: '' },
    onSubmit: async ({ value }) => {
      setFailure(undefined);
      setUnavailable(false);
      if (selected === null) return;
      let outcome: Outcome<Alias>;
      onBusyChange(true);
      try {
        outcome = await onSave(selected.id, aliasRequestSchema.parse(value));
      } catch {
        setUnavailable(true);
        return;
      } finally {
        onBusyChange(false);
      }
      if (outcome.ok) {
        onDone();
        return;
      }
      if (onExpired(outcome)) return;
      const field = fieldFailureOf(outcome, {
        conflict: { field: 'alias', message: SKILLS_MESSAGES.aliasConflict },
        fields: ['alias'],
        defaultField: 'alias',
      });
      if (field === undefined) setUnavailable(true);
      else setFailure(field);
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (form.state.isSubmitting) return;
        setSkillError(selected === null ? SKILLS_MESSAGES.chooseSkill : undefined);
        void form.handleSubmit();
      }}
    >
      <Field.Root invalid={skillError !== undefined}>
        <Field.Label htmlFor={`${id}-skill`}>Skill</Field.Label>
        <Combobox
          id={`${id}-skill`}
          query={query}
          options={suggestions.data ?? []}
          onQueryChange={(text) => {
            setSkillError(undefined);
            setQuery(text);
          }}
          selected={selected}
          onSelect={setSelected}
        />
        <Field.Error>{skillError}</Field.Error>
      </Field.Root>
      <form.Field
        name="alias"
        validators={{
          onSubmit: ({ value }) =>
            skillTextSchema.safeParse(value).success ? undefined : SKILLS_MESSAGES.invalidText,
        }}
      >
        {(field) => {
          const serverError = failure?.field === 'alias' ? failure.message : undefined;
          return (
            <Field.Root invalid={field.state.meta.errors.length > 0 || serverError !== undefined}>
              <Field.Label htmlFor={`${id}-alias`}>Apelido</Field.Label>
              <Field.Control
                id={`${id}-alias`}
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
  );
}

/**
 * The "Apelido" dialog of the top bar (SKL-48, SKL-49): the field "Skill" searches the global skills by
 * name or alias and asks for one to be chosen (text typed without choosing is not a skill), and the field
 * "Apelido" takes the text. A `409` or `400` lands on the field it belongs to and the dialog stays open;
 * a success closes it and the catalog shows the alias on the row. While the call runs the save button is
 * disabled and busy (SKL-50).
 */
export function AddAliasDialog({ trigger, ...form }: AddAliasDialogProps) {
  const [open, setOpen] = useState(false);
  const busy = useRef(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy.current) setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Content aria-describedby={undefined}>
        <Dialog.Title>Novo apelido</Dialog.Title>
        <AddAliasForm {...form} onBusyChange={(value) => {
            busy.current = value;
          }}
          onDone={() => setOpen(false)} />
      </Dialog.Content>
    </Dialog.Root>
  );
}
