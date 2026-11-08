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

describe('PipelineStatus', () => {
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
