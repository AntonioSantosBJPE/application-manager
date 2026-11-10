// @vitest-environment jsdom
import type { ResumeSection } from '@am/contracts';
import type { SortableListProps } from '@am/ui';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeResume } from '../testing/fake-api';
import { bullet, experience, masterResume, project, skillsOf } from '../testing/fixtures';
import { renderResumePage } from '../testing/page-harness';

// The drop of a drag needs the layout of a browser; here every `Sortable.List` is the real one, and the test
// keeps the props the screen gave it so it can drop, as the library would, by calling `onReorder` (the drag
// itself is proved in the browser tests of packages/ui and in the E2E).
const lists = new Map<string, SortableListProps>();
vi.mock('@am/ui', async (importOriginal) => {
  const ui = await importOriginal<typeof import('@am/ui')>();
  const List = (props: SortableListProps) => {
    lists.set(props['aria-label'], props);
    return <ui.Sortable.List {...props} />;
  };
  return { ...ui, Sortable: { ...ui.Sortable, List } };
});

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => lists.clear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const REORDER_FAILED = 'Não foi possível salvar a nova ordem.';
const [a, b, c] = [experience(1, { bullets: [bullet(1), bullet(2), bullet(3)] }), experience(2), experience(3)];

const open = (section: ResumeSection = 'experiences', resume = masterResume({ experiences: [a, b, c], projects: [project(1), project(2)], skills: skillsOf(1) })) => {
  const api = fakeResume(server, resume);
  renderResumePage({ resume, section });
  return api;
};
const list = (label: string) => lists.get(label)!;
const drop = (label: string, ids: string[]) => act(async () => list(label).onReorder(ids));
const titles = () => screen.getAllByRole('article').map((article) => article.getAttribute('aria-label'));
const bulletTexts = () =>
  screen.getAllByRole('button', { name: /^Editar texto do bullet / }).map((button) => button.textContent?.replace(/^Editar texto do bullet /, ''));
const BULLETS = 'Ordem dos bullets de Cargo Fictício 1 · Empresa Fictícia 1';

describe('Reorder', () => {
  it('RES-70 shows the new order of the experiences at once and saves it with every id', async () => {
    const api = open();
    expect(titles()).toEqual([
      'Cargo Fictício 1 · Empresa Fictícia 1',
      'Cargo Fictício 2 · Empresa Fictícia 2',
      'Cargo Fictício 3 · Empresa Fictícia 3',
    ]);

    await drop('Lista de experiências', [c.id, a.id, b.id]);

    await waitFor(() =>
      expect(titles()).toEqual([
        'Cargo Fictício 3 · Empresa Fictícia 3',
        'Cargo Fictício 1 · Empresa Fictícia 1',
        'Cargo Fictício 2 · Empresa Fictícia 2',
      ]),
    );
    await waitFor(() => expect(api.calls).toEqual(['PUT /resume/experiences/order']));
    expect(api.bodies).toEqual([{ ids: [c.id, a.id, b.id] }]);
    expect(api.state.resume.experiences.map((item) => item.id)).toEqual([c.id, a.id, b.id]);
    expect(screen.queryByText(REORDER_FAILED)).toBeNull();
  });

  it('RES-70 shows the new order before the api answers', async () => {
    const api = open();
    const release = api.hold('order');

    await drop('Lista de experiências', [c.id, a.id, b.id]);

    await waitFor(() => expect(api.calls).toEqual(['PUT /resume/experiences/order']));
    expect(titles()[0]).toBe('Cargo Fictício 3 · Empresa Fictícia 3');
    release();
    await waitFor(() => expect(api.state.resume.experiences[0]!.id).toBe(c.id));
    expect(titles()[0]).toBe('Cargo Fictício 3 · Empresa Fictícia 3');
  });

  it('RES-70 orders the items of the projects section on its own route', async () => {
    const api = open('projects');
    const [one, two] = [project(1), project(2)];

    await drop('Lista de projetos', [two.id, one.id]);

    await waitFor(() => expect(titles()).toEqual(['Projeto Fictício 2', 'Projeto Fictício 1']));
    await waitFor(() => expect(api.calls).toEqual(['PUT /resume/projects/order']));
    expect(api.bodies).toEqual([{ ids: [two.id, one.id] }]);
  });

  it('RES-71 shows the new order of the bullets of an item and saves it on the route of that item', async () => {
    const api = open();
    expect(bulletTexts()).toEqual(['Texto fictício do bullet 1.', 'Texto fictício do bullet 2.', 'Texto fictício do bullet 3.']);
    const [one, two, three] = a.bullets;

    await drop(BULLETS, [three!.id, one!.id, two!.id]);

    await waitFor(() =>
      expect(bulletTexts()).toEqual(['Texto fictício do bullet 3.', 'Texto fictício do bullet 1.', 'Texto fictício do bullet 2.']),
    );
    await waitFor(() => expect(api.calls.length).toBe(1));
    expect(api.calls).toEqual([`PUT /resume/experiences/${a.id}/bullets/order`]);
    expect(api.bodies).toEqual([{ ids: [three!.id, one!.id, two!.id] }]);
    // The order of the items did not change.
    expect(titles()[0]).toBe('Cargo Fictício 1 · Empresa Fictícia 1');
  });

  it('RES-72 gives every item and bullet a handle with its name, and tells the screen reader how to use it in pt-BR', () => {
    open();

    const handle = screen.getByRole('button', { name: 'Mover Cargo Fictício 2 · Empresa Fictícia 2' });
    expect(handle).toHaveAttribute('aria-roledescription', 'item arrastável');
    const instructions = document.getElementById(handle.getAttribute('aria-describedby')!)!;
    expect(instructions.textContent).toBe('Pegue com Espaço ou Enter, mova com as setas e solte com Espaço ou Enter. Esc cancela.');
    expect(screen.getByRole('button', { name: /^Mover bullet “Texto fictício do bullet 1\.”$/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Mover / })).toHaveLength(3 + 3);
  });

  it('RES-72 writes each step of the move in pt-BR for the live region, naming the item', () => {
    open();
    const { announcements } = list('Lista de experiências');
    const step = { id: b.id, position: 2, total: 3 };

    expect(announcements.onPick(step)).toBe('Cargo Fictício 2 · Empresa Fictícia 2 pego. Posição 2 de 3.');
    expect(announcements.onMove({ ...step, position: 1 })).toBe(
      'Cargo Fictício 2 · Empresa Fictícia 2 movido para a posição 1 de 3.',
    );
    expect(announcements.onDrop({ ...step, position: 1 })).toBe(
      'Cargo Fictício 2 · Empresa Fictícia 2 solto na posição 1 de 3.',
    );
    expect(announcements.onCancel(step)).toBe(
      'Movimento cancelado. Cargo Fictício 2 · Empresa Fictícia 2 voltou à posição 2 de 3.',
    );
  });

  it('RES-72 names a bullet by the start of its text in the live region', () => {
    open();
    const { announcements } = list(BULLETS);

    expect(announcements.onPick({ id: a.bullets[0]!.id, position: 1, total: 3 })).toBe(
      'bullet “Texto fictício do bullet 1.” pego. Posição 1 de 3.',
    );
  });

  it('RES-73 announces the cancel with Esc in the live region, puts the item back and sends nothing', async () => {
    const api = open();
    const handle = screen.getByRole('button', { name: 'Mover Cargo Fictício 2 · Empresa Fictícia 2' });
    handle.focus();

    fireEvent.keyDown(handle, { code: 'Space', key: ' ' });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    fireEvent.keyDown(document, { code: 'Escape', key: 'Escape' });

    await waitFor(() =>
      expect(document.body.textContent).toContain(
        'Movimento cancelado. Cargo Fictício 2 · Empresa Fictícia 2 voltou à posição 2 de 3.',
      ),
    );
    expect(titles()[1]).toBe('Cargo Fictício 2 · Empresa Fictícia 2');
    expect(api.calls).toEqual([]);
  });

  it('RES-74 puts the items back and says it could not save the new order when the api fails', async () => {
    const api = open();
    api.fail('order', { status: 500 });

    await drop('Lista de experiências', [c.id, a.id, b.id]);

    await waitFor(() => expect(screen.getByText(REORDER_FAILED)).toBeInTheDocument());
    expect(titles()).toEqual([
      'Cargo Fictício 1 · Empresa Fictícia 1',
      'Cargo Fictício 2 · Empresa Fictícia 2',
      'Cargo Fictício 3 · Empresa Fictícia 3',
    ]);
    expect(api.state.resume.experiences.map((item) => item.id)).toEqual([a.id, b.id, c.id]);
  });

  it('RES-74 puts the bullets back and says it could not save the new order when the network fails', async () => {
    const api = open();
    api.fail('order', 'network');
    const [one, two, three] = a.bullets;

    await drop(BULLETS, [two!.id, three!.id, one!.id]);

    await waitFor(() => expect(screen.getByText(REORDER_FAILED)).toBeInTheDocument());
    expect(bulletTexts()).toEqual(['Texto fictício do bullet 1.', 'Texto fictício do bullet 2.', 'Texto fictício do bullet 3.']);
  });

  it('RES-75 reads the resume again and shows the saved order when the api refuses the order with 400', async () => {
    const api = open();
    // Another tab added an experience and reordered, so the order sent does not list every id of the section.
    const other = experience(4);
    api.state.resume.experiences = [other, c, b, a];

    await drop('Lista de experiências', [c.id, a.id, b.id]);

    await waitFor(() => expect(titles()).toHaveLength(4));
    expect(api.calls).toEqual(['PUT /resume/experiences/order', 'GET /resume']);
    expect(titles()).toEqual([
      'Cargo Fictício 4 · Empresa Fictícia 4',
      'Cargo Fictício 3 · Empresa Fictícia 3',
      'Cargo Fictício 2 · Empresa Fictícia 2',
      'Cargo Fictício 1 · Empresa Fictícia 1',
    ]);
    expect(screen.queryByText(REORDER_FAILED)).toBeNull();
  });

  it('RES-75 reads the resume again for a refused order of bullets and shows the saved order', async () => {
    const api = open();
    const [one, two, three] = a.bullets;
    api.state.resume.experiences[0]!.bullets = [three!, two!, one!, bullet(9)];

    await drop(BULLETS, [two!.id, one!.id, three!.id]);

    await waitFor(() => expect(bulletTexts()).toHaveLength(4));
    expect(api.calls).toEqual([`PUT /resume/experiences/${a.id}/bullets/order`, 'GET /resume']);
    expect(bulletTexts()).toEqual([
      'Texto fictício do bullet 3.',
      'Texto fictício do bullet 2.',
      'Texto fictício do bullet 1.',
      'Texto fictício do bullet 9.',
    ]);
  });

  it('RES-70 leaves a new item that is not written yet out of the order that is saved', async () => {
    const api = open();
    fireEvent.click(screen.getByRole('button', { name: '+ Experiência' }));
    expect(within(screen.getByRole('list', { name: 'Lista de experiências' })).getAllByRole('article')).toHaveLength(4);

    await drop('Lista de experiências', [c.id, 'draft-0', a.id, b.id]);

    await waitFor(() => expect(api.bodies).toEqual([{ ids: [c.id, a.id, b.id] }]));
  });
});
