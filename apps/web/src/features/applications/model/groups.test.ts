import type { ApplicationStatus, ApplicationSummary } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { groups } from './groups';

const byStatus = { saved: 4, applied: 9, interviewing: 2, offer: 1, accepted: 0, rejected: 0, withdrawn: 0, ghosted: 0 };

const row = (n: number, status: ApplicationStatus): ApplicationSummary => ({
  id: `8f6a1c2e-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`,
  status,
  company: `Empresa Fictícia ${n}`,
  title: 'Vaga de Teste Pleno',
  level: 'mid',
  workModel: null,
  skills: [],
  createdAt: '2026-10-20T15:00:00.000Z',
  lastActivityAt: '2026-10-20T15:00:00.000Z',
  ghostSuggested: false,
});

describe('groups', () => {
  it('APP-45 cuts the list into one section per status in the order received', () => {
    const items = [row(1, 'offer'), row(2, 'interviewing'), row(3, 'interviewing'), row(4, 'applied'), row(5, 'saved')];

    const sections = groups(items, byStatus);

    expect(sections.map((s) => s.status)).toEqual(['offer', 'interviewing', 'applied', 'saved']);
    expect(sections.map((s) => s.items.map((i) => i.id))).toEqual([
      [items[0]?.id],
      [items[1]?.id, items[2]?.id],
      [items[3]?.id],
      [items[4]?.id],
    ]);
  });

  it('APP-45 uses the number of counts.byStatus, not the rows loaded', () => {
    const sections = groups([row(1, 'applied'), row(2, 'applied')], byStatus);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.count).toBe(9);
    expect(sections[0]?.items).toHaveLength(2);
  });

  it('APP-45 does not show a status with no row loaded, even with a count', () => {
    expect(groups([row(1, 'offer')], byStatus).map((s) => s.status)).toEqual(['offer']);
  });

  it('APP-45 does not reorder: the order of the api wins over the funnel', () => {
    const sections = groups([row(1, 'saved'), row(2, 'offer')], byStatus);

    expect(sections.map((s) => s.status)).toEqual(['saved', 'offer']);
  });

  it('APP-45 gives no section for an empty list', () => {
    expect(groups([], byStatus)).toEqual([]);
  });
});
