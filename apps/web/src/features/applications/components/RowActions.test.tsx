// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MESSAGES } from '../../identity';
import { application } from '../testing/fixtures';
import { fakeApplications } from '../testing/fake-api';
import { companiesOf, groupsOnScreen, renderList, rowOf, rows } from '../testing/list-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const portfolio = () => [
  application(1, { status: 'applied', company: 'Empresa Fictícia Alfa', level: 'mid' }),
  application(2, { status: 'applied', company: 'Empresa Fictícia Beta', level: 'senior' }),
  application(3, { status: 'saved', company: 'Empresa Fictícia Gama', level: 'junior' }),
  application(4, { status: 'rejected', company: 'Empresa Fictícia Delta' }),
];

/** Opens the "⋯" menu of a row with the keyboard. */
async function openButtonMenu(company: string) {
  fireEvent.keyDown(within(rowOf(company)).getByRole('button', { name: `Ações de ${company}` }), { key: 'Enter' });
  return screen.findByRole('menu');
}

/** Opens the menu of a row with the right click. */
async function openContextMenu(company: string) {
  fireEvent.contextMenu(rowOf(company), { clientX: 10, clientY: 10 });
  return screen.findByRole('menu');
}

/** Opens a submenu of the open menu with the right arrow and answers its radio items. */
async function openSubmenu(name: 'Status' | 'Nível') {
  fireEvent.keyDown(screen.getByRole('menuitem', { name }), { key: 'ArrowRight' });
  await screen.findAllByRole('menuitemradio');
  return screen.getAllByRole('menuitemradio');
}

const chip = (name: RegExp) => screen.getByRole('button', { name });
const countsOnScreen = () => [chip(/^Ativas/).textContent, chip(/^Encerradas/).textContent];

describe('RowActions', () => {
  it('APP-50 opens from the "⋯" button named after the company with the submenus Status and Nível', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();

    const menu = await openButtonMenu('Empresa Fictícia Alfa');

    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Status', 'Nível']);
    expect(screen.getByRole('menuitem', { name: 'Status' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('APP-50 lists the eight statuses by their singular label with the current one marked', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();
    await openButtonMenu('Empresa Fictícia Alfa');

    const items = await openSubmenu('Status');

    expect(items.map((item) => item.textContent)).toEqual([
      'Salva',
      'Enviada',
      'Em entrevistas',
      'Proposta',
      'Aceita',
      'Recusada',
      'Desisti',
      'Sem retorno',
    ]);
    expect(items.filter((item) => item.getAttribute('aria-checked') === 'true').map((item) => item.textContent)).toEqual(['Enviada']);
  });

  it('APP-50 lists the five levels with the current one marked', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();
    await openButtonMenu('Empresa Fictícia Alfa');

    const items = await openSubmenu('Nível');

    expect(items.map((item) => item.textContent)).toEqual(['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Especialista']);
    expect(items.filter((item) => item.getAttribute('aria-checked') === 'true').map((item) => item.textContent)).toEqual(['Pleno']);
  });

  it('APP-50 shows the row in its new group with the numbers read again from the api after a status is chosen', async () => {
    const api = fakeApplications(server, portfolio());
    const { onOpen } = renderList();
    await rows();
    expect(groupsOnScreen()).toEqual([
      { name: 'Enviadas', count: '2' },
      { name: 'Salvas', count: '1' },
    ]);
    await openButtonMenu('Empresa Fictícia Alfa');
    await openSubmenu('Status');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Em entrevistas' }));

    await waitFor(() =>
      expect(groupsOnScreen()).toEqual([
        { name: 'Em entrevistas', count: '1' },
        { name: 'Enviadas', count: '1' },
        { name: 'Salvas', count: '1' },
      ]),
    );
    expect(companiesOf('Em entrevistas')).toEqual(['Empresa Fictícia Alfa']);
    expect(companiesOf('Enviadas')).toEqual(['Empresa Fictícia Beta']);
    expect(within(rowOf('Empresa Fictícia Alfa')).getByRole('img', { name: 'Em entrevistas' })).toBeInTheDocument();
    expect(api.callsTo('POST', '/status')).toEqual([`POST /applications/${application(1).id}/status {"status":"interviewing"}`]);
    expect(api.callsTo('GET', '/applications?')).toHaveLength(2);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('APP-50 takes the row out of the tab when the status is one of the closed ones, and the numbers of both tabs follow', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();
    expect(countsOnScreen()).toEqual(['Ativas3', 'Encerradas1']);
    await openButtonMenu('Empresa Fictícia Beta');
    await openSubmenu('Status');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Aceita' }));

    await waitFor(() => expect(screen.queryByText('Empresa Fictícia Beta')).toBeNull());
    expect(countsOnScreen()).toEqual(['Ativas2', 'Encerradas2']);
    expect(groupsOnScreen()).toEqual([
      { name: 'Enviadas', count: '1' },
      { name: 'Salvas', count: '1' },
    ]);
  });

  it('APP-50 opens the same menu with the right click on the row and writes the chosen level to the row', async () => {
    const api = fakeApplications(server, portfolio());
    const { onOpen } = renderList();
    await rows();

    await openContextMenu('Empresa Fictícia Alfa');
    const levels = await openSubmenu('Nível');
    fireEvent.click(levels.find((item) => item.textContent === 'Sênior')!);

    await waitFor(() => expect(within(rowOf('Empresa Fictícia Alfa')).getByText('Sênior')).toBeInTheDocument());
    expect(within(rowOf('Empresa Fictícia Alfa')).queryByText('Pleno')).toBeNull();
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([`PATCH /applications/${application(1).id}/job-posting {"level":"senior"}`]);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('APP-50 gives the right click the same submenus and values as the "⋯" button', async () => {
    fakeApplications(server, portfolio());
    renderList();
    await rows();

    const fromButton = await openButtonMenu('Empresa Fictícia Beta');
    const buttonItems = within(fromButton).getAllByRole('menuitem').map((item) => item.textContent);
    const buttonStatus = (await openSubmenu('Status')).map((item) => `${item.textContent}:${item.getAttribute('aria-checked')}`);
    // The first Esc closes the submenu, the second the menu.
    await waitFor(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();
    });

    const fromRightClick = await openContextMenu('Empresa Fictícia Beta');
    const contextItems = within(fromRightClick).getAllByRole('menuitem').map((item) => item.textContent);
    const contextStatus = (await openSubmenu('Status')).map((item) => `${item.textContent}:${item.getAttribute('aria-checked')}`);

    expect(contextItems).toEqual(buttonItems);
    expect(contextStatus).toEqual(buttonStatus);
  });

  it('APP-50 writes nothing when the value already on the row is chosen', async () => {
    const api = fakeApplications(server, portfolio());
    renderList();
    await rows();
    await openButtonMenu('Empresa Fictícia Alfa');
    await openSubmenu('Status');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Enviada' }));

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(api.callsTo('POST', '/status')).toEqual([]);
    expect(api.callsTo('GET', '/applications?')).toHaveLength(1);
  });

  it('APP-55 keeps the row where it was and shows a danger Alert when the status change fails', async () => {
    const api = fakeApplications(server, portfolio());
    api.fail('status', 500);
    renderList();
    await rows();
    await openButtonMenu('Empresa Fictícia Alfa');
    await openSubmenu('Status');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Proposta' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(MESSAGES.unavailable);
    expect(companiesOf('Enviadas')).toEqual(['Empresa Fictícia Alfa', 'Empresa Fictícia Beta']);
    expect(groupsOnScreen().map((group) => group.name)).toEqual(['Enviadas', 'Salvas']);
    expect(within(rowOf('Empresa Fictícia Alfa')).getByRole('img', { name: 'Enviada' })).toBeInTheDocument();
    expect(api.callsTo('GET', '/applications?')).toHaveLength(1);
  });

  it('APP-55 keeps the level on the row and shows the Alert when the level change fails, and the next success clears it', async () => {
    const api = fakeApplications(server, portfolio());
    api.fail('level', 503);
    renderList();
    await rows();
    await openContextMenu('Empresa Fictícia Alfa');
    const levels = await openSubmenu('Nível');
    fireEvent.click(levels.find((item) => item.textContent === 'Especialista')!);

    expect((await screen.findByRole('alert')).textContent).toContain(MESSAGES.unavailable);
    expect(within(rowOf('Empresa Fictícia Alfa')).getByText('Pleno')).toBeInTheDocument();

    await openButtonMenu('Empresa Fictícia Alfa');
    await openSubmenu('Nível');
    fireEvent.click(screen.getAllByRole('menuitemradio').find((item) => item.textContent === 'Especialista')!);

    await waitFor(() => expect(within(rowOf('Empresa Fictícia Alfa')).getByText('Especialista')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
