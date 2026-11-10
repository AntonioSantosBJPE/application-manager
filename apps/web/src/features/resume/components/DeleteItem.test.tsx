// @vitest-environment jsdom
import type { ResumeSection } from '@am/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeResume } from '../testing/fake-api';
import { bullet, certification, education, experience, language, masterResume, project } from '../testing/fixtures';
import { renderResumePage } from '../testing/page-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const open = (section: ResumeSection, resume = masterResume()) => {
  const api = fakeResume(server, resume);
  renderResumePage({ resume, section });
  return api;
};
const card = (name: string | RegExp) => screen.getByRole('article', { name });
const index = () => screen.getByRole('navigation', { name: 'Seções do currículo' });
const edit = (name: string | RegExp) => {
  const item = card(name);
  fireEvent.click(within(item).getByRole('button', { name: /^Editar (?!texto do bullet)/ }));
  return item;
};

const SECTIONS = [
  { section: 'experiences', item: experience(1), card: /Cargo Fictício 1/, button: 'Excluir experiência', title: 'Excluir experiência?' },
  { section: 'projects', item: project(1), card: 'Projeto Fictício 1', button: 'Excluir projeto', title: 'Excluir projeto?' },
  { section: 'educations', item: education(1), card: /Curso Fictício 1/, button: 'Excluir formação', title: 'Excluir formação?' },
  { section: 'certifications', item: certification(1), card: /Certificação Fictícia 1/, button: 'Excluir certificação', title: 'Excluir certificação?' },
  { section: 'languages', item: language(1), card: /Idioma Fictício 1/, button: 'Excluir idioma', title: 'Excluir idioma?' },
] as const;

describe('DeleteItem', () => {
  it.each(SECTIONS)(
    'RES-57 asks "$title" with "Excluir" in danger and "Cancelar" from "$button", and sends nothing before the confirmation',
    async ({ section, item, card: name, button, title }) => {
      const api = open(section, masterResume({ [section]: [item] }));
      const fields = edit(name);

      fireEvent.click(within(fields).getByRole('button', { name: button }));

      const box = await screen.findByRole('alertdialog', { name: title });
      const confirm = within(box).getByRole('button', { name: 'Excluir' });
      expect(confirm).toHaveClass('border-danger', 'bg-danger');
      expect(within(box).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
      fireEvent.click(within(box).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(api.calls).toEqual([]);
      expect(screen.getAllByRole('article')).toHaveLength(1);
    },
  );

  it('RES-57 puts the button "Excluir experiência" in the fields of the item, which open with the pencil', () => {
    open('experiences', masterResume({ experiences: [experience(1)] }));
    const item = card(/Cargo Fictício 1/);
    expect(within(item).queryByRole('button', { name: 'Excluir experiência' })).toBeNull();

    fireEvent.click(within(item).getByRole('button', { name: /^Editar (?!texto do bullet)/ }));

    expect(within(item).getByRole('button', { name: 'Excluir experiência' })).toBeInTheDocument();
  });

  it('RES-58 takes the item out of the section when the person confirms, and the other items stay', async () => {
    const api = open('experiences', masterResume({ experiences: [experience(1), experience(2)] }));
    const fields = edit(/Cargo Fictício 1/);
    fireEvent.click(within(fields).getByRole('button', { name: 'Excluir experiência' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(screen.queryByRole('article', { name: /Cargo Fictício 1/ })).toBeNull());
    expect(api.calls).toEqual([`DELETE /resume/experiences/${experience(1).id}`]);
    expect(screen.getByRole('article', { name: /Cargo Fictício 2/ })).toBeInTheDocument();
    expect(api.state.resume.experiences).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('RES-58 updates the number in the index and the warning of the bullets without skill', async () => {
    open(
      'experiences',
      masterResume({
        experiences: [experience(1, { bullets: [bullet(1, []), bullet(2, [])] }), experience(2, { bullets: [bullet(3, [])] })],
      }),
    );
    expect(within(index()).getByRole('link', { name: 'Experiência 2' })).toBeInTheDocument();
    expect(within(index()).getByRole('status').textContent).toBe('3 bullets sem skill não entram na ordenação por relevância.');
    const fields = edit(/Cargo Fictício 1/);
    fireEvent.click(within(fields).getByRole('button', { name: 'Excluir experiência' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(within(index()).getByRole('link', { name: 'Experiência 1' })).toBeInTheDocument());
    expect(within(index()).getByRole('status').textContent).toBe('1 bullet sem skill não entra na ordenação por relevância.');
  });

  it('RES-58 shows the sentence of the empty section and no number in the index when the last item goes', async () => {
    open('languages', masterResume({ languages: [language(1)] }));
    const fields = edit(/Idioma Fictício 1/);
    fireEvent.click(within(fields).getByRole('button', { name: 'Excluir idioma' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Nenhum idioma ainda.')).toBeInTheDocument();
    expect(within(index()).getByRole('link', { name: 'Idiomas' }).textContent).toBe('Idiomas');
  });

  it('RES-58 keeps the item and says it could not delete when the api fails', async () => {
    const api = open('projects', masterResume({ projects: [project(1)] }));
    api.fail('delete', { status: 500 });
    const fields = edit('Projeto Fictício 1');
    fireEvent.click(within(fields).getByRole('button', { name: 'Excluir projeto' }));

    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Não foi possível excluir. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Projeto Fictício 1' })).toBeInTheDocument();
    expect(api.state.resume.projects).toHaveLength(1);
  });
});
