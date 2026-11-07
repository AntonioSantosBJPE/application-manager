// @vitest-environment jsdom
import type { InvitationsPage } from '@am/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InvitationSummary } from './InvitationSummary';

const page: InvitationsPage = { items: [], nextCursor: null, totalPending: 3 };
const link = <a href="/admin/invitations">Ver convites</a>;

describe('InvitationSummary', () => {
  it('shows the pending total and the link to the invitations screen', () => {
    render(<InvitationSummary result={{ ok: true, data: page }} link={link} />);

    const widget = screen.getByRole('group', { name: 'Convites pendentes' });
    expect(within(widget).getByText('3')).toBeInTheDocument();
    expect(within(widget).getByRole('link', { name: 'Ver convites' })).toHaveAttribute(
      'href',
      '/admin/invitations',
    );
  });

  it('shows a total of zero as zero', () => {
    render(
      <InvitationSummary result={{ ok: true, data: { ...page, totalPending: 0 } }} link={link} />,
    );

    expect(
      within(screen.getByRole('group', { name: 'Convites pendentes' })).getByText('0'),
    ).toBeInTheDocument();
  });

  it('shows the widget as unavailable when the total could not be read, keeping the link', () => {
    render(<InvitationSummary result={{ ok: false, status: 503 }} link={link} />);

    const widget = screen.getByRole('group', { name: 'Convites pendentes' });
    expect(within(widget).getByText('Indisponível')).toBeInTheDocument();
    expect(within(widget).getByRole('link', { name: 'Ver convites' })).toBeInTheDocument();
  });
});
