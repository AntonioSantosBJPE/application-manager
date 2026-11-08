// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { apiInternalUrl, problem } from '../testing/api';
import { alfa, beta, chooseFromMenu, drizzle, renderCatalog, rowOf, rows } from '../testing/catalog-harness';
import { fakeCatalog } from '../testing/fake-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function openEditor() {
  await rows();
  chooseFromMenu('Skill Fictícia Alfa', 'Editar');
  return screen.findByRole('dialog', { name: 'Editar skill' });
}

const chip = (dialog: HTMLElement, name: string) => within(dialog).getByRole('button', { name });

describe('EditSkillDialog', () => {
  it('SKL-72 opens "Editar skill" with Nome and Categoria filled with the current values', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();

    const dialog = await openEditor();

    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Skill Fictícia Alfa');
    const categories = within(dialog).getByRole('group', { name: 'Categoria' });
    const pressed = within(categories).getAllByRole('button', { pressed: true });
    expect(pressed.map((button) => button.textContent)).toEqual(['Linguagem']);
    expect(within(categories).getAllByRole('button')).toHaveLength(7);
  });

  it('SKL-72 sends the new values, closes the dialog and shows the row with the new name and category and the totals equal', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openEditor();

    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: '  Skill   Fictícia Alfa Dois ' } });
    fireEvent.click(chip(dialog, 'Framework'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const row = rowOf('Skill Fictícia Alfa Dois');
    expect(within(row).getByText('Framework')).toBeInTheDocument();
    expect(within(row).queryByText('Linguagem')).toBeNull();
    expect(screen.queryByText('Skill Fictícia Alfa')).toBeNull();
    expect(api.callsTo('PATCH', `/skills/${alfa.id}`)).toEqual([
      `PATCH /skills/${alfa.id} {"name":"Skill Fictícia Alfa Dois","category":"framework"}`,
    ]);
    expect(screen.getByText('3')).toHaveClass('font-mono');
    expect(screen.getByRole('button', { name: 'Privadas1' })).toBeInTheDocument();
  });

  it('SKL-72 sends only the field that changed', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openEditor();

    fireEvent.click(chip(dialog, 'Prática'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(within(rowOf('Skill Fictícia Alfa')).getByText('Prática')).toBeInTheDocument());
    expect(api.callsTo('PATCH', `/skills/${alfa.id}`)).toEqual([`PATCH /skills/${alfa.id} {"category":"practice"}`]);
  });

  it('SKL-72 gives the focus back to the "⋯" button of the row when the dialog closes', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openEditor();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(rowOf('Skill Fictícia Alfa')).getByRole('button', { name: 'Ações de Skill Fictícia Alfa' }),
      ),
    );
  });

  it('SKL-72 calls nothing when the dialog is cancelled or closed with Esc', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Outro nome' } });

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('PATCH', '/skills/')).toEqual([]);
    expect(screen.getByText('Skill Fictícia Alfa')).toBeInTheDocument();
  });

  it('SKL-73 keeps the dialog open with "Já existe uma skill ou apelido com esse nome." on the field Nome after a 409', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.patch(`${apiInternalUrl}/skills/:id`, () => problem(409)));
    renderCatalog();
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Skill Fictícia Beta' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const field = within(dialog).getByLabelText('Nome');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(field).toHaveAccessibleDescription('Já existe uma skill ou apelido com esse nome.');
    expect(screen.getByRole('dialog', { name: 'Editar skill' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Skill Fictícia Beta');
    expect(within(rowOf('Skill Fictícia Alfa')).getByText('Linguagem')).toBeInTheDocument();
  });

  it('SKL-73 shows the error of a 400 on the field the api named, without closing the dialog', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.patch(`${apiInternalUrl}/skills/:id`, () => problem(400, [{ path: 'name', code: 'too_big' }])));
    renderCatalog();
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Nome aceito pelo contrato' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const field = within(dialog).getByLabelText('Nome');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(field).toHaveAccessibleDescription('Use de 1 a 60 caracteres, com ao menos uma letra ou número.');
    expect(screen.getByRole('dialog', { name: 'Editar skill' })).toBeInTheDocument();
  });

  it('SKL-73 clears the error of the field when the person types again', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.patch(`${apiInternalUrl}/skills/:id`, () => problem(409)));
    renderCatalog();
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Skill Fictícia Beta' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(within(dialog).getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true'));

    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Skill Fictícia Gama' } });

    expect(within(dialog).getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
  });

  it('SKL-73 checks the name against the contract before calling the api', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    renderCatalog();
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: '   ' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Nome')).toHaveAccessibleDescription(
        'Use de 1 a 60 caracteres, com ao menos uma letra ou número.',
      ),
    );
    expect(api.callsTo('PATCH', '/skills/')).toEqual([]);
    expect(screen.getByRole('dialog', { name: 'Editar skill' })).toBeInTheDocument();
  });

  it('SKL-73 hands a 401 to onExpired and shows no error in the dialog', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.patch(`${apiInternalUrl}/skills/:id`, () => problem(401)));
    const { onExpired } = renderCatalog({ onExpired: () => true });
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Outro' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(onExpired).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 401 })),
    );
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('SKL-73 says the service is unavailable inside the dialog when the save fails for another reason', async () => {
    fakeCatalog(server, [alfa, beta, drizzle]);
    server.use(http.patch(`${apiInternalUrl}/skills/:id`, () => problem(503)));
    renderCatalog();
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Outro' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Serviço indisponível. Tente novamente em instantes.',
    );
  });

  it('SKL-50 disables Salvar with aria-busy while the edit is pending, and a second click sends no second call', async () => {
    const api = fakeCatalog(server, [alfa, beta, drizzle]);
    const release = api.hold('update');
    renderCatalog();
    const dialog = await openEditor();
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Skill Fictícia Alfa Dois' } });
    const save = within(dialog).getByRole('button', { name: 'Salvar' });

    fireEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    fireEvent.click(save);
    fireEvent.submit(within(dialog).getByLabelText('Nome').closest('form')!);

    expect(save).toHaveAttribute('aria-busy', 'true');
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.callsTo('PATCH', `/skills/${alfa.id}`)).toHaveLength(1);
  });
});
