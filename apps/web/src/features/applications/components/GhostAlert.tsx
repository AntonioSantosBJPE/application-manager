import type { ApplicationStatus } from '@am/contracts';
import { Alert, Button } from '@am/ui';
import { daysSince } from '../model/dates';
import { ghostMessage } from '../model/ghost-message';
import { DETAIL_MESSAGES } from '../model/messages';

export interface GhostAlertProps {
  status: ApplicationStatus;
  lastActivityAt: string;
  now: Date;
  /** "Ainda não": the suggestion rests for 21 days (APP-82). */
  onSnooze: () => void;
  /** "Marcar sem retorno": the status becomes "Sem retorno" (APP-81). */
  onGhost: () => void;
}

/**
 * The suggestion of "sem retorno" (APP-80): a `warning` Alert at the top of the content with the days
 * since the last activity and two ways out. Whether to show it is the api's call (`ghostSuggested`), so
 * the screen renders it only when asked; nothing changes until the person uses a button.
 */
export function GhostAlert({ status, lastActivityAt, now, onSnooze, onGhost }: GhostAlertProps) {
  const text = ghostMessage(status, daysSince(lastActivityAt, now));
  if (text === undefined) return null;
  return (
    <Alert
      intent="warning"
      action={
        <span className="flex items-center gap-1">
          <Button intent="ghost" size="sm" onClick={onSnooze}>
            {DETAIL_MESSAGES.ghostLater}
          </Button>
          <Button intent="secondary" size="sm" onClick={onGhost}>
            {DETAIL_MESSAGES.ghostMark}
          </Button>
        </span>
      }
    >
      {text}
    </Alert>
  );
}
