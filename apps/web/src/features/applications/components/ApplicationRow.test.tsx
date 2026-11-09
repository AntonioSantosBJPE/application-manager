// @vitest-environment jsdom
import type { ApplicationSummary } from '@am/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { application, NOW, postingSkill } from '../testing/fixtures';
import { ApplicationRow } from './ApplicationRow';

function renderRow(summary: ApplicationSummary, onOpen = vi.fn()) {
  render(
    <ul>
      <ApplicationRow application={summary} now={NOW} onOpen={onOpen} />
    </ul>,
  );
  return { row: screen.getByRole('listitem'), onOpen };
}

describe('ApplicationRow', () => {
  it('APP-44 shows the status icon named after the status, the company, the title, two skills, the level, the work model and the activity', () => {
    const { row } = renderRow(
      application(1, {
        status: 'interviewing',
        company: 'Empresa Fictícia Alfa',
        title: 'Vaga de Teste Pleno',
        level: 'senior',
        workModel: 'hybrid',
        lastActivityAt: '2026-11-05T15:00:00.000Z',
      }),
    );

    expect(within(row).getByRole('img', { name: 'Em entrevistas' })).toBeInTheDocument();
    expect(within(row).getByText('Empresa Fictícia Alfa')).toHaveClass('text-body-strong');
    expect(within(row).getByText('Vaga de Teste Pleno')).toBeInTheDocument();
    expect(within(row).getByText('Skill Fictícia 1')).toBeInTheDocument();
    expect(within(row).getByText('Skill Fictícia 2')).toBeInTheDocument();
    expect(within(row).queryByText('Skill Fictícia 3')).toBeNull();
    expect(within(row).getByText('Sênior')).toBeInTheDocument();
    expect(within(row).getByText('Híbrido')).toBeInTheDocument();
    expect(within(row).getByText('há 3 d')).toHaveClass('font-mono');
  });

  it('APP-44 shows two required skills in the order received, or two nice to have ones when none is required', () => {
    renderRow(application(1, { skills: [postingSkill(1, 'nice_to_have'), postingSkill(2), postingSkill(3), postingSkill(4)] }));
    expect(screen.getByText('Skill Fictícia 2')).toBeInTheDocument();
    expect(screen.getByText('Skill Fictícia 3')).toBeInTheDocument();
    expect(screen.queryByText('Skill Fictícia 1')).toBeNull();
    expect(screen.queryByText('Skill Fictícia 4')).toBeNull();
  });

  it('APP-44 falls back to the first two nice to have skills when the posting has no required one', () => {
    renderRow(
      application(1, { skills: [postingSkill(1, 'nice_to_have'), postingSkill(2, 'nice_to_have'), postingSkill(3, 'nice_to_have')] }),
    );
    expect(screen.getByText('Skill Fictícia 1')).toBeInTheDocument();
    expect(screen.getByText('Skill Fictícia 2')).toBeInTheDocument();
    expect(screen.queryByText('Skill Fictícia 3')).toBeNull();
  });

  it('APP-44 shows "—" when the posting has no work model', () => {
    const { row } = renderRow(application(1, { workModel: null }));
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(row).queryByText('Remoto')).toBeNull();
  });

  it('APP-44 shows "hoje" for an activity under 24 hours old', () => {
    const { row } = renderRow(application(1, { lastActivityAt: '2026-11-08T03:00:00.000Z' }));
    expect(within(row).getByText('hoje')).toBeInTheDocument();
  });

  it('APP-44 shows "sem retorno?" in warning with a clock only when ghostSuggested', () => {
    const { row } = renderRow(application(1, { ghostSuggested: true }));
    const ghost = within(row).getByText('sem retorno?');
    expect(ghost.parentElement).toHaveClass('text-warning');
    expect(ghost.parentElement?.querySelector('.lucide-clock')).not.toBeNull();
  });

  it('APP-44 leaves "sem retorno?" out when the api does not suggest it', () => {
    const { row } = renderRow(application(1, { ghostSuggested: false }));
    expect(within(row).queryByText('sem retorno?')).toBeNull();
  });

  it('APP-56 keeps only the status, the company, the title and the activity below md: the other cells are hidden until md', () => {
    const { row } = renderRow(application(1, { ghostSuggested: true }));
    const hiddenBelowMd = (text: string) => {
      const cell = within(row).getByText(text);
      const hidden = cell.closest('.hidden');
      expect(hidden, text).not.toBeNull();
      expect(hidden!.className).toMatch(/md:(flex|inline|inline-flex)/);
    };
    hiddenBelowMd('Skill Fictícia 1');
    hiddenBelowMd('Pleno');
    hiddenBelowMd('Remoto');
    hiddenBelowMd('sem retorno?');
    for (const text of ['Empresa Fictícia 1', 'Vaga de Teste 1', 'há 1 d']) {
      expect(within(row).getByText(text).closest('.hidden'), text).toBeNull();
    }
    expect(within(row).getByRole('img', { name: 'Salva' }).closest('.hidden')).toBeNull();
  });

  it('APP-49 opens the application with a click on the row and on the company, and gives the link its address', () => {
    const { row, onOpen } = renderRow(application(1));

    fireEvent.click(within(row).getByText('Skill Fictícia 1'));
    expect(onOpen).toHaveBeenLastCalledWith(application(1).id);

    onOpen.mockClear();
    const link = within(row).getByRole('link', { name: 'Empresa Fictícia 1' });
    expect(link).toHaveAttribute('href', `/applications/${application(1).id}`);
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(application(1).id);
  });

  it('APP-49 leaves a click with a modifier key to the browser, so the link opens in a new tab', () => {
    const { row, onOpen } = renderRow(application(1));

    fireEvent.click(within(row).getByRole('link'), { ctrlKey: true });

    expect(onOpen).not.toHaveBeenCalled();
  });
});
