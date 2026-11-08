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

const opened = () =>
  detail(1, { status: 'applied', level: 'mid', workModel: 'onsite', location: 'Recife, PE', url: 'https://vagas.exemplo.com/1234' });
const sidebar = () => screen.getByRole('complementary', { name: 'Propriedades' });
const inSidebar = () => within(sidebar());

/** Opens the menu of a property with the keyboard. */
function openMenu(name: string) {
  fireEvent.keyDown(inSidebar().getByRole('button', { name }), { key: 'Enter' });
}

describe('PropertiesSidebar', () => {
  it('APP-68 opens the status menu, writes the chosen status and shows it on the sidebar', async () => {
    const api = fakeDetail(server, opened());
    const { onChanged } = renderDetail(opened());

    openMenu('Status Enviada');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Salva',
      'Enviada',
      'Em entrevistas',
      'Proposta',
      'Aceita',
      'Recusada',
      'Desisti',
      'Sem retorno',
    ]);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Em entrevistas' }));

    expect(await inSidebar().findByRole('button', { name: 'Status Em entrevistas' })).toBeInTheDocument();
    expect(api.callsTo('POST', '/status')).toEqual([`POST /applications/${opened().id}/status {"status":"interviewing"}`]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('APP-68 draws the values in one column: no extra left padding on the buttons, and the dark text of the card', () => {
    renderDetail(opened());

    for (const name of ['Status Enviada', 'Nível Pleno', 'Modelo Presencial']) {
      expect(inSidebar().getByRole('button', { name })).toHaveClass('px-0!', 'text-text!');
    }
    for (const name of [/Editar local/, /Editar link da vaga/]) {
      expect(inSidebar().getByRole('button', { name })).toHaveClass('px-0!');
    }
  });

  it('APP-68 draws the link of the posting without the scheme, in the accent text, and keeps the whole link in its name', () => {
    renderDetail(opened());

    const link = inSidebar().getByRole('button', { name: /Editar link da vaga/ });
    expect(link).toHaveAccessibleName('Editar link da vaga https://vagas.exemplo.com/1234');
    expect(inSidebar().getByText('https://')).toHaveClass('sr-only');
    expect(link.querySelector('.truncate')?.lastChild?.textContent).toBe('vagas.exemplo.com/1234');
    expect(link).toHaveClass('text-accent-text!');
  });

  it('APP-68 writes nothing when the status chosen is the one already there', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    openMenu('Status Enviada');
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Enviada' }));

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(api.calls).toEqual([]);
  });

  it('APP-68 opens the level menu, writes the chosen level and shows it', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    openMenu('Nível Pleno');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'Estágio',
      'Júnior',
      'Pleno',
      'Sênior',
      'Especialista',
    ]);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Sênior' }));

    expect(await inSidebar().findByRole('button', { name: 'Nível Sênior' })).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([`PATCH /applications/${opened().id}/job-posting {"level":"senior"}`]);
  });

  it('APP-68 offers "—" in the work model menu and writes null for it', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    openMenu('Modelo Presencial');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      '—',
      'Remoto',
      'Híbrido',
      'Presencial',
    ]);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: '—' }));

    expect(await inSidebar().findByRole('button', { name: 'Modelo —' })).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([`PATCH /applications/${opened().id}/job-posting {"workModel":null}`]);
  });

  it('APP-68 writes a work model chosen from the menu', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    openMenu('Modelo Presencial');
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Híbrido' }));

    expect(await inSidebar().findByRole('button', { name: 'Modelo Híbrido' })).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([`PATCH /applications/${opened().id}/job-posting {"workModel":"hybrid"}`]);
  });

  it('APP-68 edits the local in place: Enter writes it and the new value shows', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(inSidebar().getByRole('button', { name: /Editar local/ }));
    const field = inSidebar().getByRole('textbox', { name: 'Editar local' });
    fireEvent.change(field, { target: { value: 'São Paulo, SP' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(await inSidebar().findByRole('button', { name: 'Editar local São Paulo, SP' })).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([`PATCH /applications/${opened().id}/job-posting {"location":"São Paulo, SP"}`]);
  });

  it('APP-68 writes the link when the field loses the focus', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(inSidebar().getByRole('button', { name: /Editar link da vaga/ }));
    const field = inSidebar().getByRole('textbox', { name: 'Editar link da vaga' });
    fireEvent.change(field, { target: { value: 'https://vagas.exemplo.com/9999' } });
    fireEvent.blur(field);

    expect(await inSidebar().findByRole('button', { name: 'Editar link da vaga https://vagas.exemplo.com/9999' })).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([
      `PATCH /applications/${opened().id}/job-posting {"url":"https://vagas.exemplo.com/9999"}`,
    ]);
  });

  it('APP-68 cancels the edit with Esc: nothing is written and the old value stays', () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(inSidebar().getByRole('button', { name: /Editar local/ }));
    const field = inSidebar().getByRole('textbox', { name: 'Editar local' });
    fireEvent.change(field, { target: { value: 'Outro lugar' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(inSidebar().getByRole('button', { name: 'Editar local Recife, PE' })).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('APP-68 writes nothing when the local was left as it was', () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(inSidebar().getByRole('button', { name: /Editar local/ }));
    fireEvent.keyDown(inSidebar().getByRole('textbox', { name: 'Editar local' }), { key: 'Enter' });

    expect(inSidebar().getByRole('button', { name: 'Editar local Recife, PE' })).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('APP-68 sends null when the local is emptied, and shows "—"', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(inSidebar().getByRole('button', { name: /Editar local/ }));
    const field = inSidebar().getByRole('textbox', { name: 'Editar local' });
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(await inSidebar().findByRole('button', { name: 'Editar local —' })).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([`PATCH /applications/${opened().id}/job-posting {"location":null}`]);
  });

  it('APP-78 keeps the old status and shows a danger Alert when the write fails', async () => {
    const api = fakeDetail(server, opened());
    api.fail('status', 500);
    renderDetail(opened());

    openMenu('Status Enviada');
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Proposta' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Serviço indisponível. Tente novamente em instantes.');
    expect(inSidebar().getByRole('button', { name: 'Status Enviada' })).toBeInTheDocument();
  });

  it('APP-78 keeps the old local and shows a danger Alert when the write fails', async () => {
    const api = fakeDetail(server, opened());
    api.fail('posting', 500);
    renderDetail(opened());

    fireEvent.click(inSidebar().getByRole('button', { name: /Editar local/ }));
    const field = inSidebar().getByRole('textbox', { name: 'Editar local' });
    fireEvent.change(field, { target: { value: 'Natal, RN' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(inSidebar().getByRole('button', { name: 'Editar local Recife, PE' })).toBeInTheDocument();
  });

  it('APP-78 says what the api refused: 404 "Candidatura não encontrada." and 400 "Revise os campos destacados."', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    api.fail('status', 404);
    openMenu('Status Enviada');
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Proposta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Candidatura não encontrada.');

    api.fail('posting', 400, [{ path: 'location', code: 'too_big' }]);
    fireEvent.click(inSidebar().getByRole('button', { name: /Editar local/ }));
    const field = inSidebar().getByRole('textbox', { name: 'Editar local' });
    fireEvent.change(field, { target: { value: 'Natal, RN' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Revise os campos destacados.'));
    expect(inSidebar().getByRole('button', { name: 'Editar local Recife, PE' })).toBeInTheDocument();
  });

  it('APP-78 takes the Alert away when the next write works', async () => {
    const api = fakeDetail(server, opened());
    api.fail('status', 500);
    renderDetail(opened());
    openMenu('Status Enviada');
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Proposta' }));
    await screen.findByRole('alert');

    openMenu('Status Enviada');
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Proposta' }));

    expect(await inSidebar().findByRole('button', { name: 'Status Proposta' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
