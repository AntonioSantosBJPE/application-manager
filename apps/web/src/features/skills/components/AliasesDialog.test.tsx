// @vitest-environment jsdom
import type { AdminSkill } from '@am/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { apiInternalUrl, problem } from '../testing/api';
import { alfa, beta, chooseFromMenu, drizzle, renderCatalog, rowOf, rows } from '../testing/catalog-harness';
import { fakeCatalog, uuid } from '../testing/fake-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const gama: AdminSkill = {
  ...alfa,
  id: uuid(4),
  name: 'Skill Fictícia Gama',
  aliases: [
    { id: uuid(41), alias: 'gama' },
    { id: uuid(42), alias: 'gama-js' },
  ],
};

async function openAliases(name = 'Skill Fictícia Alfa') {
  await rows();
  chooseFromMenu(name, 'Apelidos');
  return screen.findByRole('dialog', { name: `Apelidos de ${name}` });
}

const itemOf = (dialog: HTMLElement, alias: string) => within(dialog).getByText(alias).closest('li')!;

describe('AliasesDialog', () => {
  it('SKL-74 opens "Apelidos de {nome}" with each alias, its actions Editar and Remover, and a field to add another', async () => {
    fakeCatalog(server, [gama, beta, drizzle]);
    renderCatalog();

    const dialog = await openAliases('Skill Fictícia Gama');

    const items = within(within(dialog).getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['gamaEditarRemover', 'gama-jsEditarRemover']);
    for (const item of items) {
      expect(within(item).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
      expect(within(item).getByRole('button', { name: 'Remover' })).toBeInTheDocument();
    }
    expect(within(dialog).getByLabelText('Novo apelido')).toHaveValue('');
    expect(within(dialog).getByRole('button', { name: 'Adicionar' })).toBeInTheDocument();
    expect(within(dialog).queryByText('Esta skill não tem apelidos.')).toBeNull();
  });

  it('SKL-74 says "Esta skill não tem apelidos." when the skill has none and keeps the field to add one', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();

    const dialog = await openAliases('Skill Fictícia Beta');

    expect(within(dialog).getByText('Esta skill não tem apelidos.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('list')).toBeNull();
    expect(within(dialog).getByLabelText('Novo apelido')).toBeInTheDocument();
  });

  it('SKL-74 adds an alias from the dialog and shows it in the dialog and on the row', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Beta');

    fireEvent.change(within(dialog).getByLabelText('Novo apelido'), { target: { value: ' beta  novo ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    await waitFor(() => expect(within(dialog).getByText('beta novo')).toBeInTheDocument());
    expect(within(dialog).queryByText('Esta skill não tem apelidos.')).toBeNull();
    expect(within(dialog).getByLabelText('Novo apelido')).toHaveValue('');
    expect(within(rowOf('Skill Fictícia Beta')).getByText('beta novo')).toBeInTheDocument();
    expect(api.callsTo('POST', '/aliases')).toEqual([`POST /skills/${beta.id}/aliases {"alias":"beta novo"}`]);
  });

  it('SKL-74 shows the 409 of a new alias on the field "Novo apelido" and keeps the dialog open', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/aliases`, () => problem(409)));
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Beta');

    fireEvent.change(within(dialog).getByLabelText('Novo apelido'), { target: { value: 'alfa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Novo apelido')).toHaveAccessibleDescription(
        'Esse apelido já pertence a outra skill.',
      ),
    );
    expect(within(dialog).getByLabelText('Novo apelido')).toHaveValue('alfa');
  });

  it('SKL-75 turns the alias into a field with the current text; Salvar shows the new text in the dialog and on the row', async () => {
    const api = fakeCatalog(server, [gama, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');

    fireEvent.click(within(itemOf(dialog, 'gama-js')).getByRole('button', { name: 'Editar' }));
    const field = within(dialog).getByRole('textbox', { name: 'Apelido' });
    expect(field).toHaveValue('gama-js');
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'gama-core' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(within(dialog).getByText('gama-core')).toBeInTheDocument());
    expect(within(dialog).queryByText('gama-js')).toBeNull();
    expect(within(dialog).queryByRole('textbox', { name: 'Apelido' })).toBeNull();
    expect(within(rowOf('Skill Fictícia Gama')).getByText('gama, gama-core')).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/aliases/')).toEqual([
      `PATCH /skills/${gama.id}/aliases/${uuid(42)} {"alias":"gama-core"}`,
    ]);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(itemOf(dialog, 'gama-core')).getByRole('button', { name: 'Editar' }),
      ),
    );
  });

  it('SKL-75 keeps the field open with "Esse apelido já pertence a outra skill." after a 409', async () => {
    fakeCatalog(server, [gama, beta, drizzle]);
    server.use(http.patch(`${apiInternalUrl}/skills/:id/aliases/:aliasId`, () => problem(409)));
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    fireEvent.click(within(itemOf(dialog, 'gama-js')).getByRole('button', { name: 'Editar' }));

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Apelido' }), { target: { value: 'alfa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const field = within(dialog).getByRole('textbox', { name: 'Apelido' });
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(field).toHaveAccessibleDescription('Esse apelido já pertence a outra skill.');
    expect(field).toHaveValue('alfa');
    expect(within(rowOf('Skill Fictícia Gama')).getByText('gama, gama-js')).toBeInTheDocument();
  });

  it('SKL-75 closes the field without calling the api on Cancelar', async () => {
    const api = fakeCatalog(server, [gama, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    fireEvent.click(within(itemOf(dialog, 'gama')).getByRole('button', { name: 'Editar' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Apelido' }), { target: { value: 'outro' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(within(dialog).queryByRole('textbox', { name: 'Apelido' })).toBeNull();
    expect(within(dialog).getByText('gama')).toBeInTheDocument();
    expect(api.callsTo('PATCH', '/aliases/')).toEqual([]);
  });

  it('SKL-76 asks "Remover o apelido {apelido}?" saying the search stops finding the skill, and Cancelar returns the focus to Remover', async () => {
    const api = fakeCatalog(server, [gama, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    const remove = within(itemOf(dialog, 'gama-js')).getByRole('button', { name: 'Remover' });

    fireEvent.click(remove);

    const confirm = await screen.findByRole('alertdialog', { name: 'Remover o apelido gama-js?' });
    expect(confirm).toHaveTextContent('A busca por esse apelido deixa de achar a skill.');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(remove));
    expect(api.callsTo('DELETE', '/aliases/')).toEqual([]);
    expect(within(dialog).getByText('gama-js')).toBeInTheDocument();
  });

  it('SKL-76 returns the focus to Remover of the alias when the confirmation is closed with Esc', async () => {
    const api = fakeCatalog(server, [gama, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    const remove = within(itemOf(dialog, 'gama')).getByRole('button', { name: 'Remover' });
    fireEvent.click(remove);
    const confirm = await screen.findByRole('alertdialog');

    fireEvent.keyDown(confirm, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(remove));
    expect(screen.getByRole('dialog', { name: 'Apelidos de Skill Fictícia Gama' })).toBeInTheDocument();
    expect(api.callsTo('DELETE', '/aliases/')).toEqual([]);
  });

  it('SKL-76 removes the alias from the dialog and from the row on confirm, and moves the focus to the field of a new alias', async () => {
    const api = fakeCatalog(server, [gama, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    fireEvent.click(within(itemOf(dialog, 'gama-js')).getByRole('button', { name: 'Remover' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(within(dialog).queryByText('gama-js')).toBeNull());
    expect(within(dialog).getByText('gama')).toBeInTheDocument();
    expect(within(rowOf('Skill Fictícia Gama')).getByText('gama')).toBeInTheDocument();
    expect(within(rowOf('Skill Fictícia Gama')).queryByText('gama, gama-js')).toBeNull();
    expect(api.callsTo('DELETE', '/aliases/')).toEqual([`DELETE /skills/${gama.id}/aliases/${uuid(42)}`]);
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText('Novo apelido')));
  });

  it('SKL-76 shows "Esta skill não tem apelidos." and a dash on the row after the last alias is removed', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases();
    fireEvent.click(within(itemOf(dialog, 'alfa')).getByRole('button', { name: 'Remover' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover' }));

    expect(await within(dialog).findByText('Esta skill não tem apelidos.')).toBeInTheDocument();
    expect(within(rowOf('Skill Fictícia Alfa')).getByText('—')).toBeInTheDocument();
  });

  it('SKL-76 hands a 401 of the removal to onExpired and shows no error', async () => {
    fakeCatalog(server, [gama, beta, drizzle]);
    server.use(http.delete(`${apiInternalUrl}/skills/:id/aliases/:aliasId`, () => problem(401)));
    const { onExpired } = renderCatalog({ onExpired: () => true });
    const dialog = await openAliases('Skill Fictícia Gama');
    fireEvent.click(within(itemOf(dialog, 'gama')).getByRole('button', { name: 'Remover' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover' }));

    await waitFor(() =>
      expect(onExpired).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 401 })),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(within(dialog).getByText('gama')).toBeInTheDocument();
  });

  it('SKL-76 says the service is unavailable in the dialog when the removal fails and keeps the alias', async () => {
    fakeCatalog(server, [gama, beta, drizzle]);
    server.use(http.delete(`${apiInternalUrl}/skills/:id/aliases/:aliasId`, () => problem(503)));
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    fireEvent.click(within(itemOf(dialog, 'gama')).getByRole('button', { name: 'Remover' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(within(dialog).getByText('gama')).toBeInTheDocument();
  });

  it('SKL-50 keeps the confirm of the removal disabled and busy while pending, and a second click sends no second call', async () => {
    const api = fakeCatalog(server, [gama, beta, drizzle]);
    const release = api.hold('removeAlias');
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    fireEvent.click(within(itemOf(dialog, 'gama')).getByRole('button', { name: 'Remover' }));
    const confirm = within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover' });

    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(confirm).toHaveAttribute('aria-busy', 'true');
    release();
    await waitFor(() => expect(within(dialog).queryByText('gama')).toBeNull());
    expect(api.callsTo('DELETE', '/aliases/')).toHaveLength(1);
  });

  it('SKL-50 disables Salvar with aria-busy while the edit of an alias is pending, and a second click sends no second call', async () => {
    const api = fakeCatalog(server, [gama, beta, drizzle]);
    const release = api.hold('updateAlias');
    renderCatalog();
    const dialog = await openAliases('Skill Fictícia Gama');
    fireEvent.click(within(itemOf(dialog, 'gama')).getByRole('button', { name: 'Editar' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Apelido' }), { target: { value: 'gama-novo' } });
    const save = within(dialog).getByRole('button', { name: 'Salvar' });

    fireEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.click(save);

    expect(save).toHaveAttribute('aria-busy', 'true');
    release();
    await waitFor(() => expect(within(dialog).getByText('gama-novo')).toBeInTheDocument());
    expect(api.callsTo('PATCH', '/aliases/')).toHaveLength(1);
  });

  it('SKL-74 closes with Fechar or Esc and gives the focus back to the "⋯" button of the row', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openAliases();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(rowOf('Skill Fictícia Alfa')).getByRole('button', { name: 'Ações de Skill Fictícia Alfa' }),
      ),
    );
  });
});
