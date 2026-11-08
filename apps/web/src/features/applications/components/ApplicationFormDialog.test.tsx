// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MESSAGES } from '../../identity';
import { dialog, fillRequired, pickSkill, renderDialog, typeInto } from '../testing/dialog-harness';
import { fakeApplications } from '../testing/fake-api';
import { docker, nest, node, react, skillNames } from '../testing/skills-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const create = () => within(dialog()).getByRole('button', { name: 'Criar candidatura' });

describe('ApplicationFormDialog', () => {
  it('APP-57 shows the fields, the chips, the skills, the description, the footer and the buttons of the PageNewApplication card', () => {
    fakeApplications(server, []);
    renderDialog();

    const box = dialog();
    expect(within(box).getByRole('heading', { name: 'Nova candidatura' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'esc' }).querySelector('kbd')).not.toBeNull();
    const company = within(box).getByLabelText('Empresa');
    const title = within(box).getByLabelText('Título');
    expect(company.parentElement?.parentElement).toBe(title.parentElement?.parentElement);
    expect(company.parentElement?.parentElement).toHaveClass('grid', 'sm:grid-cols-2');
    const link = within(box).getByLabelText('Link da vaga · opcional');
    expect(link).toHaveAttribute('placeholder', 'https://');
    const level = within(box).getByRole('radiogroup', { name: 'Nível' });
    expect(within(level).getAllByRole('radio').map((chip) => chip.textContent)).toEqual([
      'Estágio',
      'Júnior',
      'Pleno',
      'Sênior',
      'Especialista',
    ]);
    const model = within(box).getByRole('radiogroup', { name: 'Modelo' });
    expect(within(model).getAllByRole('radio').map((chip) => chip.textContent)).toEqual(['Remoto', 'Híbrido', 'Presencial']);
    for (const group of [level, model]) {
      expect(within(group).queryAllByRole('radio', { checked: true })).toHaveLength(0);
    }
    expect(within(box).getByRole('combobox', { name: 'Skills obrigatórias' })).toBeInTheDocument();
    expect(within(box).getByRole('combobox', { name: 'Skills desejáveis' })).toBeInTheDocument();
    expect(within(box).getByLabelText('Descrição · opcional, cole o texto da vaga').tagName).toBe('TEXTAREA');
    const footer = within(box).getByText(/Entra como/).parentElement!;
    expect(footer.textContent).toBe('Entra como Salva.⌘↵para criar');
    expect(within(footer).getByText('Salva').tagName).toBe('B');
    expect(Array.from(footer.querySelectorAll('kbd')).map((key) => key.textContent)).toEqual(['⌘', '↵']);
    expect(within(box).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(create()).toBeEnabled();
    expect(company).toHaveFocus();
  });

  it('APP-58 says "Entra como Enviada." for the "+" of that group and creates the application in that status', async () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog({ status: 'applied' });

    expect(within(dialog()).getByText(/Entra como/).parentElement?.textContent).toBe('Entra como Enviada.⌘↵para criar');
    fillRequired();
    fireEvent.click(create());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((api.bodies[0] as { status?: string }).status).toBe('applied');
  });

  it('APP-58 sends no status when the dialog enters as Salva, which is what the api does without one', async () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();
    fillRequired();

    fireEvent.click(create());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.bodies[0]).not.toHaveProperty('status');
  });

  it('APP-62 creates with the typed fields, the chosen chips and the skills of each field in order, then closes and reports the saved application', async () => {
    const api = fakeApplications(server, [], { skillNames });
    const { onClose, onSaved } = renderDialog();
    typeInto(screen.getByLabelText('Empresa'), '  Empresa Fictícia Alfa ');
    typeInto(screen.getByLabelText('Título'), 'Vaga de Teste Pleno');
    typeInto(screen.getByLabelText('Link da vaga · opcional'), 'https://vagas.exemplo.com/123');
    fireEvent.click(screen.getByRole('radio', { name: 'Sênior' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Híbrido' }));
    await pickSkill('Skills obrigatórias', 'nest', /^NestJS/);
    await pickSkill('Skills obrigatórias', 'nodejs', /^Node\.js/);
    await pickSkill('Skills desejáveis', 'dock', /^Docker/);
    typeInto(screen.getByLabelText(/^Descrição/), 'Texto fictício da vaga.');

    fireEvent.click(create());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.bodies).toEqual([
      {
        jobPosting: {
          company: 'Empresa Fictícia Alfa',
          title: 'Vaga de Teste Pleno',
          level: 'senior',
          url: 'https://vagas.exemplo.com/123',
          workModel: 'hybrid',
          description: 'Texto fictício da vaga.',
        },
        skills: [
          { skillId: nest.id, requirement: 'required' },
          { skillId: node.id, requirement: 'required' },
          { skillId: docker.id, requirement: 'nice_to_have' },
        ],
      },
    ]);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0]![0]).toMatchObject({ company: 'Empresa Fictícia Alfa', status: 'saved', level: 'senior' });
  });

  it('APP-62 sends only the required fields when the optional ones are left empty', async () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();
    fillRequired('Empresa Fictícia Beta', 'Vaga de Teste Júnior', 'Júnior');

    fireEvent.click(create());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.bodies).toEqual([
      { jobPosting: { company: 'Empresa Fictícia Beta', title: 'Vaga de Teste Júnior', level: 'junior' }, skills: [] },
    ]);
  });

  it('APP-62 moves a skill picked in the other field instead of repeating it in the request', async () => {
    const api = fakeApplications(server, [], { skillNames });
    const { onClose } = renderDialog();
    fillRequired();
    await pickSkill('Skills obrigatórias', 'react', /^React/);
    await pickSkill('Skills desejáveis', 'react', /^React/);

    expect(screen.getAllByRole('button', { name: 'Remover React' })).toHaveLength(1);
    fireEvent.click(create());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((api.bodies[0] as { skills: unknown }).skills).toEqual([{ skillId: react.id, requirement: 'nice_to_have' }]);
  });

  it('APP-62 disables the button while the request runs, so a second click sends one application', async () => {
    const api = fakeApplications(server, []);
    const release = api.hold('create');
    const { onClose } = renderDialog();
    fillRequired();

    fireEvent.click(create());
    await waitFor(() => expect(create()).toBeDisabled());
    fireEvent.click(create());
    fireEvent.keyDown(screen.getByLabelText('Empresa'), { key: 'Enter', metaKey: true });
    expect(within(dialog()).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    release();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.callsTo('POST', '/applications')).toHaveLength(1);
  });

  it('APP-62 creates with ⌘↵ from a text field', async () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();
    fillRequired();

    fireEvent.keyDown(screen.getByLabelText('Título'), { key: 'Enter', metaKey: true });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.callsTo('POST', '/applications')).toHaveLength(1);
  });

  it('APP-62 creates with Ctrl+↵ from the skills field with its list open, without choosing the highlighted skill', async () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();
    fillRequired();
    typeInto(screen.getByRole('combobox', { name: 'Skills obrigatórias' }), 'nest');
    await screen.findByRole('option', { name: /^NestJS/ });

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Skills obrigatórias' }), { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.callsTo('POST', '/applications')).toHaveLength(1);
    // The key created the application and did not choose the highlighted skill.
    expect((api.bodies[0] as { skills: unknown }).skills).toEqual([]);
  });

  it('APP-63 sends nothing and shows an error under company, title and level when they are missing', async () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();

    fireEvent.click(create());

    expect(await screen.findByText('Informe a empresa.')).toBeInTheDocument();
    expect(screen.getByText('Informe o título.')).toBeInTheDocument();
    expect(screen.getByText('Escolha o nível.')).toBeInTheDocument();
    expect(screen.getByLabelText('Empresa')).toHaveAccessibleDescription('Informe a empresa.');
    expect(screen.getByLabelText('Empresa')).toBeInvalid();
    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription('Informe o título.');
    expect(screen.getByRole('radiogroup', { name: 'Nível' })).toHaveAccessibleDescription('Escolha o nível.');
    expect(onClose).not.toHaveBeenCalled();
    expect(api.callsTo('POST', '/applications')).toHaveLength(0);
  });

  it('APP-63 treats a company made of spaces as missing', async () => {
    const api = fakeApplications(server, []);
    renderDialog();
    fillRequired('   ', 'Vaga de Teste Pleno');

    fireEvent.click(create());

    expect(await screen.findByText('Informe a empresa.')).toBeInTheDocument();
    expect(api.callsTo('POST', '/applications')).toHaveLength(0);
  });

  it('APP-63 refuses a link that does not start with http:// or https:// and accepts one that does', async () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();
    fillRequired();
    typeInto(screen.getByLabelText('Link da vaga · opcional'), 'ftp://vagas.exemplo.com/1');

    fireEvent.click(create());

    expect(await screen.findByText('O link precisa começar com http:// ou https://.')).toBeInTheDocument();
    expect(screen.getByLabelText('Link da vaga · opcional')).toBeInvalid();
    expect(screen.queryByText('Informe a empresa.')).toBeNull();
    expect(api.callsTo('POST', '/applications')).toHaveLength(0);

    typeInto(screen.getByLabelText('Link da vaga · opcional'), 'vagas.exemplo.com/1');
    fireEvent.click(create());
    await waitFor(() => expect(screen.getByLabelText('Link da vaga · opcional')).toBeInvalid());
    expect(api.callsTo('POST', '/applications')).toHaveLength(0);

    typeInto(screen.getByLabelText('Link da vaga · opcional'), 'http://vagas.exemplo.com/1');
    fireEvent.click(create());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.callsTo('POST', '/applications')).toHaveLength(1);
  });

  it('APP-64 keeps the dialog open with what was typed and a danger Alert when the api refuses, and the next try can succeed', async () => {
    const api = fakeApplications(server, [], { skillNames });
    api.fail('create', 500);
    const { onClose, onSaved } = renderDialog();
    fillRequired('Empresa Fictícia Gama', 'Vaga de Teste Sênior', 'Sênior');
    await pickSkill('Skills obrigatórias', 'nest', /^NestJS/);
    fireEvent.click(screen.getByRole('radio', { name: 'Remoto' }));

    fireEvent.click(create());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert.textContent).toContain(MESSAGES.unavailable);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Empresa')).toHaveValue('Empresa Fictícia Gama');
    expect(screen.getByLabelText('Título')).toHaveValue('Vaga de Teste Sênior');
    expect(screen.getByRole('radio', { name: 'Sênior' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Remoto' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Remover NestJS' })).toBeInTheDocument();
    expect(create()).toBeEnabled();

    fireEvent.click(create());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(api.callsTo('POST', '/applications')).toHaveLength(2);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('APP-64 says what the api refused: 400 names the field and the Alert, 422 the skills, 404 the application', async () => {
    const api = fakeApplications(server, [], { skillNames });
    const { onClose } = renderDialog();
    fillRequired('Empresa Fictícia Gama', 'Vaga de Teste Sênior', 'Sênior');

    api.fail('create', 400, [{ path: 'company', code: 'too_big' }]);
    fireEvent.click(create());
    expect((await within(dialog()).findByRole('alert')).textContent).toContain('Revise os campos destacados.');
    expect(screen.getByLabelText('Empresa')).toBeInvalid();
    expect(screen.getByLabelText('Título')).not.toBeInvalid();
    expect(within(dialog()).getByText('Revise este campo.')).toBeInTheDocument();

    api.fail('create', 422);
    fireEvent.click(create());
    await waitFor(() => expect(within(dialog()).getByRole('alert').textContent).toContain('Alguma skill escolhida não pode ser usada.'));
    expect(screen.getByLabelText('Empresa')).not.toBeInvalid();
    expect(within(dialog()).queryByText('Revise este campo.')).toBeNull();

    api.fail('create', 404);
    fireEvent.click(create());
    await waitFor(() => expect(within(dialog()).getByRole('alert').textContent).toContain('Candidatura não encontrada.'));
    expect(within(dialog()).getByRole('alert').textContent).not.toContain(MESSAGES.unavailable);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('APP-64 leaves the failure to the login redirect when the answer is 401', async () => {
    const api = fakeApplications(server, []);
    api.fail('create', 401);
    const { onExpired, onClose } = renderDialog({ onExpired: () => true });
    fillRequired();

    fireEvent.click(create());

    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('APP-65 closes with Cancelar without writing anything, even with the form filled', () => {
    const api = fakeApplications(server, []);
    const { onClose, onSaved } = renderDialog();
    fillRequired();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(api.calls).toEqual([]);
  });

  it('APP-65 closes with Esc without writing anything', () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();
    fillRequired();

    fireEvent.keyDown(dialog(), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.calls).toEqual([]);
  });

  it('APP-65 closes with the "esc" of the header without writing anything', () => {
    const api = fakeApplications(server, []);
    const { onClose } = renderDialog();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'esc' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(api.calls).toEqual([]);
  });

  it('APP-57 opens with the values it was given, so the same form can start filled', () => {
    renderDialog({ initial: { company: 'Empresa Fictícia Delta', level: 'mid', workModel: 'remote', required: [{ id: nest.id, name: 'NestJS', scope: 'global' }] } });

    expect(screen.getByLabelText('Empresa')).toHaveValue('Empresa Fictícia Delta');
    expect(screen.getByRole('radio', { name: 'Pleno' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Remoto' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Remover NestJS' })).toBeInTheDocument();
  });
});
