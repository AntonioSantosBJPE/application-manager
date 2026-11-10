// @vitest-environment jsdom
import type { ResumeSection } from '@am/contracts';
import { fireEvent, screen, within } from '@testing-library/react';
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
  fakeResume(server, resume);
  renderResumePage({ resume, section });
};
const article = (name: string | RegExp) => screen.getByRole('article', { name });

describe('ItemsSection', () => {
  it.each([
    ['experiences', 'Nenhuma experiência ainda.', '+ Experiência'],
    ['projects', 'Nenhum projeto ainda.', '+ Projeto'],
    ['educations', 'Nenhuma formação ainda.', '+ Formação'],
    ['certifications', 'Nenhuma certificação ainda.', '+ Certificação'],
    ['languages', 'Nenhum idioma ainda.', '+ Idioma'],
  ] as const)('RES-39 shows "%s" empty with its sentence and the "+" of the header', (section, sentence, add) => {
    open(section);

    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: add })).toBeEnabled();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('RES-49 shows an experience as "Cargo · Empresa" with the dates in mono and the place', () => {
    open('experiences', masterResume({ experiences: [experience(1, { startDate: '2023-03', endDate: '2024-08', location: 'Recife, PE' })] }));

    const item = article('Cargo Fictício 1 · Empresa Fictícia 1');
    expect(within(item).getByText('Cargo Fictício 1 · Empresa Fictícia 1')).toBeInTheDocument();
    expect(within(item).getByText('mar 2023 — ago 2024')).toHaveClass('font-mono');
    expect(item.textContent).toContain('mar 2023 — ago 2024 · Recife, PE');
  });

  it('RES-49 shows a project as its name and its URL', () => {
    open('projects', masterResume({ projects: [project(1, { url: 'https://exemplo.com/projeto' })] }));

    const item = article('Projeto Fictício 1');
    expect(within(item).getByText('Projeto Fictício 1')).toBeInTheDocument();
    expect(within(item).getByText('https://exemplo.com/projeto')).toBeInTheDocument();
  });

  it('RES-49 shows an education as "Curso · Instituição" with its dates', () => {
    open('educations', masterResume({ educations: [education(1, { startDate: '2018-02', endDate: '2021-12' })] }));

    const item = article('Curso Fictício 1 · Instituição Fictícia 1');
    expect(within(item).getByText('fev 2018 — dez 2021')).toHaveClass('font-mono');
  });

  it('RES-49 shows a certification as "Nome · Emissor" with the issue month', () => {
    open('certifications', masterResume({ certifications: [certification(1, { issuedOn: '2022-06' })] }));

    const item = article('Certificação Fictícia 1 · Emissor Fictício 1');
    expect(within(item).getByText('jun 2022')).toHaveClass('font-mono');
  });

  it('RES-49 shows a language as "Idioma · Nível"', () => {
    open('languages', masterResume({ languages: [language(1, { language: 'Inglês', level: 'fluent' })] }));

    expect(within(article('Inglês · Fluente')).getByText('Inglês · Fluente')).toBeInTheDocument();
  });

  it('RES-50 shows "atual" for an experience and an education with no end', () => {
    open('experiences', masterResume({ experiences: [experience(1, { startDate: '2023-03', endDate: null })] }));
    expect(within(article(/Cargo Fictício 1/)).getByText('mar 2023 — atual')).toBeInTheDocument();
  });

  it('RES-50 shows "atual" for an education in progress', () => {
    open('educations', masterResume({ educations: [education(1, { startDate: '2024-02', endDate: null })] }));
    expect(within(article(/Curso Fictício 1/)).getByText('fev 2024 — atual')).toBeInTheDocument();
  });

  it('RES-56 opens the first experience expanded and the others collapsed with the chevron "Expandir"', () => {
    open(
      'experiences',
      masterResume({ experiences: [experience(1, { bullets: [bullet(1)] }), experience(2, { bullets: [bullet(2)] })] }),
    );

    const first = article(/Cargo Fictício 1/);
    const second = article(/Cargo Fictício 2/);
    expect(within(first).getByRole('button', { name: /^Cargo Fictício 1/ })).toHaveAttribute('aria-expanded', 'true');
    expect(within(first).getByRole('group', { name: /^Bullets de Cargo Fictício 1/ })).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: /^Expandir/ })).toBeNull();
    expect(within(second).getByRole('button', { name: /^Cargo Fictício 2/ })).toHaveAttribute('aria-expanded', 'false');
    expect(within(second).queryByRole('group', { name: /^Bullets de/ })).toBeNull();
    expect(within(second).getByRole('button', { name: /^Expandir Cargo Fictício 2/ })).toBeInTheDocument();
  });

  it('RES-56 toggles an item with its header, and expands a collapsed one with the chevron', () => {
    open('experiences', masterResume({ experiences: [experience(1), experience(2)] }));
    const first = article(/Cargo Fictício 1/);
    const second = article(/Cargo Fictício 2/);

    fireEvent.click(within(first).getByRole('button', { name: /^Cargo Fictício 1/ }));
    expect(within(first).queryByRole('group', { name: /^Bullets de/ })).toBeNull();
    expect(within(first).getByRole('button', { name: /^Expandir Cargo Fictício 1/ })).toBeInTheDocument();

    fireEvent.click(within(first).getByRole('button', { name: /^Cargo Fictício 1/ }));
    expect(within(first).getByRole('group', { name: /^Bullets de/ })).toBeInTheDocument();

    fireEvent.click(within(second).getByRole('button', { name: /^Expandir Cargo Fictício 2/ }));
    expect(within(second).getByRole('group', { name: /^Bullets de/ })).toBeInTheDocument();
    expect(within(second).queryByRole('button', { name: /^Expandir/ })).toBeNull();
  });

  it('RES-56 opens the first project expanded too, and gives no chevron to sections without bullets', () => {
    open('projects', masterResume({ projects: [project(1), project(2)] }));
    expect(within(article('Projeto Fictício 1')).getByRole('group', { name: /^Bullets de/ })).toBeInTheDocument();
    expect(within(article('Projeto Fictício 2')).getByRole('button', { name: /^Expandir/ })).toBeInTheDocument();
  });

  it('RES-56 shows no chevron and no expanded body on an education', () => {
    open('educations', masterResume({ educations: [education(1)] }));

    const item = article(/Curso Fictício 1/);
    expect(within(item).queryByRole('button', { name: /^Expandir/ })).toBeNull();
    expect(within(item).queryByRole('group')).toBeNull();
  });

  it('RES-82 disables the "+" of the header at 50 items and keeps it enabled at 49', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => experience(i + 1));
    open('experiences', masterResume({ experiences: many(49) }));
    expect(screen.getByRole('button', { name: '+ Experiência' })).toBeEnabled();
  });

  it('RES-82 disables the "+" of the header when the section holds 50 items', () => {
    open('experiences', masterResume({ experiences: Array.from({ length: 50 }, (_, i) => experience(i + 1)) }));
    expect(screen.getByRole('button', { name: '+ Experiência' })).toBeDisabled();
  });
});
