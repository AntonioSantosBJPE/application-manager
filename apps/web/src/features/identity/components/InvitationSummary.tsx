import type { InvitationsPage } from '@am/contracts';
import { Button, StatusBadge } from '@am/ui';
import type { ReactElement } from 'react';
import type { Outcome } from '../api/server-functions';

export interface InvitationSummaryProps {
  /** The first page of `GET /invitations`; only the total is read, and the api decides it (ADM-14). */
  result: Outcome<InvitationsPage>;
  /** The link to the invitations screen; the route passes its own router link. */
  link: ReactElement;
}

/** The invitations widget of the admin dashboard: the pending total and the way to the list (ADM-14). */
export function InvitationSummary({ result, link }: InvitationSummaryProps) {
  return (
    <div
      role="group"
      aria-label="Convites pendentes"
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Convites pendentes</span>
        {result.ok ? (
          <span className="text-sm">{result.data.totalPending}</span>
        ) : (
          <StatusBadge intent="unavailable">Indisponível</StatusBadge>
        )}
      </div>
      <Button asChild intent="secondary" size="sm">
        {link}
      </Button>
    </div>
  );
}
