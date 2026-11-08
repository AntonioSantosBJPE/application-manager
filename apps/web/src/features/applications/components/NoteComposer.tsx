import { NOTE_MAX_LENGTH } from '@am/contracts';
import { Button, Field } from '@am/ui';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { DETAIL_MESSAGES } from '../model/messages';

export interface NoteComposerProps {
  /** Writes the note; answers whether it was recorded, so the field clears only then (APP-71). */
  onAdd: (note: string) => Promise<boolean>;
}

/**
 * The field "Adicionar nota…" at the foot of the timeline (APP-71). The button "Adicionar nota" shows
 * once there is text, and `⌘↵` or `Ctrl+↵` sends from the field. A note that was refused stays in the
 * field, and while one is being sent a second send is ignored.
 */
export function NoteComposer({ onAdd }: NoteComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const hasText = text.trim() !== '';

  async function send() {
    if (sending || !hasText) return;
    setSending(true);
    try {
      if (await onAdd(text.trim())) setText('');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    void send();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Field.Root className="w-full">
        <Field.Textarea
          aria-label={DETAIL_MESSAGES.notePlaceholder}
          placeholder={DETAIL_MESSAGES.notePlaceholder}
          rows={2}
          maxLength={NOTE_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </Field.Root>
      {hasText ? (
        <Button intent="secondary" size="sm" disabled={sending} aria-busy={sending ? true : undefined} onClick={() => void send()}>
          {DETAIL_MESSAGES.addNote}
        </Button>
      ) : null}
    </div>
  );
}
