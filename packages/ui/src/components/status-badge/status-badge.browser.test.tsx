import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { settle } from '../../testing/contrast';
import { StatusBadge } from './status-badge';

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

describe('StatusBadge in the browser', () => {
  it('PRU-02 AC12 paints dot, border and text in the intent color and no fill, in both themes', async () => {
    render(
      <div className="bg-surface-raised p-2">
        <StatusBadge intent="operational">Operacional</StatusBadge>
        <StatusBadge intent="unavailable">Indisponível</StatusBadge>
      </div>,
    );

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      for (const [text, token] of [
        ['Operacional', 'status-operational'],
        ['Indisponível', 'status-unavailable'],
      ] as const) {
        const badge = screen.getByText(text);
        await settle(badge);
        const style = getComputedStyle(badge);
        const dot = badge.querySelector('svg')!;
        expect(style.color, `${text} text, ${theme}`).toBe(tokenColor(token));
        expect(style.borderTopColor, `${text} border, ${theme}`).toBe(tokenColor(token));
        expect(style.backgroundColor, `${text} fill`).toBe('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(dot.querySelector('circle')!).fill).toBe(tokenColor(token));
        expect(dot.getBoundingClientRect().width).toBe(6);
        // The dot comes first, at the left of the text.
        const range = document.createRange();
        range.selectNodeContents(badge.lastChild!);
        expect(dot.getBoundingClientRect().right).toBeLessThanOrEqual(
          range.getBoundingClientRect().left,
        );
      }
    }
  });
});
