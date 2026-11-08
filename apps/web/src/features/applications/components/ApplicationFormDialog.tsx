import {
  COMPANY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  URL_MAX_LENGTH,
  type ApplicationDetail,
  type ApplicationStatus,
  type CreateApplicationRequest,
  type JobLevel,
  type ReplaceSkillsRequest,
  type UpdateJobPostingRequest,
  type WorkModel,
} from '@am/contracts';
import { Alert, Button, ChoiceChips, Dialog, Field, Kbd } from '@am/ui';
import { useForm } from '@tanstack/react-form';
import type { KeyboardEvent } from 'react';
import { useId, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import { MESSAGES, problemMessage } from '../../identity';
import { SkillsField, type SkillsFieldApi, type SkillsFieldSkill } from '../../skills';
import { LEVEL_LABELS, LEVEL_ORDER, STATUS_LABELS, WORK_MODEL_LABELS, WORK_MODEL_ORDER } from '../model/labels';
import { FORM_MESSAGES } from '../model/messages';

/** What the form holds: the fields as typed, the level and the model as chosen, the two skill lists. */
export interface ApplicationFormValues {
  company: string;
  title: string;
  url: string;
  level: JobLevel | null;
  workModel: WorkModel | null;
  required: SkillsFieldSkill[];
  nice: SkillsFieldSkill[];
  description: string;
}

const EMPTY_VALUES: ApplicationFormValues = {
  company: '',
  title: '',
  url: '',
  level: null,
  workModel: null,
  required: [],
  nice: [],
  description: '',
};

/** What the dialog needs from the BFF; the screen binds the server functions, a test binds the api. */
export interface ApplicationFormApi {
  create: (body: CreateApplicationRequest) => Promise<Outcome<ApplicationDetail>>;
  skills: SkillsFieldApi;
}

/** What an edit changed: only the posting fields that differ, and the whole skills list when it differs (APP-74). */
export interface ApplicationChanges {
  posting?: UpdateJobPostingRequest;
  skills?: ReplaceSkillsRequest;
}

/** What the two modes need from the BFF: the creation sends a new application, the edit sends the changes. */
type ModeProps =
  | {
      mode?: 'create';
      api: ApplicationFormApi;
    }
  | {
      /** The dialog of the detail: filled with the posting, titled "Editar vaga", saving with "Salvar" (APP-74). */
      mode: 'edit';
      api: Pick<ApplicationFormApi, 'skills'>;
      /** Saves what changed; it is not called when nothing did. */
      update: (changes: ApplicationChanges) => Promise<Outcome<ApplicationDetail>>;
    };

export type ApplicationFormDialogProps = ModeProps & {
  /** The status the application enters with: "Salva", or the one of the "+" that opened the dialog (APP-58). */
  status?: ApplicationStatus;
  /** Values to start from, for a form that opens filled. */
  initial?: Partial<ApplicationFormValues>;
  /** The application was created or saved; the list reads again to show it in its group (APP-62). */
  onSaved: (application: ApplicationDetail) => void;
  /** The dialog is done: created, cancelled, Esc or the "esc" of the header (APP-65). */
  onClose: () => void;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** Where the focus goes once the dialog closes. */
  onCloseAutoFocus?: (event: Event) => void;
};

const isLink = (text: string) => /^https?:\/\/\S+$/i.test(text);

function companyError(value: string): string | undefined {
  const text = value.trim();
  if (text === '') return FORM_MESSAGES.companyRequired;
  return text.length > COMPANY_MAX_LENGTH ? FORM_MESSAGES.tooLong(COMPANY_MAX_LENGTH) : undefined;
}

function titleError(value: string): string | undefined {
  const text = value.trim();
  if (text === '') return FORM_MESSAGES.titleRequired;
  return text.length > TITLE_MAX_LENGTH ? FORM_MESSAGES.tooLong(TITLE_MAX_LENGTH) : undefined;
}

function linkError(value: string): string | undefined {
  const text = value.trim();
  if (text === '') return undefined;
  return isLink(text) && text.length <= URL_MAX_LENGTH ? undefined : FORM_MESSAGES.linkInvalid;
}

/** The request the form stands for: empty optional fields are left out, the skills keep the order of each field. */
function requestOf(values: ApplicationFormValues, level: JobLevel, status: ApplicationStatus): CreateApplicationRequest {
  const url = values.url.trim();
  const description = values.description.trim() === '' ? undefined : values.description;
  return {
    jobPosting: {
      company: values.company.trim(),
      title: values.title.trim(),
      level,
      ...(url === '' ? {} : { url }),
      ...(values.workModel === null ? {} : { workModel: values.workModel }),
      ...(description === undefined ? {} : { description }),
    },
    skills: [
      ...values.required.map((skill) => ({ skillId: skill.id, requirement: 'required' as const })),
      ...values.nice.map((skill) => ({ skillId: skill.id, requirement: 'nice_to_have' as const })),
    ],
    // "Salva" is what the api does without a status, and a status in the body writes an event.
    ...(status === 'saved' ? {} : { status }),
  };
}

const skillKeys = (values: ApplicationFormValues) =>
  [...values.required.map((skill) => `required:${skill.id}`), ...values.nice.map((skill) => `nice_to_have:${skill.id}`)];

/** What an edit changes: the posting fields that differ (an emptied optional one becomes `null`) and the skills when they differ. */
function changesOf(values: ApplicationFormValues, start: ApplicationFormValues): ApplicationChanges {
  const posting: UpdateJobPostingRequest = {};
  const company = values.company.trim();
  const title = values.title.trim();
  const url = values.url.trim();
  if (company !== start.company) posting.company = company;
  if (title !== start.title) posting.title = title;
  if (url !== start.url) posting.url = url === '' ? null : url;
  if (values.level !== null && values.level !== start.level) posting.level = values.level;
  if (values.workModel !== start.workModel) posting.workModel = values.workModel;
  if (values.description !== start.description) {
    posting.description = values.description.trim() === '' ? null : values.description;
  }
  const skillsChanged = skillKeys(values).join(',') !== skillKeys(start).join(',');
  return {
    ...(Object.keys(posting).length === 0 ? {} : { posting }),
    ...(skillsChanged
      ? {
          skills: [
            ...values.required.map((skill) => ({ skillId: skill.id, requirement: 'required' as const })),
            ...values.nice.map((skill) => ({ skillId: skill.id, requirement: 'nice_to_have' as const })),
          ],
        }
      : {}),
  };
}

/**
 * "Nova candidatura" (PageNewApplication, APP-57..APP-65): the quick registration of a posting in a
 * dialog. Company, title and level are required and the link must be http or https; those errors show
 * under their field and nothing is sent. `⌘↵` or `Ctrl+↵` creates from anywhere in the dialog. While the
 * request runs the button is disabled, so a double click sends one application. A refusal of the api
 * keeps the dialog open with what was typed and a danger `Alert`.
 */
export function ApplicationFormDialog(props: ApplicationFormDialogProps) {
  const { status = 'saved', initial, api, onSaved, onClose, onExpired, onCloseAutoFocus } = props;
  const editing = props.mode === 'edit';
  const id = useId();
  const [unavailable, setUnavailable] = useState<string | undefined>();
  // What the form opened with: an edit sends only what differs from it.
  const [start] = useState<ApplicationFormValues>(() => ({ ...EMPTY_VALUES, ...initial }));

  const form = useForm({
    defaultValues: start,
    onSubmit: async ({ value }) => {
      setUnavailable(undefined);
      if (value.level === null) return;
      let outcome: Outcome<ApplicationDetail>;
      try {
        if (props.mode === 'edit') {
          const changes = changesOf(value, start);
          if (changes.posting === undefined && changes.skills === undefined) {
            onClose();
            return;
          }
          outcome = await props.update(changes);
        } else {
          outcome = await props.api.create(requestOf(value, value.level, status));
        }
      } catch {
        setUnavailable(MESSAGES.unavailable);
        return;
      }
      if (outcome.ok) {
        onSaved(outcome.data);
        onClose();
        return;
      }
      if (onExpired(outcome)) return;
      setUnavailable(problemMessage(outcome));
    },
  });

  function submit() {
    if (form.state.isSubmitting) return;
    void form.handleSubmit();
  }

  /** `⌘↵` and `Ctrl+↵` create from any field; the capture keeps an open skills list from taking the key first. */
  function handleShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    event.stopPropagation();
    submit();
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !form.state.isSubmitting) onClose();
      }}
    >
      <Dialog.Content size="lg" aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <div className="flex items-center gap-2">
          <Dialog.Title>{editing ? FORM_MESSAGES.editTitle : FORM_MESSAGES.createTitle}</Dialog.Title>
          <Dialog.Close className="ml-auto cursor-pointer rounded-sm outline-focus focus-visible:outline-2 focus-visible:outline-offset-2">
            <Kbd>{FORM_MESSAGES.close}</Kbd>
          </Dialog.Close>
        </div>
        <form
          noValidate
          className="flex flex-col gap-4"
          onKeyDownCapture={handleShortcut}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <form.Field name="company" validators={{ onSubmit: ({ value }) => companyError(value) }}>
              {(field) => (
                <Field.Root invalid={field.state.meta.errors.length > 0}>
                  <Field.Label htmlFor={`${id}-company`}>{FORM_MESSAGES.company}</Field.Label>
                  <Field.Control
                    id={`${id}-company`}
                    autoComplete="off"
                    autoFocus
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
                </Field.Root>
              )}
            </form.Field>
            <form.Field name="title" validators={{ onSubmit: ({ value }) => titleError(value) }}>
              {(field) => (
                <Field.Root invalid={field.state.meta.errors.length > 0}>
                  <Field.Label htmlFor={`${id}-title`}>{FORM_MESSAGES.jobTitle}</Field.Label>
                  <Field.Control
                    id={`${id}-title`}
                    autoComplete="off"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
                </Field.Root>
              )}
            </form.Field>
            <form.Field name="url" validators={{ onSubmit: ({ value }) => linkError(value) }}>
              {(field) => (
                <Field.Root invalid={field.state.meta.errors.length > 0} className="sm:col-span-2">
                  <Field.Label htmlFor={`${id}-url`}>
                    {FORM_MESSAGES.link} <span className="font-normal text-text-muted">{FORM_MESSAGES.linkHint}</span>
                  </Field.Label>
                  <Field.Control
                    id={`${id}-url`}
                    autoComplete="off"
                    inputMode="url"
                    placeholder={FORM_MESSAGES.linkPlaceholder}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
                </Field.Root>
              )}
            </form.Field>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            <form.Field
              name="level"
              validators={{ onSubmit: ({ value }) => (value === null ? FORM_MESSAGES.levelRequired : undefined) }}
            >
              {(field) => (
                <Field.Root invalid={field.state.meta.errors.length > 0}>
                  <span id={`${id}-level`} className="text-label text-text">
                    {FORM_MESSAGES.level}
                  </span>
                  <ChoiceChips
                    aria-labelledby={`${id}-level`}
                    options={LEVEL_ORDER.map((level) => ({ value: level, label: LEVEL_LABELS[level] }))}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as JobLevel)}
                  />
                  <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
                </Field.Root>
              )}
            </form.Field>
            <form.Field name="workModel">
              {(field) => (
                <Field.Root>
                  <span id={`${id}-model`} className="text-label text-text">
                    {FORM_MESSAGES.workModel}
                  </span>
                  <ChoiceChips
                    aria-labelledby={`${id}-model`}
                    options={WORK_MODEL_ORDER.map((model) => ({ value: model, label: WORK_MODEL_LABELS[model] }))}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as WorkModel)}
                  />
                </Field.Root>
              )}
            </form.Field>
          </div>
          <form.Subscribe selector={(state) => ({ required: state.values.required, nice: state.values.nice })}>
            {({ required, nice }) => (
              <>
                <SkillsField
                  label={FORM_MESSAGES.requiredSkills}
                  requirement="required"
                  skills={required}
                  other={nice}
                  api={api.skills}
                  placeholder={FORM_MESSAGES.skillsPlaceholder}
                  onChange={(skills, other) => {
                    form.setFieldValue('required', skills);
                    form.setFieldValue('nice', other);
                  }}
                />
                <SkillsField
                  label={FORM_MESSAGES.niceSkills}
                  requirement="nice"
                  skills={nice}
                  other={required}
                  api={api.skills}
                  placeholder={FORM_MESSAGES.skillsPlaceholder}
                  onChange={(skills, other) => {
                    form.setFieldValue('nice', skills);
                    form.setFieldValue('required', other);
                  }}
                />
              </>
            )}
          </form.Subscribe>
          <form.Field
            name="description"
            validators={{
              onSubmit: ({ value }) =>
                value.length > DESCRIPTION_MAX_LENGTH ? FORM_MESSAGES.tooLong(DESCRIPTION_MAX_LENGTH) : undefined,
            }}
          >
            {(field) => (
              <Field.Root invalid={field.state.meta.errors.length > 0}>
                <Field.Label htmlFor={`${id}-description`}>
                  {FORM_MESSAGES.description}{' '}
                  <span className="font-normal text-text-muted">{FORM_MESSAGES.descriptionHint}</span>
                </Field.Label>
                <Field.Textarea
                  id={`${id}-description`}
                  rows={2}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <Field.Error>{field.state.meta.errors.map(String).join(' ')}</Field.Error>
              </Field.Root>
            )}
          </form.Field>
          {unavailable === undefined ? null : <Alert intent="danger">{unavailable}</Alert>}
          <Dialog.Footer className="items-center">
            <span className="mr-auto flex items-center gap-1 text-caption text-text-muted">
              {editing ? null : (
                <span>
                  {FORM_MESSAGES.enters} <b className="font-semibold text-text">{STATUS_LABELS[status]}</b>.
                </span>
              )}
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
              <span>{editing ? FORM_MESSAGES.toSave : FORM_MESSAGES.toCreate}</span>
            </span>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <>
                  <Dialog.Close asChild>
                    <Button intent="secondary" disabled={isSubmitting}>
                      {FORM_MESSAGES.cancel}
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="submit"
                    intent="primary"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting ? true : undefined}
                  >
                    {editing ? FORM_MESSAGES.save : FORM_MESSAGES.create}
                  </Button>
                </>
              )}
            </form.Subscribe>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
