import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from './logo';

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

const themes = ['light', 'dark'] as const;

describe('Logo in the browser', () => {
  it('PRU-05 AC01 paints the wordmark in Geist, 600 and 400, lowercase, with -0.03em tracking', () => {
    render(<Logo variant="wordmark" />);

    const rumo = getComputedStyle(screen.getByText('rumo'));
    const carreira = getComputedStyle(screen.getByText('carreira'));
    expect(rumo.fontFamily).toMatch(/^"Geist Variable"/);
    expect(rumo.fontWeight).toBe('600');
    expect(carreira.fontWeight).toBe('400');
    // 16px words beside the 20px mark: -0.03em is -0.48px.
    expect(rumo.fontSize).toBe('16px');
    expect(Number.parseFloat(rumo.letterSpacing)).toBeCloseTo(-0.48, 2);
    expect(screen.getByText('rumo').textContent).toBe('rumo');
    expect(screen.getByText('carreira').textContent).toBe('carreira');
  });

  it('PRU-05 AC02 paints "rumo" in text and "carreira" in text-muted, half a mark from the ring', () => {
    const { container } = render(<Logo variant="wordmark" size={24} />);
    const svg = container.querySelector('svg')!.getBoundingClientRect();
    const words = screen.getByText('rumo').getBoundingClientRect();

    expect(svg.height).toBe(24);
    expect(words.left - svg.right).toBe(12);
    for (const theme of themes) {
      document.documentElement.setAttribute('data-theme', theme);
      expect(getComputedStyle(screen.getByText('rumo')).color, theme).toBe(tokenColor('text'));
      expect(getComputedStyle(screen.getByText('carreira')).color, theme).toBe(
        tokenColor('text-muted'),
      );
    }
  });

  it('PRU-05 AC03 paints the ring in accent in both themes', () => {
    const { container } = render(<Logo variant="mark" />);
    const circle = container.querySelector('circle')!;
    const path = container.querySelector('path')!;

    for (const theme of themes) {
      document.documentElement.setAttribute('data-theme', theme);
      expect(getComputedStyle(circle).stroke, theme).toBe(tokenColor('accent'));
      expect(getComputedStyle(path).fill, theme).toBe(tokenColor('accent'));
    }
  });

  it('PRU-05 AC04 paints ring and words in the single color the caller picks', () => {
    for (const tone of ['text', 'surface'] as const) {
      const { container, unmount } = render(<Logo variant="wordmark" tone={tone} />);
      for (const theme of themes) {
        document.documentElement.setAttribute('data-theme', theme);
        const color = tokenColor(tone);
        expect(getComputedStyle(container.querySelector('circle')!).stroke, `${tone} ring`).toBe(
          color,
        );
        expect(getComputedStyle(screen.getByText('rumo')).color, `${tone} rumo`).toBe(color);
        expect(getComputedStyle(screen.getByText('carreira')).color, `${tone} carreira`).toBe(
          color,
        );
      }
      unmount();
    }
  });
});
