import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillTag } from '../skill-tag';
import { Bullet } from './bullet';

function renderBullet(extra?: { withTags?: boolean }) {
  return render(
    <Bullet.Root
      data-testid="bullet"
      handle={<button type="button">h1</button>}
      aside={
        <Bullet.Actions>
          <button type="button">a1</button>
        </Bullet.Actions>
      }
    >
      <Bullet.Text>t1</Bullet.Text>
      <Bullet.Tags>{extra?.withTags === false ? null : <SkillTag variant="required">k1</SkillTag>}</Bullet.Tags>
    </Bullet.Root>,
  );
}

describe('Bullet', () => {
  it('RES-60 composes the handle, the text, the tags and the area at the right, in that order', () => {
    renderBullet();

    const root = screen.getByTestId('bullet');
    const [handle, content, aside] = Array.from(root.children);
    expect(handle).toHaveTextContent('h1');
    expect(content).toHaveTextContent('t1k1');
    expect(aside).toHaveTextContent('a1');
    expect(root).toHaveClass('grid', 'rounded-sm');
  });

  it('RES-60 draws the text in body-lg and the tags below it', () => {
    renderBullet();

    const text = screen.getByText('t1');
    expect(text).toHaveClass('text-body-lg');
    const tags = screen.getByText('k1').parentElement!;
    expect(
      Boolean(text.compareDocumentPosition(tags) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(tags).toHaveClass('flex-wrap');
  });

  it('RES-60 hides the tag row when there is no tag, so a bullet without skill leaves no gap', () => {
    renderBullet({ withTags: false });

    const tags = screen.getByText('t1').nextElementSibling!;
    expect(tags).toBeEmptyDOMElement();
    expect(tags).toHaveClass('empty:hidden');
  });

  it('RES-60 shows the notice in warning, with the words of the caller and a hidden icon', () => {
    const { container } = render(
      <Bullet.Root aside={<Bullet.Notice>n1</Bullet.Notice>}>
        <Bullet.Text>t1</Bullet.Text>
      </Bullet.Root>,
    );

    const notice = screen.getByText('n1');
    expect(notice).toHaveClass('text-warning');
    expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).toBe('t1n1');
  });

  it('RES-69 reveals the actions on hover or focus on a wide screen and keeps them on a touch screen', () => {
    renderBullet();

    const actions = screen.getByText('a1').parentElement!;
    expect(actions).toHaveClass(
      'md:opacity-0',
      'md:group-hover/bullet:opacity-100',
      'md:group-focus-within/bullet:opacity-100',
    );
    expect(screen.getByTestId('bullet')).toHaveClass('group/bullet');
  });

  it('RES-87 keeps the actions in view at rest with alwaysVisible, with no class that hides them', () => {
    render(
      <Bullet.Root
        aside={
          <Bullet.Actions alwaysVisible>
            <button>a1</button>
          </Bullet.Actions>
        }
      >
        <Bullet.Text>t1</Bullet.Text>
      </Bullet.Root>,
    );

    expect(screen.getByText('a1').parentElement!.className).not.toMatch(/opacity/);
  });

  it('RES-60 renders no text and no label of its own when the caller passes none', () => {
    const { container } = render(
      <Bullet.Root>
        <Bullet.Text />
        <Bullet.Tags />
      </Bullet.Root>,
    );

    expect(container.textContent).toBe('');
    expect(container.querySelectorAll('[aria-label], [title], [alt]')).toHaveLength(0);
  });
});
