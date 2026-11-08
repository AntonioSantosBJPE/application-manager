// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderDetail } from '../testing/detail-harness';
import { fakeDetail } from '../testing/fake-detail';
import { detail, uuid } from '../testing/fixtures';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const opened = () =>
  detail(1, {
    status: 'applied',
    createdAt: '2026-10-14T15:00:00.000Z',
    lastActivityAt: '2026-10-20T15:00:00.000Z',
    events: [
      { id: uuid(7001), kind: 'note', fromStatus: null, toStatus: null, stage: null, note: 'nota recente', occurredAt: '2026-10-20T15:00:00.000Z' },
      { id: uuid(7002), kind: 'status_changed', fromStatus: 'saved', toStatus: 'applied', stage: null, note: null, occurredAt: '2026-10-16T15:00:00.000Z' },
    ],
  });
const dialog = () => screen.findByRole('dialog', { name: 'Nova etapa' });
const timelineTexts = () =>
  // `hidden`: while a dialog is open the page behind it is out of the accessibility tree.
  within(screen.getByRole('list', { name: 'Linha do tempo', hidden: true }))
    .getAllByRole('listitem', { hidden: true })
    .map((item) => `${item.children[1]?.textContent} | ${item.children[2]?.textContent}`);

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Etapa' }));
  return dialog();
}

describe('StageDialog', () => {
  it('APP-72 opens with the five types, today as the day and an optional note', async () => {
    fakeDetail(server, opened());
    renderDetail(opened());

    const box = await openDialog();

    expect(within(box).getAllByRole('radio').map((chip) => chip.textContent)).toEqual(['Triagem', 'RH', 'Técnica', 'Case', 'Outra']);
    const day = within(box).getByLabelText('Data');
    expect(day).toHaveValue('2026-11-08');
    expect(day).toHaveAttribute('max', '2026-11-08');
    expect(within(box).getByLabelText(/Nota/)).toHaveValue('');
  });

  it('APP-72 records the stage with its type, day and note, closes, and shows it between the events around its date', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    const box = await openDialog();

    fireEvent.click(within(box).getByRole('radio', { name: 'RH' }));
    fireEvent.change(within(box).getByLabelText('Data'), { target: { value: '2026-10-18' } });
    fireEvent.change(within(box).getByLabelText(/Nota/), { target: { value: 'conversa inicial' } });
    fireEvent.click(within(box).getByRole('button', { name: 'Registrar etapa' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('POST', '/events')).toEqual([
      `POST /applications/${opened().id}/events {"kind":"stage","stage":"hr","note":"conversa inicial","occurredAt":"2026-10-18T15:00:00.000Z"}`,
    ]);
    await waitFor(() =>
      expect(timelineTexts()).toEqual([
        'Nota · nota recente | 20 out',
        'Etapa RH · conversa inicial | 18 out',
        'Status Salva → Enviada | 16 out',
        'Vaga cadastrada | 14 out',
      ]),
    );
  });

  it('APP-72 records a stage of today at the current instant, without a note', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    const box = await openDialog();

    fireEvent.click(within(box).getByRole('radio', { name: 'Técnica' }));
    fireEvent.click(within(box).getByRole('button', { name: 'Registrar etapa' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('POST', '/events')).toEqual([
      `POST /applications/${opened().id}/events {"kind":"stage","stage":"technical","occurredAt":"2026-11-08T15:00:00.000Z"}`,
    ]);
    await waitFor(() => expect(timelineTexts()[0]).toBe('Etapa Técnica | 08 nov'));
  });

  it('APP-72 asks for the type and sends nothing without one', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    const box = await openDialog();

    fireEvent.click(within(box).getByRole('button', { name: 'Registrar etapa' }));

    expect(await within(box).findByText('Escolha o tipo da etapa.')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('APP-72 refuses a day after today and an empty day, and sends nothing', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    const box = await openDialog();
    fireEvent.click(within(box).getByRole('radio', { name: 'Case' }));

    fireEvent.change(within(box).getByLabelText('Data'), { target: { value: '2026-11-09' } });
    fireEvent.click(within(box).getByRole('button', { name: 'Registrar etapa' }));
    expect(await within(box).findByText('Escolha uma data até hoje.')).toBeInTheDocument();

    fireEvent.change(within(box).getByLabelText('Data'), { target: { value: '' } });
    fireEvent.click(within(box).getByRole('button', { name: 'Registrar etapa' }));
    expect(await within(box).findByText('Escolha uma data até hoje.')).toBeInTheDocument();

    expect(api.calls).toEqual([]);
  });

  it('APP-72 closes with Cancelar and records nothing', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    const box = await openDialog();

    fireEvent.click(within(box).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.calls).toEqual([]);
  });

  it('APP-72 stays open with what was chosen and a danger Alert when the api refuses', async () => {
    const api = fakeDetail(server, opened());
    api.fail('event', 500);
    renderDetail(opened());
    const box = await openDialog();

    fireEvent.click(within(box).getByRole('radio', { name: 'Outra' }));
    fireEvent.click(within(box).getByRole('button', { name: 'Registrar etapa' }));

    expect(await within(box).findByRole('alert')).toHaveTextContent('Serviço indisponível. Tente novamente em instantes.');
    expect(within(box).getByRole('radio', { name: 'Outra' })).toHaveAttribute('aria-checked', 'true');
    expect(timelineTexts()[0]).toBe('Nota · nota recente | 20 out');
  });

  it('APP-72 records one stage when the button is used twice while the first request is on its way', async () => {
    const api = fakeDetail(server, opened());
    const release = api.hold('event');
    renderDetail(opened());
    const box = await openDialog();
    fireEvent.click(within(box).getByRole('radio', { name: 'Triagem' }));

    const confirm = within(box).getByRole('button', { name: 'Registrar etapa' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(api.callsTo('POST', '/events')).toHaveLength(1));
    release();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('POST', '/events')).toHaveLength(1);
  });
});
