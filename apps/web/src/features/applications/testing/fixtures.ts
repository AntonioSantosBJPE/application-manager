import type { ApplicationDetail, ApplicationSummary, PostingSkill } from '@am/contracts';

export const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;

/** A skill of a posting; `n` makes the id and the fictional name. */
export function postingSkill(n: number, requirement: PostingSkill['requirement'] = 'required', name?: string): PostingSkill {
  return { id: uuid(500 + n), name: name ?? `Skill Fictícia ${n}`, scope: 'global', requirement };
}

/** The moment the screens read as "now" in the tests. */
export const NOW = new Date('2026-11-08T15:00:00.000Z');

/** One application as the list api sends it, with fictional data. */
export function application(n: number, overrides: Partial<ApplicationSummary> = {}): ApplicationSummary {
  return {
    id: uuid(n),
    status: 'saved',
    company: `Empresa Fictícia ${n}`,
    title: `Vaga de Teste ${n}`,
    level: 'mid',
    workModel: 'remote',
    skills: [postingSkill(1), postingSkill(2), postingSkill(3, 'nice_to_have')],
    createdAt: '2026-11-01T12:00:00.000Z',
    lastActivityAt: '2026-11-07T12:00:00.000Z',
    ghostSuggested: false,
    ...overrides,
  };
}

/** One application as the detail api sends it, with fictional data. */
export function detail(n: number, overrides: Partial<ApplicationDetail> = {}): ApplicationDetail {
  const summary = application(n);
  return {
    ...summary,
    url: `https://vagas.exemplo.com/${n}`,
    location: 'Recife, PE',
    description: 'Buscamos pessoa desenvolvedora backend para o time de sinistros.',
    skills: summary.skills.map((skill) => ({ ...skill, category: 'tool' as const })),
    events: [],
    ...overrides,
  };
}
