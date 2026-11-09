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

const opened = () => detail(1, { status: 'applied', createdAt: '2026-10-14T15:00:00.000Z', lastActivityAt: '2026-10-14T15:00:00.000Z' });
const field = () => screen.getByRole('textbox', { name: 'Adicionar nota…' });
const timeline = () => screen.getByRole('list', { name: 'Linha do tempo' });
const firstEntry = () => within(timeline()).getAllByRole('listitem')[0]!.children[1]?.textContent;

describe('NoteComposer', () => {
  it('APP-71 shows the button "Adicionar nota" only once there is text in the field', () => {
    fakeDetail(server, opened());
    renderDetail(opened());
    expect(screen.queryByRole('button', { name: 'Adicionar nota' })).toBeNull();

    fireEvent.change(field(), { target: { value: 'Falei com a recrutadora' } });
    expect(screen.getByRole('button', { name: 'Adicionar nota' })).toBeInTheDocument();

    fireEvent.change(field(), { target: { value: '   ' } });
    expect(screen.queryByRole('button', { name: 'Adicionar nota' })).toBeNull();
  });

  it('APP-71 records the note with the button, clears the field and shows the note at the top of the timeline', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.change(field(), { target: { value: 'Falei com a recrutadora' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar nota' }));

    await waitFor(() => expect(firstEntry()).toBe('Nota · Falei com a recrutadora'));
    expect(field()).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Adicionar nota' })).toBeNull();
    expect(api.callsTo('POST', '/events')).toEqual([
      `POST /applications/${opened().id}/events {"kind":"note","note":"Falei com a recrutadora"}`,
    ]);
    // The detail is read again after the write, so the timeline is the api's.
    expect(api.callsTo('GET', `/applications/${opened().id}`).length).toBe(1);
  });

  it('APP-71 records the note with Ctrl+Enter', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.change(field(), { target: { value: 'Nota pelo teclado' } });
    fireEvent.keyDown(field(), { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(firstEntry()).toBe('Nota · Nota pelo teclado'));
    expect(field()).toHaveValue('');
    expect(api.callsTo('POST', '/events')).toHaveLength(1);
  });

  it('APP-71 records the note with Cmd+Enter', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.change(field(), { target: { value: 'Nota no Mac' } });
    fireEvent.keyDown(field(), { key: 'Enter', metaKey: true });

    await waitFor(() => expect(firstEntry()).toBe('Nota · Nota no Mac'));
    expect(api.callsTo('POST', '/events')).toHaveLength(1);
  });

  it('APP-71 leaves a plain Enter alone: no note is recorded', () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.change(field(), { target: { value: 'Linha um' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect(field()).toHaveValue('Linha um');
    expect(api.calls).toEqual([]);
  });

  it('APP-71 keeps the text and says why when the note is refused', async () => {
    const api = fakeDetail(server, opened());
    api.fail('event', 500);
    renderDetail(opened());

    fireEvent.change(field(), { target: { value: 'Nota que falha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar nota' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível. Tente novamente em instantes.');
    expect(field()).toHaveValue('Nota que falha');
    expect(firstEntry()).toBe('Vaga cadastrada');
  });

  it('APP-71 sends one note when the button is used twice while the first is on its way', async () => {
    const api = fakeDetail(server, opened());
    const release = api.hold('event');
    renderDetail(opened());

    fireEvent.change(field(), { target: { value: 'Duas vezes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar nota' }));
    fireEvent.keyDown(field(), { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(api.callsTo('POST', '/events')).toHaveLength(1));
    release();

    await waitFor(() => expect(firstEntry()).toBe('Nota · Duas vezes'));
    expect(api.callsTo('POST', '/events')).toHaveLength(1);
  });
});

describe('ApplicationTimeline in the detail', () => {
  it('APP-69 shows "Status {de} → {para}" at the top of the timeline, with the date, after the status changes', async () => {
    fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.keyDown(within(screen.getByRole('complementary', { name: 'Propriedades' })).getByRole('button', { name: 'Status Enviada' }), {
      key: 'Enter',
    });
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Em entrevistas' }));

    await waitFor(() => expect(firstEntry()).toBe('Status Enviada → Em entrevistas'));
    const top = within(timeline()).getAllByRole('listitem')[0]!;
    expect(top.children[2]?.textContent).toBe('08 nov');
    expect(top.querySelector('[data-status-icon]')?.getAttribute('data-status-icon')).toBe('interviewing');
  });
});
