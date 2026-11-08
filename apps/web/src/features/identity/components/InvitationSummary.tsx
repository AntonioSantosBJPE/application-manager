import type { InvitationsPage } from '@am/contracts';
import { Alert, Button, DashboardPage } from '@am/ui';
import { ArrowRight, UserPlus } from 'lucide-react';
import { useId, type ReactElement } from 'react';
import type { Outcome } from '../api/server-functions';
import { daysLeft } from '../model/expiry';
import { MESSAGES } from '../model/messages';

export interface InvitationSummaryProps {
  /** The first page of `GET /invitations`: the api decides the total and which invitations are pending (ADM-14). */
  result: Outcome<InvitationsPage>;
  /** The "Ver convites" link to the invitations screen; the route passes its own router link. */
  link: ReactElement;
  /** The "Convidar pessoa" link, to the same screen (PRU-06 AC20). */
  inviteLink: ReactElement;
  /** The clock the expiry is counted from; a test fixes it. */
  now?: Date;
}

/**
 * The days until the oldest pending invitation expires. Read only when the first page holds every
 * pending invitation: on a longer list the oldest is on a later page, and a guess would be wrong.
 */
function oldestDaysLeft(page: InvitationsPage, now: Date): number | undefined {
  if (page.nextCursor !== null) return undefined;
  const days = page.items
    .map((item) => daysLeft(item.expiresAt, now))
    .filter((value) => value !== undefined);
  return days.length === 0 ? undefined : Math.min(...days);
}

/**
 * The invitations widget of the admin dashboard (PRU-06 AC14): the pending total in `heading-xl`, how
 * long until the oldest one expires, the ghost action to the list and the action to invite. A total
 * that could not be read shows a `danger` alert with the unavailable message, keeping both ways to the
 * list (PRU-06 AC25).
 */
export function InvitationSummary({
  result,
  link,
  inviteLink,
  now = new Date(),
}: InvitationSummaryProps) {
  const titleId = useId();
  const oldest =
    result.ok && result.data.totalPending > 0 ? oldestDaysLeft(result.data, now) : undefined;

  return (
    <DashboardPage.Widget span={6} role="group" aria-labelledby={titleId}>
      <DashboardPage.Widget.Header>
        <DashboardPage.Widget.Title id={titleId}>Convites pendentes</DashboardPage.Widget.Title>
        <DashboardPage.Widget.Action asChild iconEnd={ArrowRight}>
          {link}
        </DashboardPage.Widget.Action>
      </DashboardPage.Widget.Header>
      {result.ok ? (
        <p className="font-mono text-heading-xl">{result.data.totalPending}</p>
      ) : (
        <Alert intent="danger">{MESSAGES.unavailable}</Alert>
      )}
      {oldest === undefined ? null : (
        <p className="text-caption text-text-muted">
          O mais antigo expira em <span className="font-mono">{oldest} d</span>.
        </p>
      )}
      <div>
        <Button asChild intent="secondary" size="sm" icon={UserPlus}>
          {inviteLink}
        </Button>
      </div>
    </DashboardPage.Widget>
  );
}
