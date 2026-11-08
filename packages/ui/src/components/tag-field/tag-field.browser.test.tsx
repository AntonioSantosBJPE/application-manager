import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import type { ComboboxOption } from '../combobox';
import { Field } from '../field';
import { TagField, type TagFieldTag } from './tag-field';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

const catalog: ComboboxOption[] = [
  { id: 'alfa', label: 'Skill Fictícia Alfa' },
  { id: 'beta', label: 'Skill Fictícia Beta' },
  { id: 'gama', label: 'Skill Fictícia Gama' },
];

function Harness({ invalid = false, activateFirst = false }: { invalid?: boolean; activateFirst?: boolean }) {
  const [ids, setIds] = useState(['alfa', 'beta']);
  const [query, setQuery] = useState('');
  const tags: TagFieldTag[] = ids.map((id) => {
    const label = catalog.find((option) => option.id === id)!.label;
    return { id, label, variant: 'required', removeLabel: `Remover ${label}` };
  });
  const options = catalog.filter((option) => !ids.includes(option.id));
  return (
    <div className="w-96 bg-surface p-4">
      <Field.Root invalid={invalid}>
        <Field.Label htmlFor="skills">Skills</Field.Label>
        <TagField
          id="skills"
          tags={tags}
          activateFirst={activateFirst}
          onRemove={(id) => setIds((current) => current.filter((item) => item !== id))}
          query={query}
          options={options}
          onQueryChange={setQuery}
          onSelect={(option) => setIds((current) => [...current, option.id])}
        />
        <Field.Error>Informe ao menos uma skill.</Field.Error>
      </Field.Root>
    </div>
  );
}

const field = () => screen.getByRole('combobox', { name: 'Skills' });

describe('TagField in the browser', () => {
  it('APP-59 removes tags with real Backspaces, keeps the focus in the field and reaches each "×" with Tab', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remover Skill Fictícia Alfa' }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remover Skill Fictícia Beta' }));
    await userEvent.tab();
    expect(document.activeElement).toBe(field());

    await userEvent.keyboard('{Backspace}');
    expect(screen.queryByRole('button', { name: 'Remover Skill Fictícia Beta' })).toBeNull();
    expect(document.activeElement).toBe(field());

    await userEvent.keyboard('{Backspace}');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(document.activeElement).toBe(field());
  });

  it('APP-59 opens the suggestions as a 240 px popover under the typed text, not as wide as the box', async () => {
    await page.viewport(1280, 800);
    render(<Harness activateFirst />);
    field().focus();

    await userEvent.keyboard('fic');

    const list = screen.getByRole('listbox');
    const box = field().closest('div')!.parentElement!.getBoundingClientRect();
    const typed = field().getBoundingClientRect();
    const popover = list.getBoundingClientRect();
    expect(popover.width).toBe(240);
    expect(popover.width).toBeLessThan(box.width);
    expect(popover.left).toBe(typed.left);
    expect(popover.top).toBeGreaterThan(typed.bottom);
    expect(popover.top).toBeLessThan(typed.bottom + 8);
    // The first option is the active one, drawn highlighted.
    const [first] = screen.getAllByRole('option');
    expect(field().getAttribute('aria-activedescendant')).toBe(first!.id);
    expect(getComputedStyle(first!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('APP-59 returns the focus to the field after a click on a "×"', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Remover Skill Fictícia Alfa' }));

    expect(document.activeElement).toBe(field());
  });

  it('APP-59 draws one focus ring around the whole box and has no axe violation, valid and invalid, open and closed, in both themes', async () => {
    await page.viewport(1280, 800);
    const { rerender } = render(<Harness />);
    field().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    const box = field().closest('div')!.parentElement!;

    for (const invalid of [false, true]) {
      rerender(<Harness invalid={invalid} />);
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        await settle(box);
        const label = `${theme} invalid=${invalid}`;
        const ring = focusRing(box);
        expect(ring.drawn, label).toBe(true);
        expect(ring.isFocusToken, label).toBe(true);
        expect(getComputedStyle(field()).outlineWidth, label).toBe('0px');
        expect(getComputedStyle(field()).borderTopWidth, label).toBe('0px');
        expect(await axeViolations(box.parentElement!.parentElement!), label).toEqual([]);
      }
    }
  });
});
