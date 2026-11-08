import { render, screen, within } from '@testing-library/react';
import { Plus } from 'lucide-react';
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

  it('draws the hint muted at the right edge and the icon before the label, with no axe violation, in both themes', async () => {
    function WithHints() {
      const [query, setQuery] = useState('');
      return (
        <div className="bg-surface p-4">
          <Field.Root>
            <Field.Label htmlFor="skill">Skill</Field.Label>
            <Combobox
              id="skill"
              wrapperClassName="w-72"
              query={query}
              options={[
                { id: 'nest', label: 'NestJS', hint: 'framework' },
                { id: 'new', label: 'Criar “nes”', icon: Plus },
              ]}
              selected={null}
              onQueryChange={setQuery}
              onSelect={() => {}}
            />
          </Field.Root>
        </div>
      );
    }
    render(<WithHints />);
    box().focus();
    await userEvent.keyboard('nes{ArrowDown}');
    const nest = screen.getByRole('option', { name: 'NestJS framework' });
    const create = screen.getByRole('option', { name: 'Criar “nes”' });

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(nest);
      const hint = within(nest).getByText('framework');
      expect(getComputedStyle(hint).color, theme).toBe(tokenColor('text-muted'));
      expect(hint.getBoundingClientRect().right, theme).toBeGreaterThan(nest.getBoundingClientRect().right - 16);
      expect(hint.getBoundingClientRect().left).toBeGreaterThan(within(nest).getByText('NestJS').getBoundingClientRect().right);
      const icon = create.querySelector('svg')!;
      expect(icon.getBoundingClientRect().right).toBeLessThanOrEqual(within(create).getByText('Criar “nes”').getBoundingClientRect().left);
      expect(await axeViolations(), theme).toEqual([]);
    }
  });

  it('can be controlled: opens, reports Esc as onOpenChange(false), and the arrows and Enter still work', async () => {
    const changes: boolean[] = [];
    function Controlled() {
      const [query, setQuery] = useState('');
      const [selected, setSelected] = useState<ComboboxOption | null>(null);
      const [open, setOpen] = useState(false);
      return (
        <div className="bg-surface p-4">
          <Field.Root>
            <Field.Label htmlFor="skill">Skill</Field.Label>
            <Combobox
              id="skill"
              wrapperClassName="w-72"
              query={query}
              options={catalog}
              selected={selected}
              onQueryChange={setQuery}
              onSelect={setSelected}
              open={open}
              onOpenChange={(next) => {
                changes.push(next);
                setOpen(next);
              }}
            />
          </Field.Root>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <output aria-label="Escolhida">{selected === null ? 'nenhuma' : selected.id}</output>
        </div>
      );
    }
    render(<Controlled />);

    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(3);

    box().focus();
    await userEvent.keyboard('{Escape}');
    expect(changes.at(-1)).toBe(false);
    expect(box().getAttribute('aria-expanded')).toBe('false');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(changes.at(-1)).toBe(true);
    const [, beta] = screen.getAllByRole('option');
    expect(box().getAttribute('aria-activedescendant')).toBe(beta!.id);

    await userEvent.keyboard('{Enter}');
    expect(screen.getByLabelText('Escolhida').textContent).toBe('beta');
    expect(changes.at(-1)).toBe(false);
    expect(box().getAttribute('aria-expanded')).toBe('false');
  });
});
