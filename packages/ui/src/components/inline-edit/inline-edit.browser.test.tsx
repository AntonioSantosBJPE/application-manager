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
