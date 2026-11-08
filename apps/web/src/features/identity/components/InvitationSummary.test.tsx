// @vitest-environment jsdom
import type { InvitationsPage } from '@am/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InvitationSummary } from './InvitationSummary';

const page: InvitationsPage = { items: [], nextCursor: null, totalPending: 3 };
const link = <a href="/admin/invitations">Ver convites</a>;
const inviteLink = <a href="/admin/invitations">Convidar pessoa</a>;

describe('InvitationSummary', () => {
  it('shows the pending total and the link to the invitations screen', () => {
    render(
      <InvitationSummary result={{ ok: true, data: page }} link={link} inviteLink={inviteLink} />,
    );

    const widget = screen.getByRole('group', { name: 'Convites pendentes' });
    expect(within(widget).getByText('3')).toBeInTheDocument();
    expect(within(widget).getByRole('link', { name: 'Ver convites' })).toHaveAttribute(
      'href',
      '/admin/invitations',
    );
  });

  it('shows a total of zero as zero', () => {
    render(
      <InvitationSummary
        result={{ ok: true, data: { ...page, totalPending: 0 } }}
        link={link}
        inviteLink={inviteLink}
      />,
    );

    expect(
      within(screen.getByRole('group', { name: 'Convites pendentes' })).getByText('0'),
    ).toBeInTheDocument();
  });

  it('shows the widget as unavailable when the total could not be read, keeping the link', () => {
    render(
      <InvitationSummary result={{ ok: false, status: 503 }} link={link} inviteLink={inviteLink} />,
    );

    const widget = screen.getByRole('group', { name: 'Convites pendentes' });
    expect(within(widget).getByText('Indisponível')).toBeInTheDocument();
    expect(within(widget).getByRole('link', { name: 'Ver convites' })).toBeInTheDocument();
  });
});

const now = new Date('2026-11-08T12:00:00.000Z');
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;

describe('InvitationSummary as the widget of PageAdminDashboard', () => {
  it('PRU-06 AC14 shows the total in heading-xl, the oldest expiry, Ver convites as ghost and Convidar pessoa', () => {
    const data: InvitationsPage = {
      items: [
        { id: uuid(3), email: 'c@exemplo.com', expiresAt: inDays(7) },
        { id: uuid(2), email: 'b@exemplo.com', expiresAt: inDays(4) },
        { id: uuid(1), email: 'a@exemplo.com', expiresAt: inDays(1.5) },
      ],
      nextCursor: null,
      totalPending: 3,
    };
    render(
      <InvitationSummary
        result={{ ok: true, data }}
        link={link}
        inviteLink={inviteLink}
        now={now}
      />,
    );

    const widget = screen.getByRole('group', { name: 'Convites pendentes' });
    expect(
      within(widget).getByRole('heading', { level: 2, name: 'Convites pendentes' }),
    ).toBeInTheDocument();
    expect(within(widget).getByText('3')).toHaveClass('text-heading-xl');
    const expiry = within(widget).getByText(/^O mais antigo expira em/);
    expect(expiry.textContent).toBe('O mais antigo expira em 2 d.');
    expect(within(expiry).getByText('2 d')).toHaveClass('font-mono');
    const view = within(widget).getByRole('link', { name: 'Ver convites' });
    expect(view).toHaveClass('bg-transparent', 'h-control-sm');
    expect(view.closest('h2')).toBeNull();
    expect(within(widget).getByRole('link', { name: 'Convidar pessoa' })).toHaveAttribute(
      'href',
      '/admin/invitations',
    );
  });

  it('PRU-06 AC14 shows 0 and no expiry line when nothing is pending', () => {
    render(
      <InvitationSummary
        result={{ ok: true, data: { items: [], nextCursor: null, totalPending: 0 } }}
        link={link}
        inviteLink={inviteLink}
        now={now}
      />,
    );

    const widget = screen.getByRole('group', { name: 'Convites pendentes' });
    expect(within(widget).getByText('0')).toHaveClass('text-heading-xl');
    expect(within(widget).queryByText(/expira/)).toBeNull();
    expect(within(widget).getByRole('link', { name: 'Convidar pessoa' })).toBeInTheDocument();
  });

  it('leaves the expiry out when the oldest invitation is on a later page', () => {
    render(
      <InvitationSummary
        result={{
          ok: true,
          data: {
            items: [{ id: uuid(9), email: 'z@exemplo.com', expiresAt: inDays(6) }],
            nextCursor: uuid(9),
            totalPending: 21,
          },
        }}
        link={link}
        inviteLink={inviteLink}
        now={now}
      />,
    );

    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.queryByText(/expira/)).toBeNull();
  });
});
