import type { LanguageLevel, ResumeSection } from '@am/contracts';
import { ChoiceChips, Field } from '@am/ui';
import { useId } from 'react';
import type { Outcome } from '../../../lib/bff';
import { type ItemsApi, useItemForm } from '../hooks/use-item-form';
import { END_LABEL, ENDING_LABELS, ITEM_FIELDS, START_LABEL, type FieldSpec } from '../model/item-fields';
import type { CachedItemOf } from '../model/items';
import { RESUME_MESSAGES } from '../model/messages';
import { LANGUAGE_LEVEL_LABELS, LANGUAGE_LEVEL_ORDER } from '../model/sections';

export interface ItemFieldsProps<S extends ResumeSection> {
  section: S;
  /** The saved item, or nothing for a new one (RES-51). */
  item?: CachedItemOf[S];
  api: ItemsApi;
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** Called with the id when a new item was written (RES-53). */
  onCreated?: (id: string) => void;
  /** The first field takes the focus, as a new item does (RES-51). */
  autoFocus?: boolean;
}

/**
 * The fields of an item of any section, each saved when it is left (RES-54). A new item shows
 * "Preencha os campos obrigatórios para salvar." until its required fields are valid and is then created
 * (RES-52, RES-53). The box "Trabalho aqui atualmente" or "Em andamento" hides the end and saves the item
 * with no end (RES-55); an end before the start says so in the end field (RES-59).
 */
export function ItemFields<S extends ResumeSection>({
  section,
  item,
  api,
  onExpired,
  onCreated,
  autoFocus = false,
}: ItemFieldsProps<S>) {
  const form = useItemForm({ section, item, api, onExpired, onCreated });
  const id = useId();
  const ending = ENDING_LABELS[section];
  const specs = ITEM_FIELDS[section];
  const first = specs[0]?.name;

  const control = (spec: FieldSpec) => {
    const controlId = `${id}-${spec.name}`;
    const common = {
      id: controlId,
      value: form.values[spec.name] ?? '',
      onChange: (event: { target: { value: string } }) => form.setValue(spec.name, event.target.value),
      onBlur: () => void form.leave(spec.name),
      autoFocus: autoFocus && spec.name === first,
    };
    if (spec.kind === 'level') {
      const chosen = form.values[spec.name] ?? '';
      return (
        <Field.Root key={spec.name} className={spec.wide ? 'md:col-span-2' : undefined}>
          <span id={`${controlId}-label`} className="text-label text-text">
            {spec.label}
          </span>
          <ChoiceChips
            aria-labelledby={`${controlId}-label`}
            options={LANGUAGE_LEVEL_ORDER.map((level: LanguageLevel) => ({
              value: level,
              label: LANGUAGE_LEVEL_LABELS[level],
            }))}
            value={chosen === '' ? null : chosen}
            onValueChange={(value) => {
              form.setValue(spec.name, value);
              void form.leave(spec.name, { [spec.name]: value });
            }}
          />
          <Field.Error>{form.errors[spec.name]}</Field.Error>
        </Field.Root>
      );
    }
    return (
      <Field.Root
        key={spec.name}
        invalid={form.errors[spec.name] !== undefined}
        className={spec.wide ? 'md:col-span-2' : undefined}
      >
        <Field.Label htmlFor={controlId}>{spec.label}</Field.Label>
        {spec.kind === 'textarea' ? (
          <Field.Textarea {...common} rows={3} />
        ) : (
          <Field.Control {...common} type={spec.kind === 'month' ? 'month' : 'text'} />
        )}
        <Field.Error>{form.errors[spec.name]}</Field.Error>
      </Field.Root>
    );
  };

  const dateField = (name: 'startDate' | 'endDate', label: string) => (
    <Field.Root key={name} invalid={form.errors[name] !== undefined}>
      <Field.Label htmlFor={`${id}-${name}`}>{label}</Field.Label>
      <Field.Control
        id={`${id}-${name}`}
        type="month"
        value={form.values[name] ?? ''}
        onChange={(event) => form.setValue(name, event.target.value)}
        onBlur={() => void form.leave(name)}
      />
      <Field.Error>{form.errors[name]}</Field.Error>
    </Field.Root>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {specs.map(control)}
        {ending === undefined ? null : (
          <>
            {dateField('startDate', START_LABEL)}
            {form.values.current === '1' ? null : dateField('endDate', END_LABEL)}
            <Field.Root className="md:col-span-2">
              <div className="flex items-center gap-2">
                <Field.Control
                  id={`${id}-current`}
                  type="checkbox"
                  checked={form.values.current === '1'}
                  onChange={(event) => {
                    const on = event.target.checked;
                    form.setValue('current', on ? '1' : '');
                    if (on) void form.leave('current', { current: '1' });
                  }}
                  className="size-4 w-4! px-0!"
                />
                <Field.Label htmlFor={`${id}-current`}>{ending}</Field.Label>
              </div>
            </Field.Root>
          </>
        )}
      </div>
      {form.needsRequired ? <p className="text-caption text-text-muted">{RESUME_MESSAGES.requiredToSave}</p> : null}
    </div>
  );
}
