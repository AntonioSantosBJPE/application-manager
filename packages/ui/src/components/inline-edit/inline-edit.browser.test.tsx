import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { focusRing, settle } from '../../testing/contrast';
import { InlineEdit } from './inline-edit';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

function Harness({ onCommit = vi.fn() }: { onCommit?: (value: string) => void }) {
  const [value, setValue] = useState('Empresa Fictícia Alfa');
  return (
    <div className="w-80 bg-surface p-4">
      <button type="button">Antes</button>
      <InlineEdit
        value={value}
        label="Editar empresa"
        onCommit={(next) => {
          setValue(next);
          onCommit(next);
        }}
      />
      <button type="button">Depois</button>
    </div>
  );
}

const display = () => screen.getByRole('button', { name: /^Editar empresa / });
const field = () => screen.getByRole('textbox', { name: 'Editar empresa' });

describe('InlineEdit in the browser', () => {
  it('APP-68 edits with real keys: Tab to the button, Enter opens, typing and Enter save, Esc on the next edit restores and refocuses', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await userEvent.tab();
    await userEvent.tab();
    expect(document.activeElement).toBe(display());

    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(field());
    await userEvent.keyboard('Empresa Fictícia Beta{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Empresa Fictícia Beta');
    expect(document.activeElement).toBe(display());

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('descartado{Escape}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Editar empresa Empresa Fictícia Beta' })).toBe(display());
    expect(document.activeElement).toBe(display());
  });

  it('APP-68 commits once when a real Tab leaves the field', async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    await userEvent.click(display());

    await userEvent.keyboard('Nova');
    await userEvent.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Nova');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Depois' }));
  });

  it('APP-68 keeps the line the same height in both states and draws the focus ring, in both themes, without axe violations', async () => {
    render(<Harness />);
    const reading = display().getBoundingClientRect().height;
    display().focus();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(display());
      const ring = focusRing(display());
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(await axeViolations(display().parentElement!), theme).toEqual([]);
    }

    await userEvent.keyboard('{Enter}');
    expect(field().getBoundingClientRect().height).toBe(reading);
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(field());
      const ring = focusRing(field());
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(await axeViolations(field().parentElement!.parentElement!), theme).toEqual([]);
    }
  });
});

describe('InlineEdit multiline in the browser', () => {
  const longText =
    'Reduziu o tempo de resposta da API de pedidos em 40% ao trocar consultas repetidas por um cache e medir o ganho com testes de carga em cada entrega.';

  function MultilineHarness() {
    const [value, setValue] = useState('Texto curto');
    return (
      <div className="w-80 bg-surface p-4 text-body">
        <InlineEdit multiline value={value} label="Editar texto" onCommit={setValue} />
      </div>
    );
  }
  const button = () => screen.getByRole('button', { name: /^Editar texto / });
  const area = () => screen.getByRole('textbox', { name: 'Editar texto' });

  it('RES-64 grows the textarea with the text and keeps the button as tall as the wrapped text', async () => {
    render(<MultilineHarness />);
    const short = button().getBoundingClientRect().height;
    expect(short).toBeGreaterThanOrEqual(32);

    await userEvent.click(button());
    expect(area().getBoundingClientRect().height).toBe(short);
    await userEvent.keyboard(longText);
    const grown = area().getBoundingClientRect().height;
    expect(grown).toBeGreaterThan(short * 2);

    await userEvent.keyboard('{Enter}');
    expect(button().getBoundingClientRect().height).toBe(grown);
    expect(button().textContent).toContain(longText);
  });

  it('RES-64 edits with real keys: Enter confirms without a line break, Esc restores, in both themes without axe violations', async () => {
    render(<MultilineHarness />);
    await userEvent.click(button());
    await userEvent.keyboard('Novo texto{Enter}');
    expect(button().textContent).toContain('Novo texto');

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('descartado{Escape}');
    expect(button().textContent).toContain('Novo texto');
    expect(document.activeElement).toBe(button());

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(button());
      expect(await axeViolations(button().parentElement!), theme).toEqual([]);
    }
    await userEvent.keyboard('{Enter}');
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(area());
      const ring = focusRing(area());
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(await axeViolations(area().parentElement!.parentElement!), theme).toEqual([]);
    }
  });
});
