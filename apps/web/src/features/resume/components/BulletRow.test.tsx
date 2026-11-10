// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeResume } from '../testing/fake-api';
import { bullet, experience, masterResume, skillId, skillsOf } from '../testing/fixtures';
import { renderResumePage } from '../testing/page-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FAILED = 'Não foi possível salvar. Tente de novo.';

/** One experience, open, with a tagged bullet and a bullet with no skill. */
const portfolio = (extra: Partial<Parameters<typeof experience>[1]> = {}) =>
  masterResume({
    experiences: [experience(1, { bullets: [bullet(1, [1, 2]), bullet(2, []), ...(extra.bullets ?? [])] })],
    skills: skillsOf(1, 2),
  });

const open = (resume = portfolio()) => {
  const api = fakeResume(server, resume);
  renderResumePage({ resume, section: 'experiences' });
  return api;
};
const body = () => screen.getByRole('group', { name: /^Bullets de/ });
const row = (text: string) => within(body()).getByRole('button', { name: new RegExp(`^Editar texto do bullet ${text}`) }).closest('.group\\/bullet') as HTMLElement;
const topbarStatus = () => screen.getAllByRole('status').find((node) => node.closest('[class*="border-b"]') !== null)!;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const index = () => screen.getByRole('navigation', { name: 'Seções do currículo' });

describe('BulletRow', () => {
  it('RES-60 shows the text in body-lg with its skills as tags below, read from the dictionary, and no "sem skill"', () => {
    open();

    const first = row('Texto fictício do bullet 1.');
    expect(within(first).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ }).closest('.text-body-lg')).not.toBeNull();
    expect(within(first).getByText('Skill Fictícia 1')).toBeInTheDocument();
    expect(within(first).getByText('Skill Fictícia 2')).toBeInTheDocument();
    expect(within(first).queryByText('sem skill')).toBeNull();
  });

  it('RES-60 marks a private skill as private and leaves out a skill the dictionary does not know', () => {
    const resume = masterResume({
      experiences: [experience(1, { bullets: [bullet(1, [1, 3])] })],
      skills: { [skillId(1)]: { name: 'Skill Fictícia 1', scope: 'private' } },
    });
    open(resume);

    const first = row('Texto fictício do bullet 1.');
    expect(within(first).getByText('Skill Fictícia 1').parentElement?.textContent).toContain('·');
    expect(within(first).getAllByText(/^Skill Fictícia/)).toHaveLength(1);
  });

  it('RES-60 shows "sem skill" in warning on a bullet with no skill, and no tags', () => {
    open();

    const second = row('Texto fictício do bullet 2.');
    expect(within(second).getByText('sem skill')).toBeInTheDocument();
    expect(within(second).getByText('sem skill').closest('span')).toHaveClass('text-warning');
    expect(within(second).queryByText(/^Skill Fictícia/)).toBeNull();
  });

  it('RES-61 opens an empty field at the end of the item with the focus in it', async () => {
    const api = open();
    const buttonsBefore = within(body()).getAllByRole('button', { name: /^Editar texto do bullet Texto fictício/ });

    fireEvent.click(within(body()).getByRole('button', { name: '+ Bullet' }));

    const field = within(body()).getByRole('textbox', { name: 'Texto do novo bullet' });
    expect(field).toHaveFocus();
    expect((field as HTMLTextAreaElement).value).toBe('');
    expect(buttonsBefore).toHaveLength(2);
    // The field comes after the last bullet and before "+ Bullet".
    const order = [...body().querySelectorAll('textarea, button')].map((node) => node.textContent || node.getAttribute('aria-label'));
    expect(order.indexOf('Texto do novo bullet')).toBeGreaterThan(order.findIndex((name) => name?.includes('bullet 2')));
    await settle();
    expect(api.calls).toEqual([]);
  });

  it('RES-62 creates the bullet at the end of the item when the field is left with text, and shows it', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: '+ Bullet' }));
    const field = within(body()).getByRole('textbox', { name: 'Texto do novo bullet' });

    fireEvent.change(field, { target: { value: '  Escrevi o texto fictício novo.  ' } });
    fireEvent.blur(field);

    await waitFor(() => expect(api.calls).toEqual([`POST /resume/experiences/${experience(1).id}/bullets`]));
    expect(api.bodies).toEqual([{ text: 'Escrevi o texto fictício novo.', skillIds: [] }]);
    expect(await within(body()).findByRole('button', { name: /^Editar texto do bullet Escrevi o texto fictício novo\./ })).toBeInTheDocument();
    expect(within(body()).queryByRole('textbox', { name: 'Texto do novo bullet' })).toBeNull();
    const rows = body().querySelectorAll('.group\\/bullet');
    expect(rows[rows.length - 1]!.textContent).toContain('Escrevi o texto fictício novo.');
    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às/));
    // The new bullet names no skill yet, so the warning of the index counts it.
    expect(within(index()).getByRole('status').textContent).toBe('2 bullets sem skill não entram na ordenação por relevância.');
  });

  it('RES-62 also creates the bullet with Enter', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: '+ Bullet' }));
    const field = within(body()).getByRole('textbox', { name: 'Texto do novo bullet' });

    fireEvent.change(field, { target: { value: 'Texto fictício com Enter.' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() => expect(api.bodies).toEqual([{ text: 'Texto fictício com Enter.', skillIds: [] }]));
    expect(await within(body()).findByRole('button', { name: /^Editar texto do bullet Texto fictício com Enter\./ })).toBeInTheDocument();
  });

  it('RES-62 keeps the text in the field and says it could not save when the create fails', async () => {
    const api = open();
    api.fail('bullet', { status: 500 });
    fireEvent.click(within(body()).getByRole('button', { name: '+ Bullet' }));
    const field = within(body()).getByRole('textbox', { name: 'Texto do novo bullet' });
    fireEvent.change(field, { target: { value: 'Texto fictício que falha.' } });

    fireEvent.blur(field);

    expect(await within(body()).findByText(FAILED)).toBeInTheDocument();
    expect((field as HTMLTextAreaElement).value).toBe('Texto fictício que falha.');
    expect(topbarStatus().textContent).toBe('');
  });

  it('RES-63 drops the field and sends nothing when it is left empty or with only spaces', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: '+ Bullet' }));
    fireEvent.change(within(body()).getByRole('textbox', { name: 'Texto do novo bullet' }), { target: { value: '   ' } });

    fireEvent.blur(within(body()).getByRole('textbox', { name: 'Texto do novo bullet' }));

    await waitFor(() => expect(within(body()).queryByRole('textbox', { name: 'Texto do novo bullet' })).toBeNull());
    expect(api.calls).toEqual([]);
    expect(within(body()).getAllByRole('button', { name: /^Editar texto do bullet Texto fictício/ })).toHaveLength(2);
  });

  it('RES-63 drops the field with Esc and sends nothing even when it holds text', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: '+ Bullet' }));
    const field = within(body()).getByRole('textbox', { name: 'Texto do novo bullet' });
    fireEvent.change(field, { target: { value: 'Texto fictício descartado.' } });

    fireEvent.keyDown(field, { key: 'Escape' });
    await settle();

    expect(within(body()).queryByRole('textbox', { name: 'Texto do novo bullet' })).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it('RES-64 opens the edition on a click on the text and saves the new text when the field is left', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ }));
    const field = within(body()).getByRole('textbox', { name: 'Editar texto do bullet' });
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: 'Texto fictício reescrito.' } });
    fireEvent.blur(field);

    await waitFor(() => expect(api.calls).toEqual([`PATCH /resume/experiences/${experience(1).id}/bullets/${bullet(1).id}`]));
    expect(api.bodies).toEqual([{ text: 'Texto fictício reescrito.' }]);
    expect(await within(body()).findByRole('button', { name: /^Editar texto do bullet Texto fictício reescrito\./ })).toBeInTheDocument();
    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às/));
    // The skills of the bullet are untouched.
    expect(within(row('Texto fictício reescrito.')).getByText('Skill Fictícia 1')).toBeInTheDocument();
  });

  it('RES-64 undoes the edition with Esc and sends nothing', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ }));
    const field = within(body()).getByRole('textbox', { name: 'Editar texto do bullet' });
    fireEvent.change(field, { target: { value: 'Texto que não vale.' } });

    fireEvent.keyDown(field, { key: 'Escape' });
    await settle();

    expect(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ })).toBeInTheDocument();
    expect(within(body()).queryByText('Texto que não vale.')).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it('RES-64 sends nothing when the text is left as it was', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ }));

    fireEvent.blur(within(body()).getByRole('textbox', { name: 'Editar texto do bullet' }));
    await settle();

    expect(api.calls).toEqual([]);
  });

  it('RES-64 says it could not save and keeps the old text when the api fails', async () => {
    const api = open();
    api.fail('bullet', { status: 400, detail: 'Invalid request body' });
    fireEvent.click(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ }));
    const field = within(body()).getByRole('textbox', { name: 'Editar texto do bullet' });
    fireEvent.change(field, { target: { value: 'Texto fictício reescrito.' } });

    fireEvent.blur(field);

    expect(await within(body()).findByText(FAILED)).toBeInTheDocument();
    expect(within(body()).queryByText('Invalid request body')).toBeNull();
    expect(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ })).toBeInTheDocument();
    expect(topbarStatus().textContent).toBe('');
  });

  it('RES-65 goes back to the old text and sends nothing when the edited text is emptied', async () => {
    const api = open();
    fireEvent.click(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ }));
    const field = within(body()).getByRole('textbox', { name: 'Editar texto do bullet' });
    fireEvent.change(field, { target: { value: '   ' } });

    fireEvent.blur(field);
    await settle();

    expect(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ })).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('RES-68 deletes the bullet from its "⋯" menu with no confirmation, and the warning of the index follows', async () => {
    const api = open();
    expect(within(index()).getByRole('status').textContent).toBe('1 bullet sem skill não entra na ordenação por relevância.');
    const second = row('Texto fictício do bullet 2.');

    fireEvent.keyDown(within(second).getByRole('button', { name: 'Ações do bullet' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir bullet' }));

    await waitFor(() => expect(within(body()).queryByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 2\./ })).toBeNull());
    expect(api.calls).toEqual([`DELETE /resume/experiences/${experience(1).id}/bullets/${bullet(2).id}`]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(index()).queryByRole('status')).toBeNull();
    expect(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ })).toBeInTheDocument();
  });

  it('RES-68 keeps the bullet and says it could not delete when the api fails', async () => {
    const api = open();
    api.fail('bullet', 'network');
    const first = row('Texto fictício do bullet 1.');

    fireEvent.keyDown(within(first).getByRole('button', { name: 'Ações do bullet' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Excluir bullet' }));

    expect(await within(body()).findByText('Não foi possível excluir. Tente de novo.')).toBeInTheDocument();
    expect(within(body()).getByRole('button', { name: /^Editar texto do bullet Texto fictício do bullet 1\./ })).toBeInTheDocument();
  });

  it('RES-69 gives the menu "⋯" to every bullet, also the one with no skill, shown under the pointer or the focus', () => {
    open();

    for (const text of ['Texto fictício do bullet 1.', 'Texto fictício do bullet 2.']) {
      const menu = within(row(text)).getByRole('button', { name: 'Ações do bullet' });
      expect(menu.parentElement).toHaveClass('md:opacity-0', 'md:group-hover/bullet:opacity-100', 'md:group-focus-within/bullet:opacity-100');
      menu.focus();
      expect(menu).toHaveFocus();
    }
    expect(within(row('Texto fictício do bullet 2.')).getByText('sem skill')).toBeInTheDocument();
  });

  it('RES-83 enables "+ Bullet" at 29 bullets and disables it at 30', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => bullet(i + 1));
    open(masterResume({ experiences: [experience(1, { bullets: many(29) })], skills: skillsOf(1) }));
    expect(within(body()).getByRole('button', { name: '+ Bullet' })).toBeEnabled();
  });

  it('RES-83 disables "+ Bullet" when the item holds 30 bullets', () => {
    const many = Array.from({ length: 30 }, (_, i) => bullet(i + 1));
    open(masterResume({ experiences: [experience(1, { bullets: many })], skills: skillsOf(1) }));
    expect(within(body()).getByRole('button', { name: '+ Bullet' })).toBeDisabled();
  });
});
