// @vitest-environment jsdom
import type { ResumeSection } from '@am/contracts';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeResume } from '../testing/fake-api';
import { certification, education, experience, language, masterResume, project } from '../testing/fixtures';
import { renderResumePage } from '../testing/page-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const REQUIRED = 'Preencha os campos obrigatórios para salvar.';
const FAILED = 'Não foi possível salvar. Tente de novo.';

const open = (section: ResumeSection, resume = masterResume()) => {
  const api = fakeResume(server, resume);
  renderResumePage({ resume, section });
  return api;
};
const card = (name: string | RegExp) => screen.getByRole('article', { name });
const topbarStatus = () => screen.getAllByRole('status').find((node) => node.closest('[class*="border-b"]') !== null)!;
const set = (scope: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } });
const leave = (scope: HTMLElement, label: string) => fireEvent.blur(within(scope).getByLabelText(label));
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

/** Each section with its add button, the title of the new item, what a person fills in and the body that creates it. */
const SECTIONS = [
  {
    section: 'experiences',
    add: '+ Experiência',
    title: 'Nova experiência',
    labels: ['Cargo', 'Empresa', 'Local · opcional', 'Início', 'Fim', 'Trabalho aqui atualmente'],
    fill: (scope: HTMLElement) => {
      set(scope, 'Cargo', 'Cargo Fictício');
      set(scope, 'Empresa', 'Empresa Fictícia');
      set(scope, 'Início', '2023-03');
      fireEvent.click(within(scope).getByLabelText('Trabalho aqui atualmente'));
    },
    body: { role: 'Cargo Fictício', company: 'Empresa Fictícia', location: null, startDate: '2023-03', endDate: null },
    header: 'Cargo Fictício · Empresa Fictícia',
  },
  {
    section: 'projects',
    add: '+ Projeto',
    title: 'Novo projeto',
    labels: ['Nome', 'URL · opcional', 'Descrição · opcional'],
    fill: (scope: HTMLElement) => {
      set(scope, 'Nome', 'Projeto Fictício');
      leave(scope, 'Nome');
    },
    body: { name: 'Projeto Fictício', url: null, description: null },
    header: 'Projeto Fictício',
  },
  {
    section: 'educations',
    add: '+ Formação',
    title: 'Nova formação',
    labels: ['Curso', 'Instituição', 'Início', 'Fim', 'Em andamento'],
    fill: (scope: HTMLElement) => {
      set(scope, 'Curso', 'Curso Fictício');
      set(scope, 'Instituição', 'Instituição Fictícia');
      set(scope, 'Início', '2024-02');
      fireEvent.click(within(scope).getByLabelText('Em andamento'));
    },
    body: { course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2024-02', endDate: null },
    header: 'Curso Fictício · Instituição Fictícia',
  },
  {
    section: 'certifications',
    add: '+ Certificação',
    title: 'Nova certificação',
    labels: ['Nome', 'Emissor · opcional', 'Emissão · opcional', 'URL · opcional'],
    fill: (scope: HTMLElement) => {
      set(scope, 'Nome', 'Certificação Fictícia');
      leave(scope, 'Nome');
    },
    body: { name: 'Certificação Fictícia', issuer: null, issuedOn: null, url: null },
    header: 'Certificação Fictícia',
  },
  {
    section: 'languages',
    add: '+ Idioma',
    title: 'Novo idioma',
    labels: ['Idioma'],
    fill: (scope: HTMLElement) => {
      set(scope, 'Idioma', 'Inglês');
      fireEvent.click(within(scope).getByRole('radio', { name: 'Fluente' }));
    },
    body: { language: 'Inglês', level: 'fluent' },
    header: 'Inglês · Fluente',
  },
] as const;

describe('ItemFields: a new item', () => {
  it.each(SECTIONS)(
    'RES-51 opens an empty item at the top of $section, in edition, with its fields and the focus in the first, sending nothing',
    async ({ section, add, title, labels }) => {
      const existing = { experiences: experience(1), projects: project(1), educations: education(1), certifications: certification(1), languages: language(1) }[section];
      const api = open(section, masterResume({ [section]: [existing] }));

      fireEvent.click(screen.getByRole('button', { name: add }));

      const item = card(title);
      expect(screen.getAllByRole('article')[0]).toBe(item);
      expect(screen.getAllByRole('article')).toHaveLength(2);
      for (const label of labels) expect(within(item).getByLabelText(label)).toBeInTheDocument();
      expect(within(item).getByLabelText(labels[0])).toHaveFocus();
      await settle();
      expect(api.calls).toEqual([]);
    },
  );

  it('RES-51 opens the item in the empty section too, in place of the sentence "Nenhuma experiência ainda."', () => {
    open('experiences');

    fireEvent.click(screen.getByRole('button', { name: '+ Experiência' }));

    expect(screen.queryByText('Nenhuma experiência ainda.')).toBeNull();
    expect(card('Nova experiência')).toBeInTheDocument();
  });

  it.each(SECTIONS)('RES-52 says the required fields are missing and sends nothing while $section is incomplete', async ({ section, add, title }) => {
    const api = open(section);
    fireEvent.click(screen.getByRole('button', { name: add }));
    const item = card(title);
    expect(within(item).getByText(REQUIRED)).toBeInTheDocument();

    fireEvent.blur(within(item).getAllByRole('textbox')[0]!);
    await settle();

    expect(within(item).getByText(REQUIRED)).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('RES-52 keeps saying it while the experience has its texts but no end and no "atualmente"', async () => {
    const api = open('experiences');
    fireEvent.click(screen.getByRole('button', { name: '+ Experiência' }));
    const item = card('Nova experiência');
    set(item, 'Cargo', 'Cargo Fictício');
    set(item, 'Empresa', 'Empresa Fictícia');
    set(item, 'Início', '2023-03');

    leave(item, 'Início');
    await settle();

    expect(within(item).getByText(REQUIRED)).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it.each(SECTIONS)('RES-53 creates the $section item once the required fields are valid, shows "Salvo às" and drops the notice', async ({ section, add, title, fill, body, header }) => {
    const api = open(section);
    fireEvent.click(screen.getByRole('button', { name: add }));
    const item = card(title);

    fill(item);

    await waitFor(() => expect(api.calls).toEqual([`POST /resume/${section}`]));
    expect(api.bodies).toEqual([body]);
    expect(await screen.findByRole('article', { name: header })).toBe(item);
    expect(within(item).queryByText(REQUIRED)).toBeNull();
    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às \d{2}:\d{2}$/));
    expect(api.state.resume[section]).toHaveLength(1);
  });

  it('RES-53 keeps the card and its fields after the item is created, so the next field is a PATCH', async () => {
    const api = open('experiences');
    fireEvent.click(screen.getByRole('button', { name: '+ Experiência' }));
    const item = card('Nova experiência');
    SECTIONS[0].fill(item);
    await waitFor(() => expect(api.calls).toHaveLength(1));
    await screen.findByRole('article', { name: 'Cargo Fictício · Empresa Fictícia' });

    set(item, 'Local · opcional', 'Recife, PE');
    leave(item, 'Local · opcional');

    await waitFor(() => expect(api.calls).toHaveLength(2));
    expect(api.calls[1]).toMatch(/^PATCH \/resume\/experiences\//);
    expect(api.bodies[1]).toEqual({ location: 'Recife, PE' });
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('RES-53 creates a single item when two fields are left while the POST is in flight, and the second becomes a PATCH', async () => {
    const api = open('experiences');
    const release = api.hold('create');
    fireEvent.click(screen.getByRole('button', { name: '+ Experiência' }));
    const item = card('Nova experiência');
    set(item, 'Cargo', 'Cargo Fictício');
    set(item, 'Empresa', 'Empresa Fictícia');
    set(item, 'Início', '2023-03');
    fireEvent.click(within(item).getByLabelText('Trabalho aqui atualmente'));
    await waitFor(() => expect(api.calls).toEqual(['POST /resume/experiences']));

    set(item, 'Local · opcional', 'Recife, PE');
    leave(item, 'Local · opcional');
    leave(item, 'Cargo');
    release();

    await waitFor(() => expect(api.calls).toHaveLength(2));
    await settle();
    expect(api.calls).toEqual(['POST /resume/experiences', expect.stringMatching(/^PATCH \/resume\/experiences\//)]);
    expect(api.bodies[1]).toEqual({ location: 'Recife, PE' });
    expect(api.state.resume.experiences).toHaveLength(1);
    expect(api.state.resume.experiences[0]).toMatchObject({ location: 'Recife, PE' });
  });

  it('RES-48 keeps the typed values and says it could not save when the create fails, and leaving again tries again', async () => {
    const api = open('projects');
    api.fail('create', { status: 500 });
    fireEvent.click(screen.getByRole('button', { name: '+ Projeto' }));
    const item = card('Novo projeto');
    set(item, 'Nome', 'Projeto Fictício');

    leave(item, 'Nome');

    expect(await within(item).findByText(FAILED)).toBeInTheDocument();
    expect((within(item).getByLabelText('Nome') as HTMLInputElement).value).toBe('Projeto Fictício');
    expect(topbarStatus().textContent).toBe('');

    leave(item, 'Nome');

    await waitFor(() => expect(api.calls).toEqual(['POST /resume/projects', 'POST /resume/projects']));
    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às/));
    expect(within(item).queryByText(FAILED)).toBeNull();
  });

  it('RES-59 shows the end error in the end field and sends nothing when the end is before the start of a new item', async () => {
    const api = open('educations');
    fireEvent.click(screen.getByRole('button', { name: '+ Formação' }));
    const item = card('Nova formação');
    set(item, 'Curso', 'Curso Fictício');
    set(item, 'Instituição', 'Instituição Fictícia');
    set(item, 'Início', '2024-05');
    set(item, 'Fim', '2024-01');

    leave(item, 'Fim');

    expect(await within(item).findByText('O fim não pode ser antes do início.')).toBeInTheDocument();
    expect(within(item).getByLabelText('Fim')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls).toEqual([]);
  });
});

describe('ItemFields: a saved item', () => {
  const pencil = (scope: HTMLElement) => within(scope).getByRole('button', { name: /^Editar (?!texto do bullet)/ });

  it('RES-54 shows the fields of the item, filled, with the pencil "Editar"', () => {
    open('experiences', masterResume({ experiences: [experience(1, { location: 'Recife, PE', endDate: '2024-08' })] }));
    const item = card(/Cargo Fictício 1/);
    expect(within(item).queryByLabelText('Cargo')).toBeNull();

    fireEvent.click(pencil(item));

    expect((within(item).getByLabelText('Cargo') as HTMLInputElement).value).toBe('Cargo Fictício 1');
    expect((within(item).getByLabelText('Empresa') as HTMLInputElement).value).toBe('Empresa Fictícia 1');
    expect((within(item).getByLabelText('Local · opcional') as HTMLInputElement).value).toBe('Recife, PE');
    expect((within(item).getByLabelText('Início') as HTMLInputElement).value).toBe('2023-03');
    expect((within(item).getByLabelText('Fim') as HTMLInputElement).value).toBe('2024-08');
    expect(within(item).getByLabelText('Trabalho aqui atualmente')).not.toBeChecked();
  });

  it('RES-54 saves only the field that changed when it is left, and the header follows', async () => {
    const api = open('experiences', masterResume({ experiences: [experience(1)] }));
    const item = card(/Cargo Fictício 1/);
    fireEvent.click(pencil(item));

    set(item, 'Empresa', 'Empresa Fictícia Nova');
    leave(item, 'Empresa');

    await waitFor(() => expect(api.calls).toEqual([expect.stringMatching(/^PATCH \/resume\/experiences\//)]));
    expect(api.bodies).toEqual([{ company: 'Empresa Fictícia Nova' }]);
    expect(await screen.findByRole('article', { name: 'Cargo Fictício 1 · Empresa Fictícia Nova' })).toBeInTheDocument();
    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às/));
  });

  it('RES-54 sends nothing when a field is left unchanged', async () => {
    const api = open('projects', masterResume({ projects: [project(1)] }));
    const item = card('Projeto Fictício 1');
    fireEvent.click(pencil(item));

    leave(item, 'Nome');
    set(item, 'Nome', '  Projeto Fictício 1  ');
    leave(item, 'Nome');
    await settle();

    expect(api.calls).toEqual([]);
    expect(topbarStatus().textContent).toBe('');
  });

  it('RES-54 keeps the bullets of the item in the cache when its fields are saved', async () => {
    const api = open('experiences', masterResume({ experiences: [experience(1, { bullets: [{ id: 'b1', text: 'Texto.', skillIds: [] }] })] }));
    const item = card(/Cargo Fictício 1/);
    fireEvent.click(pencil(item));

    set(item, 'Cargo', 'Cargo Novo');
    leave(item, 'Cargo');

    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(await screen.findByRole('article', { name: 'Cargo Novo · Empresa Fictícia 1' })).toBeInTheDocument();
    expect(screen.getByText(/1 bullet sem skill/)).toBeInTheDocument();
  });

  it('RES-48 keeps the value and shows the pt-BR phrase when saving a field of an item fails', async () => {
    const api = open('projects', masterResume({ projects: [project(1)] }));
    api.fail('update', { status: 400, detail: 'Invalid request body' });
    const item = card('Projeto Fictício 1');
    fireEvent.click(pencil(item));

    set(item, 'Nome', 'Projeto Novo');
    leave(item, 'Nome');

    expect(await within(item).findByText(FAILED)).toBeInTheDocument();
    expect(within(item).queryByText('Invalid request body')).toBeNull();
    expect((within(item).getByLabelText('Nome') as HTMLInputElement).value).toBe('Projeto Novo');
    expect(topbarStatus().textContent).toBe('');
  });

  it('RES-47 shows the link error and sends nothing for a project URL that is not http or https', async () => {
    const api = open('projects', masterResume({ projects: [project(1)] }));
    const item = card('Projeto Fictício 1');
    fireEvent.click(pencil(item));

    set(item, 'URL · opcional', 'ftp://exemplo.com/p');
    leave(item, 'URL · opcional');

    expect(await within(item).findByText('Use um link que comece com http:// ou https://.')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('RES-85 shows the limit and sends nothing when a pasted text passes the limit of the field', async () => {
    const api = open('projects', masterResume({ projects: [project(1)] }));
    const item = card('Projeto Fictício 1');
    fireEvent.click(pencil(item));

    set(item, 'Nome', 'a'.repeat(161));
    leave(item, 'Nome');

    expect(await within(item).findByText('Use no máximo 160 caracteres.')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('RES-55 hides the end field and saves the experience with no end when "Trabalho aqui atualmente" is checked', async () => {
    const api = open('experiences', masterResume({ experiences: [experience(1, { endDate: '2024-08' })] }));
    const item = card(/Cargo Fictício 1/);
    expect(within(item).getByText('mar 2023 — ago 2024')).toBeInTheDocument();
    fireEvent.click(pencil(item));

    fireEvent.click(within(item).getByLabelText('Trabalho aqui atualmente'));

    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(api.bodies).toEqual([{ startDate: '2023-03', endDate: null }]);
    expect(within(item).queryByLabelText('Fim')).toBeNull();
    expect(await within(item).findByText('mar 2023 — atual')).toBeInTheDocument();
  });

  it('RES-55 hides the end field and saves the education with no end when "Em andamento" is checked', async () => {
    const api = open('educations', masterResume({ educations: [education(1, { endDate: '2021-12' })] }));
    const item = card(/Curso Fictício 1/);
    fireEvent.click(pencil(item));

    fireEvent.click(within(item).getByLabelText('Em andamento'));

    await waitFor(() => expect(api.bodies).toEqual([{ startDate: '2018-02', endDate: null }]));
    expect(within(item).queryByLabelText('Fim')).toBeNull();
  });

  it('RES-55 brings the end field back when the box is unchecked, and saves once an end is given', async () => {
    const api = open('experiences', masterResume({ experiences: [experience(1, { endDate: null })] }));
    const item = card(/Cargo Fictício 1/);
    fireEvent.click(pencil(item));
    expect(within(item).getByLabelText('Trabalho aqui atualmente')).toBeChecked();
    expect(within(item).queryByLabelText('Fim')).toBeNull();

    fireEvent.click(within(item).getByLabelText('Trabalho aqui atualmente'));
    expect(within(item).getByLabelText('Fim')).toBeInTheDocument();
    await settle();
    expect(api.calls).toEqual([]);

    set(item, 'Fim', '2024-08');
    leave(item, 'Fim');

    await waitFor(() => expect(api.bodies).toEqual([{ startDate: '2023-03', endDate: '2024-08' }]));
  });

  it('RES-59 shows "O fim não pode ser antes do início." in the end field and sends nothing', async () => {
    const api = open('experiences', masterResume({ experiences: [experience(1, { endDate: '2024-08' })] }));
    const item = card(/Cargo Fictício 1/);
    fireEvent.click(pencil(item));

    set(item, 'Fim', '2022-01');
    leave(item, 'Fim');

    expect(await within(item).findByText('O fim não pode ser antes do início.')).toBeInTheDocument();
    expect(within(item).getByLabelText('Fim')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls).toEqual([]);
  });

  it('RES-59 shows the same error in the end field when the start is moved after the end', async () => {
    const api = open('educations', masterResume({ educations: [education(1, { startDate: '2018-02', endDate: '2021-12' })] }));
    const item = card(/Curso Fictício 1/);
    fireEvent.click(pencil(item));

    set(item, 'Início', '2023-01');
    leave(item, 'Início');

    expect(await within(item).findByText('O fim não pode ser antes do início.')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('RES-54 saves the level of a language as soon as it is chosen', async () => {
    const api = open('languages', masterResume({ languages: [language(1, { language: 'Inglês', level: 'basic' })] }));
    const item = card('Inglês · Básico');
    fireEvent.click(pencil(item));

    fireEvent.click(within(item).getByRole('radio', { name: 'Nativo' }));

    await waitFor(() => expect(api.bodies).toEqual([{ level: 'native' }]));
    expect(await screen.findByRole('article', { name: 'Inglês · Nativo' })).toBeInTheDocument();
  });

  it('RES-54 saves the issue month of a certification when it is left, and an emptied one as no value', async () => {
    const api = open('certifications', masterResume({ certifications: [certification(1, { issuedOn: '2022-06' })] }));
    const item = card(/Certificação Fictícia 1/);
    fireEvent.click(pencil(item));

    set(item, 'Emissão · opcional', '');
    leave(item, 'Emissão · opcional');

    await waitFor(() => expect(api.bodies).toEqual([{ issuedOn: null }]));
  });
});
