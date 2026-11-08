import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../testing/axe';
import { contrastRatio, backgroundBehind, settle } from '../../testing/contrast';
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

describe('neutral StatusBadge in the browser', () => {
  it('SKL-40 paints the border in border-strong, the text in text, no fill and no dot, in both themes', async () => {
    render(
      <div className="bg-surface-raised p-2">
        <StatusBadge>Privada</StatusBadge>
      </div>,
    );

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      const badge = screen.getByText('Privada');
      await settle(badge);
      const style = getComputedStyle(badge);
      expect(style.color, theme).toBe(tokenColor('text'));
      expect(style.borderTopColor, theme).toBe(tokenColor('border-strong'));
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(badge.querySelector('svg')).toBeNull();
    }
  });

  it('SKL-52 has text at 4.5:1 over surface and surface-raised, and no axe violation, in both themes', async () => {
    render(
      <div>
        {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
          <div key={surface} className={`p-4 ${surface}`}>
            <StatusBadge>Privada</StatusBadge>
          </div>
        ))}
      </div>,
    );

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      for (const badge of screen.getAllByText('Privada')) {
        await settle(badge);
        // The border (border-strong, as .am-badge draws it) only frames the text, which carries the meaning.
        const style = getComputedStyle(badge);
        const behind = backgroundBehind(badge);
        expect(contrastRatio(style.color, behind), `${theme} text`).toBeGreaterThanOrEqual(4.5);
      }
      expect(await axeViolations(), theme).toEqual([]);
    }
  });
});
