// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderDetail } from '../testing/detail-harness';
import { fakeDetail } from '../testing/fake-detail';
import { detail } from '../testing/fixtures';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// NOW is 2026-11-08 15:00Z; 23 days earlier is 2026-10-16.
const suggested = (overrides = {}) =>
  detail(1, { status: 'applied', ghostSuggested: true, lastActivityAt: '2026-10-16T15:00:00.000Z', ...overrides });
const activity = () =>
  within(screen.getByRole('complementary', { name: 'Propriedades' })).getByText('16 out 2026');

describe('GhostAlert', () => {
  it('APP-80 shows the warning at the top with the days since the send, both buttons, and the activity date in warning', () => {
    fakeDetail(server, suggested());
    renderDetail(suggested());

    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent('23 dias sem atividade desde o envio. Marcar como sem retorno?');
    expect(within(alert).getByRole('button', { name: 'Ainda não' })).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: 'Marcar sem retorno' })).toBeInTheDocument();
    expect(activity().className).toContain('text-warning');
  });

  it('APP-80 drops "desde o envio" for an application in entrevistas', () => {
    renderDetail(suggested({ status: 'interviewing' }));

    expect(within(screen.getByRole('status')).getByText('23 dias sem atividade. Marcar como sem retorno?')).toBeInTheDocument();
  });

  it('APP-80 shows no alert and no warning color when the api does not suggest it', () => {
    renderDetail(suggested({ ghostSuggested: false }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(activity().className).not.toContain('text-warning');
  });

  it('APP-81 marks the application as "Sem retorno" and hides the alert', async () => {
    const api = fakeDetail(server, suggested());
    renderDetail(suggested());

    fireEvent.click(screen.getByRole('button', { name: 'Marcar sem retorno' }));

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(api.callsTo('POST', '/status')).toEqual([`POST /applications/${suggested().id}/status {"status":"ghosted"}`]);
    expect(screen.getByRole('button', { name: 'Status Sem retorno' })).toBeInTheDocument();
    // The status change is the new activity, and the date is no longer in warning.
    const moved = within(screen.getByRole('complementary', { name: 'Propriedades' })).getByText('08 nov 2026');
    expect(moved.className).not.toContain('text-warning');
  });

  it('APP-82 snoozes the suggestion with "Ainda não", keeps the status and hides the alert', async () => {
    const api = fakeDetail(server, suggested());
    renderDetail(suggested());

    fireEvent.click(screen.getByRole('button', { name: 'Ainda não' }));

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(api.callsTo('POST', '/ghost-snooze')).toEqual([`POST /applications/${suggested().id}/ghost-snooze`]);
    expect(api.callsTo('POST', '/status')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Status Enviada' })).toBeInTheDocument();
  });

  it('APP-82 keeps the alert and says why when the snooze fails', async () => {
    const api = fakeDetail(server, suggested());
    api.fail('snooze', 500);
    renderDetail(suggested());

    fireEvent.click(screen.getByRole('button', { name: 'Ainda não' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível');
    expect(screen.getByRole('status')).toHaveTextContent('23 dias sem atividade');
  });
});
