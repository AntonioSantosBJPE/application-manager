import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { Field } from '../field';
import { Combobox, type ComboboxOption } from './combobox';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

const catalog: ComboboxOption[] = [
  { id: 'alfa', label: 'Skill Fictícia Alfa' },
  { id: 'beta', label: 'Skill Fictícia Beta' },
  { id: 'drizzle', label: 'Drizzle ORM de Teste' },
];

function Harness() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ComboboxOption | null>(null);
  const options = catalog.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="bg-surface p-4">
      <Field.Root>
        <Field.Label htmlFor="skill">Skill</Field.Label>
        <Combobox
          id="skill"
          wrapperClassName="w-72"
          query={query}
          options={options}
          selected={selected}
          onQueryChange={setQuery}
          onSelect={setSelected}
        />
      </Field.Root>
      <output aria-label="Escolhida">{selected === null ? 'nenhuma' : selected.id}</output>
    </div>
  );
}

const box = () => screen.getByRole('combobox', { name: 'Skill' });

describe('Combobox in the browser', () => {
  it('moves with the real arrows, chooses with Enter, closes with Esc, and without a choice nothing is selected', async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(document.activeElement).toBe(box());

    await userEvent.keyboard('fic');
    expect(box().getAttribute('aria-expanded')).toBe('true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const [alfa, beta] = screen.getAllByRole('option');
    expect(box().getAttribute('aria-activedescendant')).toBe(beta!.id);
    expect(alfa!.id).not.toBe(beta!.id);

    await userEvent.keyboard('{Escape}');
    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByLabelText('Escolhida').textContent).toBe('nenhuma');

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByLabelText('Escolhida').textContent).toBe('alfa');
    expect((box() as HTMLInputElement).value).toBe('Skill Fictícia Alfa');

    await userEvent.keyboard('x');
    expect(screen.getByLabelText('Escolhida').textContent).toBe('nenhuma');
  });

  it('paints the list on the overlay surface and the active option with surface-hover, in both themes', async () => {
    render(<Harness />);
    box().focus();
    await userEvent.keyboard('fic{ArrowDown}');
    const list = screen.getByRole('listbox');
    const [alfa, beta] = screen.getAllByRole('option');

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(list);
      expect(getComputedStyle(list).backgroundColor, theme).toBe(tokenColor('surface-overlay'));
      expect(getComputedStyle(list).borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(getComputedStyle(list).borderTopLeftRadius).toBe('6px');
      expect(getComputedStyle(alfa!).backgroundColor, theme).toBe(tokenColor('surface-hover'));
      expect(getComputedStyle(beta!).backgroundColor).not.toBe(tokenColor('surface-hover'));
      expect(getComputedStyle(alfa!).color, theme).toBe(tokenColor('text'));
      expect(list.getBoundingClientRect().top).toBeGreaterThanOrEqual(box().getBoundingClientRect().bottom);
      const ring = focusRing(box());
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
    }
  });

  it('has no axe violation closed or open, in both themes', async () => {
    render(<Harness />);

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(box());
      expect(await axeViolations(), `${theme}, closed`).toEqual([]);
    }
    box().focus();
    await userEvent.keyboard('fic{ArrowDown}');
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(box());
      expect(await axeViolations(), `${theme}, open`).toEqual([]);
    }
  });

  it('inside a Dialog the first Esc closes the list and the second closes the dialog', async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Content>
          <Dialog.Title>Apelido</Dialog.Title>
          <Dialog.Description>Escolha a skill.</Dialog.Description>
          <Harness />
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button intent="secondary">Cancelar</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>,
    );
    box().focus();
    await userEvent.keyboard('fic');
    expect(box().getAttribute('aria-expanded')).toBe('true');

    await userEvent.keyboard('{Escape}');

    expect(box().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('dialog', { name: 'Apelido' })).toBeTruthy();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
