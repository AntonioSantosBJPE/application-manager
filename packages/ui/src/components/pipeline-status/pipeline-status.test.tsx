import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PipelineStatus, type PipelineStatusValue } from './pipeline-status';

const statuses: [PipelineStatusValue, string][] = [
  ['saved', 'Salva'],
  ['applied', 'Enviada'],
  ['interviewing', 'Em entrevistas'],
  ['offer', 'Proposta'],
  ['accepted', 'Aceita'],
  ['rejected', 'Recusada'],
  ['withdrawn', 'Desisti'],
  ['ghosted', 'Sem retorno'],
];

/** The points of a path made only of move and straight-line commands, one list per subpath. */
function subpaths(d: string): [number, number][][] {
  return d
    .split('M')
    .filter((part) => part.trim() !== '')
    .map((part) => {
      const numbers = part.trim().split(/[\s,]+/).map(Number);
      const points: [number, number][] = [];
      for (let i = 0; i < numbers.length; i += 2) points.push([numbers[i]!, numbers[i + 1]!]);
      return points;
    });
}

/**
 * The share of the circle a pie slice fills, in degrees clockwise from the top: the slice starts at the
 * center, goes up to the top of the circle and follows one arc to its end point.
 */
function sliceDegrees(d: string): number {
  const arc = /^M7 7V[\d.]+A[\d.]+ [\d.]+ 0 ([01]) 1 ([\d.]+) ([\d.]+)Z$/.exec(d);
  if (arc === null) throw new Error(`not a slice from the top: ${d}`);
  const [x, y] = [Number(arc[2]) - 7, Number(arc[3]) - 7];
  const degrees = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  // The large-arc flag has to agree with the end point, or the slice is not the one it seems.
  if ((arc[1] === '1') !== degrees > 180) throw new Error(`arc flag disagrees with the end: ${d}`);
  return degrees;
}

/** What the icon draws, read from its SVG: the outline, the fill and the mark inside. */
function shapeOf(icon: SVGElement): string {
  const circles = [...icon.querySelectorAll('circle')];
  const paths = [...icon.querySelectorAll('path')];
  if (circles.length !== 1) return `circles:${circles.length}`;
  const circle = circles[0]!;
  const dashes = circle.getAttribute('stroke-dasharray')?.split(/\s+/).map(Number);
  const outline = circle.getAttribute('fill') === 'none';

  if (outline && paths.length === 0) {
    if (dashes === undefined) return 'empty';
    // A dash shorter than its line width, with round caps, is drawn as a dot.
    const dotted = dashes[0]! < 0.5 && circle.getAttribute('stroke-linecap') === 'round';
    return dotted ? 'dotted' : 'dashed';
  }
  if (outline && dashes === undefined && paths.length === 1) {
    const d = paths[0]!.getAttribute('d')!;
    if (paths[0]!.getAttribute('fill') === 'currentColor') return `slice:${sliceDegrees(d)}`;
    const lines = subpaths(d);
    // A single straight line across the ring, from bottom left to top right.
    if (lines.length === 1 && lines[0]!.length === 2) {
      const [[x1, y1], [x2, y2]] = lines[0]! as [[number, number], [number, number]];
      if (x2 > x1 && y2 < y1) return 'bar';
    }
    return `ring+path:${d}`;
  }
  if (circle.getAttribute('fill') === 'currentColor' && paths.length === 1) {
    const lines = subpaths(paths[0]!.getAttribute('d')!);
    // A check: one stroke of three points whose middle is the lowest (y grows downwards).
    if (lines.length === 1 && lines[0]!.length === 3) {
      const [a, b, c] = lines[0]! as [[number, number], [number, number], [number, number]];
      if (b[1] > a[1] && b[1] > c[1] && a[0] < b[0] && b[0] < c[0]) return 'full+check';
    }
    // An X: two straight strokes with opposite slopes that cross.
    if (lines.length === 2 && lines.every((line) => line.length === 2)) {
      type Line = [[number, number], [number, number]];
      const slope = ([[x1, y1], [x2, y2]]: Line) => (y2 - y1) / (x2 - x1);
      if (slope(lines[0] as Line) * slope(lines[1] as Line) < 0) return 'full+x';
    }
  }
  return 'unknown';
}

describe('PipelineStatus', () => {
  it('PRU-07 AC04 draws each status with its own icon: dashed, empty, half, three quarters, full with check, full with X, with bar, dotted', () => {
    const expected: Record<PipelineStatusValue, string> = {
      saved: 'dashed',
      applied: 'empty',
      interviewing: 'slice:180',
      offer: 'slice:270',
      accepted: 'full+check',
      rejected: 'full+x',
      withdrawn: 'bar',
      ghosted: 'dotted',
    };

    for (const [status, label] of statuses) {
      const { container, unmount } = render(<PipelineStatus status={status} label={label} />);
      expect(shapeOf(container.querySelector('svg')!), status).toBe(expected[status]);
      unmount();
    }
  });

  it('PRU-07 AC04 renders each of the eight statuses with a 14px icon in its own status token', () => {
    for (const [status, label] of statuses) {
      const { container, unmount } = render(<PipelineStatus status={status} label={label} />);
      const icon = container.querySelector('svg')!;

      expect(icon, status).toHaveAttribute('width', '14');
      expect(icon, status).toHaveAttribute('height', '14');
      expect(icon, status).toHaveClass(`text-status-${status}`);
      expect(icon, status).toHaveAttribute('aria-hidden', 'true');
      unmount();
    }
  });

  it('PRU-07 AC05 shows the label of the caller next to the icon, in text', () => {
    render(<PipelineStatus status="applied" label="Enviada" />);

    const label = screen.getByText('Enviada');
    expect(label).toHaveClass('text-text');
    expect(label.previousElementSibling?.tagName.toLowerCase()).toBe('svg');
  });

  it('PRU-07 AC05 shows only the icon with iconOnly and takes the label as the aria-label', () => {
    const { container } = render(<PipelineStatus status="interviewing" label="Em entrevistas" iconOnly />);

    const status = screen.getByRole('img', { name: 'Em entrevistas' });
    expect(status).toContainElement(container.querySelector('svg'));
    expect(status.textContent).toBe('');
    expect(screen.queryByText('Em entrevistas')).toBeNull();
  });

  it('PRU-07 AC06 draws eight different icons, so no status depends on color', () => {
    const shapes = statuses.map(([status, label]) => {
      const { container, unmount } = render(<PipelineStatus status={status} label={label} />);
      const markup = container.querySelector('svg')!.innerHTML;
      unmount();
      return markup;
    });

    expect(new Set(shapes).size).toBe(8);
  });

  it('PRU-07 AC06 also tells the statuses apart by label', () => {
    const { container } = render(
      <div>
        {statuses.map(([status, label]) => (
          <PipelineStatus key={status} status={status} label={label} />
        ))}
      </div>,
    );

    const labels = [...container.querySelectorAll('span > span')].map((node) => node.textContent);
    expect(new Set(labels).size).toBe(8);
  });

  it('PRU-07 AC11 renders no label of its own', () => {
    const { container } = render(<PipelineStatus status="saved" label="" />);

    expect(container.textContent).toBe('');
  });
});
