// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeResume } from '../testing/fake-api';
import { bullet, experience, masterResume, skillId, skillsOf } from '../testing/fixtures';
import { renderResumePage } from '../testing/page-harness';
import { catalogSkill, fakeSkillsApi } from '../testing/skills-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FAILED = 'Não foi possível salvar. Tente de novo.';
const itemId = experience(1).id;

/** An experience, open, with a bullet that names Skill Fictícia 1 and a bullet with no skill. */
function open() {
  const resume = masterResume({
    experiences: [experience(1, { bullets: [bullet(1, [1]), bullet(2, [])] })],
    skills: skillsOf(1),
  });
  const api = fakeResume(server, resume);
  const skills = fakeSkillsApi([catalogSkill(1), catalogSkill(2), catalogSkill(3)], (skill) => {
    api.catalog[skill.id] = { name: skill.name, scope: skill.scope };
  });
  renderResumePage({ resume, section: 'experiences', skills });
  return { api, skills };
}
const body = () => screen.getByRole('group', { name: /^Bullets de/ });
const row = (text: string) => within(body()).getByRole('button', { name: new RegExp(`^Editar texto do bullet ${text}`) }).closest('.group\\/bullet') as HTMLElement;
const field = (scope: HTMLElement = body()) => within(scope).getByRole('combobox', { name: 'Skills do bullet' });
const index = () => screen.getByRole('navigation', { name: 'Seções do currículo' });
const type = (scope: HTMLElement, text: string) => fireEvent.change(field(scope), { target: { value: text } });

async function openFromMenu(text: string) {
  fireEvent.keyDown(within(row(text)).getByRole('button', { name: 'Ações do bullet' }), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Editar skills' }));
}

describe('BulletSkills', () => {
  it('RES-66 opens the field of skills below the text from "Editar skills" in the menu, with the skills the bullet has', async () => {
    open();
    expect(within(body()).queryByRole('combobox')).toBeNull();

    await openFromMenu('Texto fictício do bullet 1.');

    const first = row('Texto fictício do bullet 1.');
    expect(field(first)).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Remover Skill Fictícia 1' })).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
    // The text comes before the field, and the other bullet has none.
    const html = first.innerHTML;
    expect(html.indexOf('Texto fictício do bullet 1.')).toBeLessThan(html.indexOf('Skills do bullet'));
    expect(within(row('Texto fictício do bullet 2.')).queryByRole('combobox')).toBeNull();
  });

  it('RES-66 opens the field of skills with a click on "sem skill"', () => {
    open();

    fireEvent.click(within(row('Texto fictício do bullet 2.')).getByRole('button', { name: 'sem skill' }));

    expect(field(row('Texto fictício do bullet 2.'))).toBeInTheDocument();
  });

  it('RES-66 searches the catalog and offers "Criar “texto” como skill privada", which asks for the category', async () => {
    const { skills } = open();
    fireEvent.click(within(row('Texto fictício do bullet 2.')).getByRole('button', { name: 'sem skill' }));
    const second = row('Texto fictício do bullet 2.');

    type(second, 'Skill Fictícia Alfa');
    fireEvent.click(await screen.findByRole('option', { name: 'Criar “Skill Fictícia Alfa” como skill privada' }));

    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Linguagem',
      'Framework',
      'Banco de dados',
      'Cloud/DevOps',
      'Ferramenta',
      'Prática',
      'Soft skill',
    ]);
    expect(skills.created).toEqual([]);
  });

  it('RES-67 saves the bullet at once when an existing skill is included, and the tag, the notice and the warning follow', async () => {
    const { api } = open();
    expect(within(index()).getByRole('status').textContent).toBe('1 bullet sem skill não entra na ordenação por relevância.');
    fireEvent.click(within(row('Texto fictício do bullet 2.')).getByRole('button', { name: 'sem skill' }));
    const second = row('Texto fictício do bullet 2.');

    type(second, '2');
    fireEvent.click(await screen.findByRole('option', { name: /^Skill Fictícia 2/ }));

    await waitFor(() => expect(api.calls).toEqual([`PATCH /resume/experiences/${itemId}/bullets/${bullet(2).id}`]));
    expect(api.bodies).toEqual([{ skillIds: [skillId(2)] }]);
    await waitFor(() => expect(within(second).queryByRole('button', { name: 'sem skill' })).toBeNull());
    expect(within(index()).queryByRole('status')).toBeNull();
    expect(within(second).getByRole('button', { name: 'Remover Skill Fictícia 2' })).toBeInTheDocument();

    fireEvent.click(within(second).getByRole('button', { name: 'Concluir' }));

    expect(within(second).queryByRole('combobox')).toBeNull();
    expect(within(second).getByText('Skill Fictícia 2')).toBeInTheDocument();
    expect(within(second).queryByText('sem skill')).toBeNull();
  });

  it('RES-67 creates a private skill choosing its category and saves the bullet with it, merging it into the dictionary', async () => {
    const { api, skills } = open();
    fireEvent.click(within(row('Texto fictício do bullet 2.')).getByRole('button', { name: 'sem skill' }));
    const second = row('Texto fictício do bullet 2.');

    type(second, 'Skill Fictícia Alfa');
    fireEvent.click(await screen.findByRole('option', { name: 'Criar “Skill Fictícia Alfa” como skill privada' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Prática' }));

    await waitFor(() => expect(api.bodies).toEqual([{ skillIds: [skillId(81)] }]));
    expect(skills.created).toEqual([{ name: 'Skill Fictícia Alfa', category: 'practice' }]);
    fireEvent.click(await within(second).findByRole('button', { name: 'Concluir' }));
    const tag = within(second).getByText('Skill Fictícia Alfa').closest('span') as HTMLElement;
    expect(within(tag).getByText('·')).toBeInTheDocument();
    expect(within(second).queryByText('sem skill')).toBeNull();
    expect(within(index()).queryByRole('status')).toBeNull();
  });

  it('RES-67 keeps the skills in the order they were marked, adding to those the bullet has', async () => {
    const { api } = open();
    await openFromMenu('Texto fictício do bullet 1.');
    const first = row('Texto fictício do bullet 1.');

    type(first, '3');
    fireEvent.click(await screen.findByRole('option', { name: /^Skill Fictícia 3/ }));

    await waitFor(() => expect(api.bodies).toEqual([{ skillIds: [skillId(1), skillId(3)] }]));
  });

  it('RES-67 saves the bullet at once when a skill is removed, and the bullet is without skill again', async () => {
    const { api } = open();
    await openFromMenu('Texto fictício do bullet 1.');
    const first = row('Texto fictício do bullet 1.');

    fireEvent.click(within(first).getByRole('button', { name: 'Remover Skill Fictícia 1' }));

    await waitFor(() => expect(api.bodies).toEqual([{ skillIds: [] }]));
    expect(await within(first).findByRole('button', { name: 'sem skill' })).toBeInTheDocument();
    expect(within(index()).getByRole('status').textContent).toBe('2 bullets sem skill não entram na ordenação por relevância.');
  });

  it('RES-67 closes the field with "Concluir" and shows the tags below the text again', async () => {
    open();
    await openFromMenu('Texto fictício do bullet 1.');
    const first = row('Texto fictício do bullet 1.');

    fireEvent.click(within(first).getByRole('button', { name: 'Concluir' }));

    expect(within(first).queryByRole('combobox')).toBeNull();
    expect(within(first).queryByRole('button', { name: 'Concluir' })).toBeNull();
    expect(within(first).getByText('Skill Fictícia 1')).toBeInTheDocument();
  });

  it('RES-67 puts the list back and says it could not save when the api fails', async () => {
    const { api } = open();
    await openFromMenu('Texto fictício do bullet 1.');
    const first = row('Texto fictício do bullet 1.');
    api.fail('bullet', { status: 400, detail: 'Invalid request body' });

    fireEvent.click(within(first).getByRole('button', { name: 'Remover Skill Fictícia 1' }));

    expect(await within(first).findByText(FAILED)).toBeInTheDocument();
    expect(within(first).queryByText('Invalid request body')).toBeNull();
    expect(await within(first).findByRole('button', { name: 'Remover Skill Fictícia 1' })).toBeInTheDocument();
    expect(within(index()).getByRole('status').textContent).toBe('1 bullet sem skill não entra na ordenação por relevância.');
  });

  it('RES-62 opens the field of skills of a bullet just created', async () => {
    const { api } = open();
    fireEvent.click(within(body()).getByRole('button', { name: '+ Bullet' }));
    const created = within(body()).getByRole('textbox', { name: 'Texto do novo bullet' });
    fireEvent.change(created, { target: { value: 'Texto fictício novo.' } });

    fireEvent.blur(created);

    await waitFor(() => expect(api.calls).toHaveLength(1));
    const fresh = await waitFor(() => row('Texto fictício novo.'));
    expect(field(fresh)).toBeInTheDocument();
    expect(within(fresh).getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
  });
});
