// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { apiInternalUrl, problem } from '../testing/api';
import { alfa, beta, drizzle, renderCatalog, rowOf, rows } from '../testing/catalog-harness';
import { fakeCatalog } from '../testing/fake-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function openDialog() {
  await rows();
  fireEvent.click(screen.getByRole('button', { name: 'Apelido' }));
  return screen.findByRole('dialog');
}

/** Types in the field Skill and chooses the option with the click. */
async function chooseSkill(dialog: HTMLElement, typed: string, option: string) {
  fireEvent.change(within(dialog).getByRole('combobox', { name: 'Skill' }), { target: { value: typed } });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

const field = (dialog: HTMLElement, name: string) => within(dialog).getByLabelText(name);
const save = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Salvar' });

describe('AddAliasDialog', () => {
  it('SKL-48 opens a dialog with the fields Skill and Apelido from the button Apelido', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();

    const dialog = await openDialog();

    expect(within(dialog).getByRole('combobox', { name: 'Skill' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Apelido' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('SKL-48 offers only global skills, found by name or by alias', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openDialog();
    const combobox = within(dialog).getByRole('combobox', { name: 'Skill' });

    fireEvent.change(combobox, { target: { value: 'fictícia' } });
    const names = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(names).toEqual(['Skill Fictícia Alfa', 'Skill Fictícia Beta']);

    fireEvent.change(combobox, { target: { value: 'alfa' } });
    await waitFor(() => expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Skill Fictícia Alfa']));

    fireEvent.change(combobox, { target: { value: 'drizzle' } });
    await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('SKL-48 sends the chosen skill and the alias, closes the dialog, shows the alias on the row and gives the focus back to Apelido', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openDialog();

    await chooseSkill(dialog, 'beta', 'Skill Fictícia Beta');
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: '  beta   js ' } });
    fireEvent.click(save(dialog));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('POST', '/aliases')).toEqual([`POST /skills/${beta.id}/aliases {"alias":"beta js"}`]);
    expect(within(rowOf('Skill Fictícia Beta')).getByText('beta js')).toBeInTheDocument();
    expect(within(rowOf('Skill Fictícia Alfa')).getByText('alfa')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Apelido' })));
  });

  it('SKL-48 chooses the skill with the arrow keys and Enter', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openDialog();
    const combobox = within(dialog).getByRole('combobox', { name: 'Skill' });
    fireEvent.change(combobox, { target: { value: 'fictícia' } });
    await screen.findAllByRole('option');

    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    fireEvent.keyDown(combobox, { key: 'Enter' });
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'beta-key' } });
    fireEvent.click(save(dialog));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('POST', '/aliases')).toEqual([`POST /skills/${beta.id}/aliases {"alias":"beta-key"}`]);
  });

  it('SKL-48 does not accept text typed in Skill without choosing an option: it asks for a choice and calls nothing', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Skill' }), {
      target: { value: 'Skill Fictícia Alfa' },
    });
    await screen.findAllByRole('option');
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'apelido-novo' } });

    fireEvent.click(save(dialog));

    const skill = within(dialog).getByRole('combobox', { name: 'Skill' });
    await waitFor(() => expect(skill).toHaveAttribute('aria-invalid', 'true'));
    expect(skill).toHaveAccessibleDescription('Escolha uma skill da lista.');
    expect(api.callsTo('POST', '/aliases')).toEqual([]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('SKL-48 asks for a choice again when the text is edited after choosing an option', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openDialog();
    await chooseSkill(dialog, 'alfa', 'Skill Fictícia Alfa');
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Skill' }), {
      target: { value: 'Skill Fictícia Alf' },
    });
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'apelido-novo' } });

    fireEvent.click(save(dialog));

    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: 'Skill' })).toHaveAccessibleDescription(
        'Escolha uma skill da lista.',
      ),
    );
    expect(api.callsTo('POST', '/aliases')).toEqual([]);
  });

  it('SKL-48 checks the alias against the contract before calling the api', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openDialog();
    await chooseSkill(dialog, 'alfa', 'Skill Fictícia Alfa');

    fireEvent.click(save(dialog));

    await waitFor(() =>
      expect(field(dialog, 'Apelido')).toHaveAccessibleDescription(
        'Use de 1 a 60 caracteres, com ao menos uma letra ou número.',
      ),
    );
    expect(api.callsTo('POST', '/aliases')).toEqual([]);
  });

  it('SKL-49 keeps the dialog open with "Esse apelido já pertence a outra skill." on the field Apelido after a 409', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/aliases`, () => problem(409)));
    renderCatalog();
    const dialog = await openDialog();
    await chooseSkill(dialog, 'beta', 'Skill Fictícia Beta');
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'alfa' } });

    fireEvent.click(save(dialog));

    const alias = field(dialog, 'Apelido');
    await waitFor(() => expect(alias).toHaveAttribute('aria-invalid', 'true'));
    expect(alias).toHaveAccessibleDescription('Esse apelido já pertence a outra skill.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(alias).toHaveValue('alfa');
    expect(within(dialog).getByRole('combobox', { name: 'Skill' })).toHaveValue('Skill Fictícia Beta');
    expect(within(dialog).getByRole('combobox', { name: 'Skill' })).not.toHaveAttribute('aria-invalid');
  });

  it('SKL-49 shows the error of a 400 on the field Apelido without closing the dialog', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/aliases`, () => problem(400, [{ path: 'alias', code: 'too_big' }])));
    renderCatalog();
    const dialog = await openDialog();
    await chooseSkill(dialog, 'beta', 'Skill Fictícia Beta');
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'valido-no-contrato' } });

    fireEvent.click(save(dialog));

    await waitFor(() =>
      expect(field(dialog, 'Apelido')).toHaveAccessibleDescription(
        'Use de 1 a 60 caracteres, com ao menos uma letra ou número.',
      ),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('SKL-49 hands a 401 to onExpired and shows no error in the dialog', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/aliases`, () => problem(401)));
    const { onExpired } = renderCatalog({ onExpired: () => true });
    const dialog = await openDialog();
    await chooseSkill(dialog, 'beta', 'Skill Fictícia Beta');
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'novo' } });

    fireEvent.click(save(dialog));

    await waitFor(() =>
      expect(onExpired).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 401 })),
    );
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('SKL-49 says the service is unavailable inside the dialog when the save fails for another reason', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.post(`${apiInternalUrl}/skills/:id/aliases`, () => problem(503)));
    renderCatalog();
    const dialog = await openDialog();
    await chooseSkill(dialog, 'beta', 'Skill Fictícia Beta');
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'novo' } });

    fireEvent.click(save(dialog));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Serviço indisponível. Tente novamente em instantes.',
    );
  });

  it('SKL-48 closes with Esc and calls nothing; reopening starts with empty fields', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openDialog();
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'meio-digitado' } });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Apelido' }));

    const reopened = await screen.findByRole('dialog');
    expect(field(reopened, 'Apelido')).toHaveValue('');
    expect(within(reopened).getByRole('combobox', { name: 'Skill' })).toHaveValue('');
    expect(api.callsTo('POST', '/aliases')).toEqual([]);
  });

  it('SKL-50 disables Salvar with aria-busy while the alias is pending, and a second click sends no second call', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    const release = api.hold('addAlias');
    renderCatalog();
    const dialog = await openDialog();
    await chooseSkill(dialog, 'beta', 'Skill Fictícia Beta');
    fireEvent.change(field(dialog, 'Apelido'), { target: { value: 'novo-apelido' } });

    fireEvent.click(save(dialog));
    await waitFor(() => expect(save(dialog)).toBeDisabled());
    fireEvent.click(save(dialog));
    fireEvent.submit(field(dialog, 'Apelido').closest('form')!);
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(save(dialog)).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('POST', '/aliases')).toHaveLength(1);
  });
});
