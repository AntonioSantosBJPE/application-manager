import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axeViolations } from '../../testing/axe';
import { backgroundBehind, contrastRatio, focusRing, settle } from '../../testing/contrast';
import { FilterChip } from './filter-chip';

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

function renderChips() {
  render(
    <div className="bg-surface p-4">
      <FilterChip pressed>Todas</FilterChip>
      <FilterChip pressed={false} count={4}>
        Privadas
      </FilterChip>
    </div>,
  );
  return {
    pressed: screen.getByRole('button', { name: 'Todas' }),
    idle: screen.getByRole('button', { name: /^Privadas\s*4$/ }),
  };
}

describe('FilterChip in the browser', () => {
  it('paints the pressed and the idle chip with their tokens, 26px tall, in both themes', async () => {
    const { pressed, idle } = renderChips();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(pressed);
      expect(getComputedStyle(pressed).backgroundColor, theme).toBe(tokenColor('surface-hover'));
      expect(getComputedStyle(pressed).color, theme).toBe(tokenColor('text'));
      expect(getComputedStyle(pressed).borderTopColor, theme).toBe(tokenColor('border-control'));
      expect(getComputedStyle(idle).backgroundColor, theme).toBe(tokenColor('surface'));
      expect(getComputedStyle(idle).color, theme).toBe(tokenColor('text-muted'));
      expect(getComputedStyle(idle).borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(pressed.getBoundingClientRect().height).toBe(26);
      expect(getComputedStyle(idle.querySelector('span')!).fontFamily).toContain('Geist Mono');
    }
  });

  it('draws the focus ring in the focus token when reached by Tab', async () => {
    const { pressed } = renderChips();

    await userEvent.tab();

    expect(document.activeElement).toBe(pressed);
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(pressed);
      const ring = focusRing(pressed);
      expect(ring.drawn, theme).toBe(true);
      expect(ring.isFocusToken, theme).toBe(true);
      expect(ring.ratio, theme).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the label at 4.5:1 over what is behind it, pressed or not, in both themes', async () => {
    const { pressed, idle } = renderChips();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(pressed);
      for (const chip of [pressed, idle]) {
        const ratio = contrastRatio(getComputedStyle(chip).color, backgroundBehind(chip));
        expect(ratio, `${chip.textContent}, ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('has no axe violation, pressed or not, in both themes', async () => {
    const { pressed } = renderChips();

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(pressed);
      expect(await axeViolations(), theme).toEqual([]);
    }
  });
});
