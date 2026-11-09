import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../components/button';
import { ListPage } from './list-page';

function renderGroup(onAdd = vi.fn()) {
  return render(
    <ListPage.Content>
      <ListPage.Group
        count={2}
        action={<Button intent="ghost" size="sm" icon={Plus} aria-label="Nova em Em entrevistas" onClick={onAdd} />}
      >
        Em entrevistas
      </ListPage.Group>
    </ListPage.Content>,
  );
}

describe('ListPage.Group action', () => {
  it('APP-45 makes the header a div that holds the h2 and the action', () => {
    const { container } = renderGroup();

    const heading = screen.getByRole('heading', { level: 2 });
    const header = heading.parentElement!;
    expect(header.tagName).toBe('DIV');
    expect(header).toHaveClass('h-9', 'bg-surface-raised', 'border-b');
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(within(header).getByRole('button', { name: 'Nova em Em entrevistas' })).toBeInTheDocument();
  });

  it('APP-45 keeps the action out of the h2, so the heading name is the label and the count only', () => {
    renderGroup();

    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).queryByRole('button')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: /^Em entrevistas\s*2$/ })).toBe(heading);
    expect(screen.queryByRole('heading', { name: /Nova/ })).toBeNull();
  });

  it('APP-45 puts the action after the heading, at the right', () => {
    renderGroup();

    const heading = screen.getByRole('heading', { level: 2 });
    const slot = heading.nextElementSibling!;
    expect(slot).toHaveClass('ml-auto');
    expect(slot).toContainElement(screen.getByRole('button', { name: 'Nova em Em entrevistas' }));
  });

  it('APP-45 runs the action on click and on Enter from the keyboard', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderGroup(onAdd);

    await user.click(screen.getByRole('button', { name: 'Nova em Em entrevistas' }));
    screen.getByRole('button', { name: 'Nova em Em entrevistas' }).focus();
    await user.keyboard('{Enter}');

    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it('APP-45 shows the count in mono beside the label', () => {
    renderGroup();

    expect(screen.getByText('2')).toHaveClass('font-mono', 'text-text-muted');
  });

  it('APP-45 gives the other props to the h2 and the className to the header', () => {
    render(
      <ListPage.Content>
        <ListPage.Group id="grupo-entrevistas" className="sticky" action={<span>acao</span>}>
          Em entrevistas
        </ListPage.Group>
      </ListPage.Content>,
    );

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'grupo-entrevistas');
    expect(heading.parentElement).toHaveClass('sticky');
  });

  it('APP-45 keeps the plain h2 when there is no action', () => {
    const { container } = render(
      <ListPage.Content>
        <ListPage.Group count={2}>Em entrevistas</ListPage.Group>
      </ListPage.Content>,
    );

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.parentElement).toBe(container.firstElementChild);
    expect(heading.tagName).toBe('H2');
    expect(heading).toHaveClass('h-9', 'bg-surface-raised', 'text-heading-sm');
    expect(container.querySelectorAll('div')).toHaveLength(1);
  });
});
