import type { ApplicationEvent } from '@am/contracts';
import { PipelineStatus, Timeline } from '@am/ui';
import { MessageSquare, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { shortDate } from '../model/dates';
import { STAGE_LABELS, STATUS_LABELS } from '../model/labels';
import { DETAIL_MESSAGES } from '../model/messages';

export interface ApplicationTimelineProps {
  /** The events as the api sends them: newest first (APP-70). */
  events: readonly ApplicationEvent[];
  /** The registration date, which is the last entry, "Vaga cadastrada". */
  createdAt: string;
}

/** What one event says: "Status Salva → Enviada", "Etapa RH · nota", "Nota · texto". */
function EventText({ event }: { event: ApplicationEvent }): ReactNode {
  if (event.kind === 'status_changed' && event.toStatus !== null) {
    return (
      <>
        {DETAIL_MESSAGES.eventStatus}{' '}
        {event.fromStatus === null ? null : (
          <>
            <Timeline.Emphasis>{STATUS_LABELS[event.fromStatus]}</Timeline.Emphasis>{' '}
          </>
        )}
        → <Timeline.Emphasis>{STATUS_LABELS[event.toStatus]}</Timeline.Emphasis>
      </>
    );
  }
  if (event.kind === 'stage' && event.stage !== null) {
    return (
      <>
        {DETAIL_MESSAGES.eventStage} <Timeline.Emphasis>{STAGE_LABELS[event.stage]}</Timeline.Emphasis>
        {event.note === null || event.note.trim() === '' ? null : ` · ${event.note}`}
      </>
    );
  }
  return (
    <>
      <Timeline.Emphasis>{DETAIL_MESSAGES.eventNote}</Timeline.Emphasis>
      {` · ${event.note ?? ''}`}
    </>
  );
}

/**
 * The history of an application (APP-69, APP-70): each event with its icon and its date as "20 out", in
 * the order the api gives, and the registration as the last entry. A status change leads with the ring
 * of the status it went to; stages and notes have their own icon. The screen never sorts or edits.
 */
export function ApplicationTimeline({ events, createdAt }: ApplicationTimelineProps) {
  return (
    <Timeline.Root aria-label={DETAIL_MESSAGES.timeline}>
      {events.map((event) =>
        event.kind === 'status_changed' && event.toStatus !== null ? (
          <Timeline.Item
            key={event.id}
            marker={<PipelineStatus status={event.toStatus} label={STATUS_LABELS[event.toStatus]} iconOnly />}
            date={shortDate(event.occurredAt)}
          >
            <EventText event={event} />
          </Timeline.Item>
        ) : (
          <Timeline.Item
            key={event.id}
            icon={event.kind === 'stage' ? UserRound : MessageSquare}
            date={shortDate(event.occurredAt)}
          >
            <EventText event={event} />
          </Timeline.Item>
        ),
      )}
      <Timeline.Item marker={<PipelineStatus status="saved" label={STATUS_LABELS.saved} iconOnly />} date={shortDate(createdAt)}>
        {DETAIL_MESSAGES.created}
      </Timeline.Item>
    </Timeline.Root>
  );
}
