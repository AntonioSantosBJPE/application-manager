import { NOTE_MAX_LENGTH, type CreateEventRequest, type Stage } from '@am/contracts';
import { Alert, Button, ChoiceChips, Dialog, Field } from '@am/ui';
import { useId, useState } from 'react';
import { dayOf } from '../model/dates';
import { STAGE_LABELS, STAGE_ORDER } from '../model/labels';
import { STAGE_MESSAGES } from '../model/messages';
import { stageOccurredAt } from '../model/stage-date';

export interface StageDialogProps {
  /** The instant "today" is counted from: the default day and the last one that can be picked. */
  now: Date;
  /** Records the stage; answers whether it was recorded, so the dialog closes only then (APP-72). */
  onSave: (body: Extract<CreateEventRequest, { kind: 'stage' }>) => Promise<boolean>;
  /** Why the last attempt failed, shown inside the dialog. */
  failure?: string;
  onClose: () => void;
  /** Where the focus goes once the dialog closes. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * "+ Etapa" (APP-72): the type of the stage as one choice of Triagem, RH, Técnica, Case or Outra, the
 * day (today by default, never later than today) and an optional note. The stage lands on the timeline
 * at its day. While the request runs the button is disabled, so a double click records one stage.
 */
export function StageDialog({ now, onSave, failure, onClose, onCloseAutoFocus }: StageDialogProps) {
  const id = useId();
  const today = dayOf(now);
  const [stage, setStage] = useState<Stage | null>(null);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ stage?: string; day?: string }>({});
  const [sending, setSending] = useState(false);

  async function submit() {
    if (sending) return;
    const next = {
      stage: stage === null ? STAGE_MESSAGES.stageRequired : undefined,
      day: day === '' || day > today ? STAGE_MESSAGES.dayInvalid : undefined,
    };
    setErrors(next);
    if (stage === null || next.day !== undefined) return;
    setSending(true);
    const text = note.trim();
    const saved = await onSave({
      kind: 'stage',
      stage,
      ...(text === '' ? {} : { note: text }),
      occurredAt: stageOccurredAt(day, now),
    });
    setSending(false);
    if (saved) onClose();
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !sending) onClose();
      }}
    >
      <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
        <Dialog.Title>{STAGE_MESSAGES.title}</Dialog.Title>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field.Root invalid={errors.stage !== undefined}>
            <span id={`${id}-stage`} className="text-label text-text">
              {STAGE_MESSAGES.stage}
            </span>
            <ChoiceChips
              aria-labelledby={`${id}-stage`}
              options={STAGE_ORDER.map((item) => ({ value: item, label: STAGE_LABELS[item] }))}
              value={stage}
              onValueChange={(value) => {
                setStage(value as Stage);
                setErrors((current) => ({ ...current, stage: undefined }));
              }}
            />
            <Field.Error>{errors.stage}</Field.Error>
          </Field.Root>
          <Field.Root invalid={errors.day !== undefined}>
            <Field.Label htmlFor={`${id}-day`}>{STAGE_MESSAGES.day}</Field.Label>
            <Field.Control
              id={`${id}-day`}
              type="date"
              max={today}
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                setErrors((current) => ({ ...current, day: undefined }));
              }}
            />
            <Field.Error>{errors.day}</Field.Error>
          </Field.Root>
          <Field.Root>
            <Field.Label htmlFor={`${id}-note`}>
              {STAGE_MESSAGES.note} <span className="font-normal text-text-muted">{STAGE_MESSAGES.noteHint}</span>
            </Field.Label>
            <Field.Textarea
              id={`${id}-note`}
              rows={2}
              maxLength={NOTE_MAX_LENGTH}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field.Root>
          {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button intent="secondary" disabled={sending}>
                {STAGE_MESSAGES.cancel}
              </Button>
            </Dialog.Close>
            <Button type="submit" intent="primary" disabled={sending} aria-busy={sending ? true : undefined}>
              {STAGE_MESSAGES.confirm}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
