// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeResume } from '../testing/fake-api';
import { bullet, experience, masterResume, project } from '../testing/fixtures';
import { renderResumePage } from '../testing/page-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const index = () => screen.getByRole('navigation', { name: 'Seções do currículo' });
const link = (name: string | RegExp) => within(index()).getByRole('link', { name });

/** Three experiences (one with a bullet that names no skill), two projects, nothing else. */
const portfolio = () =>
  masterResume({
    experiences: [
      experience(1, { bullets: [bullet(1), bullet(2, [])] }),
      experience(2, { bullets: [bullet(3, [])] }),
      experience(3),
    ],
    projects: [project(1), project(2)],
  });

describe('ResumePage', () => {
  it('RES-35 shows the section of an index link, marks it in the index and tells the page to put it in the address', async () => {
    const { onSectionChange } = renderResumePage({ resume: portfolio(), section: 'profile' });
    expect(link('Perfil')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 2, name: 'Perfil' })).toBeInTheDocument();
    expect(link(/^Projetos/)).toHaveAttribute('href', '/resume?section=projects');

    fireEvent.click(link(/^Projetos/));

    expect(onSectionChange).toHaveBeenCalledExactlyOnceWith('projects');
    expect(await screen.findByRole('heading', { level: 2, name: 'Projetos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Perfil' })).toBeNull();
    expect(link(/^Projetos/)).toHaveAttribute('aria-current', 'page');
    expect(link('Perfil')).not.toHaveAttribute('aria-current');
  });

  it('RES-35 leaves a click with a modifier to the browser, so a section opens in a new tab', () => {
    const { onSectionChange } = renderResumePage({ resume: portfolio(), section: 'profile' });

    const projects = link(/^Projetos/);
    projects.addEventListener('click', (event) => event.preventDefault()); // jsdom cannot open a tab

    fireEvent.click(projects, { ctrlKey: true });

    expect(onSectionChange).not.toHaveBeenCalled();
  });

  it('RES-37 shows the number of items of each section in mono, and no number for a section with none', () => {
    renderResumePage({ resume: portfolio(), section: 'experiences' });

    expect(link('Experiência 3')).toBeInTheDocument();
    expect(link('Projetos 2')).toBeInTheDocument();
    expect(within(link('Experiência 3')).getByText('3')).toHaveClass('font-mono');
    for (const name of ['Perfil', 'Formação', 'Certificações', 'Idiomas']) {
      expect(link(name).textContent).toBe(name);
    }
  });

  it('RES-38 warns with the plural when two bullets have no skill', () => {
    renderResumePage({ resume: portfolio() });

    expect(within(index()).getByRole('status')).toHaveTextContent(
      '2 bullets sem skill não entram na ordenação por relevância.',
    );
  });

  it('RES-38 draws the warning in the warning variant of the Alert', () => {
    renderResumePage({ resume: portfolio() });

    expect(within(index()).getByRole('status')).toHaveClass('border-warning', 'bg-warning-subtle', 'text-warning');
  });

  it('RES-38 warns with the singular when one bullet has no skill', () => {
    renderResumePage({ resume: masterResume({ experiences: [experience(1, { bullets: [bullet(1), bullet(2, [])] })] }) });

    expect(within(index()).getByRole('status').textContent).toBe(
      '1 bullet sem skill não entra na ordenação por relevância.',
    );
  });

  it('RES-38 shows no warning when every bullet has a skill', () => {
    renderResumePage({ resume: masterResume({ experiences: [experience(1, { bullets: [bullet(1)] })] }) });

    expect(within(index()).queryByRole('status')).toBeNull();
    expect(screen.queryByText(/sem skill/)).toBeNull();
  });

  it('RES-41 shows the title of the topbar and no "Visualizar PDF"', () => {
    renderResumePage({ resume: portfolio() });

    expect(screen.getByRole('heading', { level: 1, name: 'Currículo mestre' })).toBeInTheDocument();
    expect(screen.queryByText('Visualizar PDF')).toBeNull();
    expect(screen.queryByRole('button', { name: /PDF/ })).toBeNull();
  });

  it('RES-40 shows the failure with "Tentar de novo", and reading again shows the resume', async () => {
    const api = fakeResume(server, portfolio());
    renderResumePage({ outcome: { ok: false, status: 503 }, section: 'experiences' });
    expect(screen.getByText('Não foi possível carregar o currículo.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Seções do currículo' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Experiência' })).toBeInTheDocument();
    expect(link('Experiência 3')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar o currículo.')).toBeNull();
    expect(api.calls).toEqual(['GET /resume']);
  });

  it('RES-40 keeps the failure when reading again fails too', async () => {
    const api = fakeResume(server, portfolio());
    api.fail('load', { status: 503 });
    renderResumePage({ outcome: { ok: false, status: 503 } });

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await waitFor(() => expect(api.calls).toEqual(['GET /resume']));
    expect(await screen.findByText('Não foi possível carregar o currículo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled();
  });

  it('RES-40 hands a 401 to the session redirect and shows nothing of the page', () => {
    const { onExpired } = renderResumePage({ outcome: { ok: false, status: 401 } });

    expect(onExpired).toHaveBeenCalledExactlyOnceWith({ ok: false, status: 401 });
    expect(screen.queryByText('Não foi possível carregar o currículo.')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Seções do currículo' })).toBeNull();
  });
});
