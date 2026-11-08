import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './logo';

/** The mark as the design ships it, the source of the ring geometry. */
const asset = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../../docs/design/system/assets/logos/rumo-mark.svg',
  ),
  'utf8',
);

function parts(container: HTMLElement) {
  const root = container.firstElementChild as HTMLElement;
  const svg = root.querySelector('svg')!;
  const rumo = screen.queryByText('rumo', { exact: true, ignore: false });
  const carreira = screen.queryByText('carreira', { exact: true, ignore: false });
  return { root, svg, rumo, carreira };
}

describe('Logo', () => {
  it('PRU-05 AC01 draws the mark as an inline svg in currentColor with the geometry of rumo-mark.svg', () => {
    const { container } = render(<Logo variant="mark" />);
    const { svg, rumo } = parts(container);
    const circle = svg.querySelector('circle')!;
    const path = svg.querySelector('path')!;

    expect(svg).toHaveAttribute('viewBox', '0 0 32 32');
    expect(asset).toContain('viewBox="0 0 32 32"');
    for (const attribute of ['cx', 'cy', 'r', 'stroke-width']) {
      expect(asset).toContain(`${attribute}="${circle.getAttribute(attribute)}"`);
    }
    expect(asset).toContain(`d="${path.getAttribute('d')}"`);
    expect(circle).toHaveAttribute('stroke', 'currentColor');
    expect(circle).toHaveAttribute('fill', 'none');
    expect(path).toHaveAttribute('fill', 'currentColor');
    expect(rumo).toBeNull();
  });

  it('PRU-05 AC01 sets the wordmark as "rumo" 600 and "carreira" 400, lowercase, beside the mark', () => {
    const { container } = render(<Logo variant="wordmark" />);
    const { root, svg, rumo, carreira } = parts(container);

    expect(root.textContent).toBe('rumo carreira');
    expect(rumo).toHaveClass('font-semibold');
    expect(carreira).toHaveClass('font-normal');
    // The ring comes first, the words after it.
    expect(svg.compareDocumentPosition(rumo!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('PRU-05 AC02 writes "rumo" in text and "carreira" in text-muted, half a mark apart', () => {
    const { container, rerender } = render(<Logo variant="wordmark" />);

    expect(screen.getByText('rumo')).toHaveClass('text-text');
    expect(screen.getByText('carreira')).toHaveClass('text-text-muted');
    expect(parts(container).root.style.gap).toBe('10px');

    rerender(<Logo variant="wordmark" size={32} />);

    expect(parts(container).root.style.gap).toBe('16px');
    expect(parts(container).svg).toHaveAttribute('width', '32');
  });

  it('PRU-05 AC03 draws the mark in accent and hides the logo from assistive technology without a title', () => {
    const { container } = render(<Logo variant="mark" />);
    const { root, svg } = parts(container);

    expect(svg).toHaveClass('text-accent');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('PRU-05 AC03 names the logo with the title from the caller', () => {
    render(<Logo variant="wordmark" title="Rumo Carreira" />);

    const logo = screen.getByRole('img', { name: 'Rumo Carreira' });
    expect(logo).not.toHaveAttribute('aria-hidden');
  });

  it('PRU-05 AC04 paints mark and words in one color when the caller picks text or surface', () => {
    for (const tone of ['text', 'surface'] as const) {
      const { container, unmount } = render(<Logo variant="wordmark" tone={tone} />);
      const { svg, rumo, carreira } = parts(container);

      for (const part of [svg, rumo, carreira]) {
        expect(part, tone).toHaveClass(`text-${tone}`);
        expect(part).not.toHaveClass('text-accent', 'text-text-muted');
      }
      unmount();
    }
  });
});
