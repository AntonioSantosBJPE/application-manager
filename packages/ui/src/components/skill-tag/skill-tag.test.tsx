import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillTag } from './skill-tag';

describe('SkillTag', () => {
  it('PRU-07 AC07 renders the name of the caller in the four variants', () => {
    render(
      <div>
        <SkillTag variant="required">TypeScript</SkillTag>
        <SkillTag variant="nice">Kubernetes</SkillTag>
        <SkillTag variant="private">Drizzle ORM</SkillTag>
        <SkillTag variant="match">React</SkillTag>
      </div>,
    );

    expect(screen.getByText('TypeScript')).toHaveClass('border-border-strong', 'text-text', 'h-5.5', 'text-caption');
    expect(screen.getByText('Kubernetes')).toHaveClass('border-dashed', 'text-text-muted');
    expect(screen.getByText(/Drizzle ORM/)).toHaveClass('border-border-strong', 'text-text');
    expect(screen.getByText(/React/)).toHaveClass('bg-accent-subtle', 'text-accent-text');
  });

  it('PRU-07 AC07 marks private with "·" and match with a check icon, and no other variant', () => {
    const { container } = render(
      <div>
        <SkillTag variant="required">TypeScript</SkillTag>
        <SkillTag variant="nice">Kubernetes</SkillTag>
        <SkillTag variant="private">Drizzle ORM</SkillTag>
        <SkillTag variant="match">React</SkillTag>
      </div>,
    );

    const tags = [...container.querySelectorAll<HTMLElement>('div > span')];
    const [required, nice, privateTag, match] = tags;
    expect(privateTag!.textContent).toBe('Drizzle ORM·');
    expect(required!.textContent).toBe('TypeScript');
    expect(nice!.textContent).toBe('Kubernetes');
    expect(match!.querySelector('svg')).not.toBeNull();
    expect(required!.querySelector('svg')).toBeNull();
    expect(nice!.querySelector('svg')).toBeNull();
    expect(privateTag!.querySelector('svg')).toBeNull();
  });

  it('PRU-07 AC08 shows no remove button without onRemove', () => {
    render(<SkillTag variant="required">TypeScript</SkillTag>);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('PRU-07 AC08 shows the remove button named by the caller and calls onRemove once on click', () => {
    const onRemove = vi.fn();
    render(
      <SkillTag variant="required" onRemove={onRemove} removeLabel="Remover Terraform">
        Terraform
      </SkillTag>,
    );

    const button = screen.getByRole('button', { name: 'Remover Terraform' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('PRU-07 AC11 renders no text beyond what the caller passes', () => {
    const { container } = render(
      <SkillTag variant="match" onRemove={() => {}} removeLabel="Remover React">
        React
      </SkillTag>,
    );

    expect(container.textContent).toBe('React');
  });
});
