// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderDetail } from '../testing/detail-harness';
import { pickSkill, typeInto } from '../testing/dialog-harness';
import { fakeDetail } from '../testing/fake-detail';
import { detail, postingSkill } from '../testing/fixtures';
import { skillNames } from '../testing/skills-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const java = { ...postingSkill(1, 'required', 'Java'), category: 'language' as const };
const opened = () =>
  detail(1, {
    company: 'Empresa Fictícia Alfa',
    title: 'Vaga de Teste Pleno',
    level: 'mid',
    workModel: 'remote',
    url: 'https://vagas.exemplo.com/1',
    description: 'Texto da vaga.',
    skills: [java],
  });

async function openMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Mais ações' }), { key: 'Enter' });
  return screen.findByRole('menu');
}

describe('DetailActions: editar vaga', () => {
  it('APP-74 shows "Editar vaga" and "Excluir candidatura" in the "⋯" menu', async () => {
    fakeDetail(server, opened());
    renderDetail(opened());

    const menu = await openMenu();

    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Editar vaga', 'Excluir candidatura']);
  });

  it('APP-74 opens the dialog filled, titled "Editar vaga", without "Entra como" and with "Salvar"', async () => {
    fakeDetail(server, opened());
    renderDetail(opened());
    await openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar vaga' }));

    const box = await screen.findByRole('dialog', { name: 'Editar vaga' });
    expect(within(box).getByLabelText('Empresa')).toHaveValue('Empresa Fictícia Alfa');
    expect(within(box).getByLabelText('Título')).toHaveValue('Vaga de Teste Pleno');
    expect(within(box).getByLabelText(/Link da vaga/)).toHaveValue('https://vagas.exemplo.com/1');
    expect(within(box).getByRole('radio', { name: 'Pleno' })).toHaveAttribute('aria-checked', 'true');
    expect(within(box).getByRole('radio', { name: 'Remoto' })).toHaveAttribute('aria-checked', 'true');
    expect(within(box).getByRole('button', { name: 'Remover Java' })).toBeInTheDocument();
    expect(within(box).getByLabelText(/Descrição/)).toHaveValue('Texto da vaga.');
    expect(within(box).queryByText(/Entra como/)).toBeNull();
    expect(within(box).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(within(box).queryByRole('button', { name: 'Criar candidatura' })).toBeNull();
  });

  it('APP-74 saves only the changed fields with a PATCH and shows them on the page', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar vaga' }));
    const box = await screen.findByRole('dialog', { name: 'Editar vaga' });

    typeInto(within(box).getByLabelText('Título'), 'Vaga de Teste Sênior');
    fireEvent.click(within(box).getByRole('radio', { name: 'Híbrido' }));
    fireEvent.click(within(box).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([
      `PATCH /applications/${opened().id}/job-posting {"title":"Vaga de Teste Sênior","workModel":"hybrid"}`,
    ]);
    expect(api.callsTo('PUT', '/skills')).toEqual([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Vaga de Teste Sênior' })).toBeInTheDocument();
  });

  it('APP-74 writes the skills with a PUT when they changed, and no PATCH when the posting did not', async () => {
    const api = fakeDetail(server, opened(), { skillNames });
    renderDetail(opened());
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar vaga' }));
    await screen.findByRole('dialog', { name: 'Editar vaga' });

    await pickSkill('Skills desejáveis', 'react', /^React/);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([]);
    expect(api.callsTo('PUT', '/skills')).toHaveLength(1);
    expect(api.callsTo('PUT', '/skills')[0]).toContain('"requirement":"nice_to_have"');
    expect(within(screen.getByRole('list', { name: 'Desejáveis' })).getByText('React')).toBeInTheDocument();
  });

  it('APP-74 sends null for an optional field that was emptied', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar vaga' }));
    const box = await screen.findByRole('dialog', { name: 'Editar vaga' });

    typeInto(within(box).getByLabelText(/Link da vaga/), '');
    fireEvent.click(within(box).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('PATCH', '/job-posting')).toEqual([`PATCH /applications/${opened().id}/job-posting {"url":null}`]);
  });

  it('APP-74 closes without any call when nothing changed', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar vaga' }));
    const box = await screen.findByRole('dialog', { name: 'Editar vaga' });

    fireEvent.click(within(box).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.calls).toEqual([]);
  });
});
