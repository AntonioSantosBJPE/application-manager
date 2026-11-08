// @vitest-environment jsdom
import type { AdminSkillsPage } from '@am/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrivateSkillsSummary } from './PrivateSkillsSummary';

const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;
const link = <a href="/admin/skills?scope=private">Abrir catálogo</a>;

/** `count` private skills named "Skill Fictícia 01", "02"…, in the alphabetical order the api answers. */
function privates(count: number): AdminSkillsPage {
  return {
    items: Array.from({ length: count }, (_, index) => ({
      id: uuid(index + 1),
      name: `Skill Fictícia ${String(index + 1).padStart(2, '0')}`,
      category: 'tool' as const,
      scope: 'private' as const,
      aliases: [],
    })),
    nextCursor: null,
    counts: { total: 212, private: count },
  };
}

function renderWidget(page: AdminSkillsPage) {
  render(<PrivateSkillsSummary result={{ ok: true, data: page }} link={link} />);
  return screen.getByRole('group', { name: 'Skills privadas aguardando promoção' });
}

const tagsOf = (widget: HTMLElement) =>
  within(widget)
    .queryAllByRole('listitem')
    .filter((item) => item.textContent?.startsWith('Skill Fictícia'))
    .map((item) => item.textContent);

describe('PrivateSkillsSummary', () => {
  it('SKL-55 shows the title as heading 2 of a full-width widget, with Abrir catálogo as a ghost action ending in an arrow', () => {
    const widget = renderWidget(privates(3));

    expect(
      within(widget).getByRole('heading', { level: 2, name: 'Skills privadas aguardando promoção' }),
    ).toBeInTheDocument();
    expect(widget).toHaveClass('md:col-span-12');
    const action = within(widget).getByRole('link', { name: 'Abrir catálogo' });
    expect(action).toHaveAttribute('href', '/admin/skills?scope=private');
    expect(action).toHaveClass('bg-transparent', 'h-control-sm');
    expect(action.lastElementChild).toHaveClass('lucide-arrow-right');
    expect(action.textContent).toBe('Abrir catálogo');
    expect(action.closest('h2')).toBeNull();
  });

  it('SKL-55 shows each private skill as a private SkillTag, in the order the api answers, and no "e mais" for 3', () => {
    const widget = renderWidget(privates(3));

    expect(tagsOf(widget)).toEqual(['Skill Fictícia 01·', 'Skill Fictícia 02·', 'Skill Fictícia 03·']);
    expect(within(widget).queryByText(/^e mais/)).toBeNull();
    expect(within(widget).getByText('Skill Fictícia 01')).toHaveClass('border-border-strong', 'h-5.5');
  });

  it('SKL-55 shows the 8 tags and no "e mais" when there are exactly 8', () => {
    const widget = renderWidget(privates(8));

    expect(tagsOf(widget)).toHaveLength(8);
    expect(within(widget).queryByText(/^e mais/)).toBeNull();
  });

  it('SKL-55 shows 8 tags and "e mais 3" when there are 11', () => {
    const widget = renderWidget(privates(11));

    expect(tagsOf(widget)).toEqual(
      Array.from({ length: 8 }, (_, index) => `Skill Fictícia ${String(index + 1).padStart(2, '0')}·`),
    );
    expect(within(widget).getByText('e mais 3')).toBeInTheDocument();
    expect(within(widget).queryByText('Skill Fictícia 09')).toBeNull();
  });

  it('SKL-55 counts "e mais N" from the private total of the catalog when the page holds only part of them', () => {
    const page = privates(50);
    const widget = renderWidget({ ...page, nextCursor: page.items[49]!.id, counts: { total: 300, private: 60 } });

    expect(tagsOf(widget)).toHaveLength(8);
    expect(within(widget).getByText('e mais 52')).toBeInTheDocument();
  });

  it('SKL-56 says "Nenhuma skill privada aguardando promoção." and keeps Abrir catálogo when there are none', () => {
    const widget = renderWidget(privates(0));

    expect(within(widget).getByText('Nenhuma skill privada aguardando promoção.')).toBeInTheDocument();
    expect(within(widget).getByRole('link', { name: 'Abrir catálogo' })).toBeInTheDocument();
    expect(tagsOf(widget)).toEqual([]);
    expect(within(widget).queryByRole('alert')).toBeNull();
  });

  it('SKL-57 shows a danger Alert with the unavailable text and keeps the title and the action when the read fails', () => {
    render(<PrivateSkillsSummary result={{ ok: false, status: 503 }} link={link} />);

    const widget = screen.getByRole('group', { name: 'Skills privadas aguardando promoção' });
    const alert = within(widget).getByRole('alert');
    expect(alert.textContent).toBe('Serviço indisponível. Tente novamente em instantes.');
    expect(alert).toHaveClass('bg-danger-subtle', 'text-danger');
    expect(within(widget).queryByText('Nenhuma skill privada aguardando promoção.')).toBeNull();
    expect(within(widget).queryByText(/^e mais/)).toBeNull();
    expect(within(widget).getByRole('link', { name: 'Abrir catálogo' })).toBeInTheDocument();
  });
});
