import { render } from '@testing-library/react';
import { Check, CircleAlert } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Icon } from './icon';

/** The svg the wrapper draws inside a container. */
function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('no svg rendered');
  return svg;
}

describe('Icon', () => {
  it('PRU-01 AC11 draws a Lucide icon at stroke 1.75, 16px, in the color of the text', () => {
    const { container } = render(<Icon icon={Check} />);
    const svg = svgOf(container);

    expect(svg).toHaveClass('lucide-check');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveAttribute('stroke-width', '1.75');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('PRU-01 AC11 draws the small icon at 14px with the same stroke and color', () => {
    const { container } = render(<Icon icon={CircleAlert} size="sm" />);
    const svg = svgOf(container);

    expect(svg).toHaveClass('lucide-circle-alert');
    expect(svg).toHaveAttribute('width', '14');
    expect(svg).toHaveAttribute('height', '14');
    expect(svg).toHaveAttribute('stroke-width', '1.75');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
