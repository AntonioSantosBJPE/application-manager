import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUSES,
  applicationsPageSchema,
  changeStatusRequestSchema,
  CLOSED_STATUSES,
  createApplicationRequestSchema,
  createEventRequestSchema,
  FUNNEL_ORDER,
  listApplicationsQuerySchema,
  replaceSkillsRequestSchema,
  updateJobPostingRequestSchema,
} from './applications.js';
import { adminSkillSchema } from './skills.js';

const ok = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

const posting = { company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', level: 'mid' };
const create = (jobPosting: Record<string, unknown> = {}, rest: Record<string, unknown> = {}) => ({
  jobPosting: { ...posting, ...jobPosting },
  ...rest,
});
const skillId = '0195f3a0-0000-7000-8000-000000000001';

describe('status groups', () => {
  it('APP-11 splits the eight statuses into the active and the closed tab', () => {
    expect([...ACTIVE_STATUSES]).toEqual(['saved', 'applied', 'interviewing', 'offer']);
    expect([...CLOSED_STATUSES]).toEqual(['accepted', 'rejected', 'withdrawn', 'ghosted']);
  });

  it('APP-14 orders the funnel from the most advanced status to the least, active first', () => {
    expect([...FUNNEL_ORDER]).toEqual([
      'offer',
      'interviewing',
      'applied',
      'saved',
      'accepted',
      'rejected',
      'withdrawn',
      'ghosted',
    ]);
  });
});

describe('createApplicationRequestSchema', () => {
  it('APP-04 accepts the minimum posting and trims company and title', () => {
    const parsed = createApplicationRequestSchema.parse(create({ company: '  Empresa Fictícia Alfa ', title: ' Vaga de Teste Pleno  ' }));

    expect(parsed.jobPosting.company).toBe('Empresa Fictícia Alfa');
    expect(parsed.jobPosting.title).toBe('Vaga de Teste Pleno');
    expect(parsed.skills).toBeUndefined();
    expect(parsed.status).toBeUndefined();
  });

  it('APP-04 accepts company and title of 1 and 200 characters and refuses empty, blank and 201', () => {
    expect(ok(createApplicationRequestSchema, create({ company: 'a' }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ company: 'a'.repeat(200) }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ company: 'a'.repeat(201) }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ company: '' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ company: '   ' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ title: 't'.repeat(200) }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ title: 't'.repeat(201) }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ title: ' ' }))).toBe(false);
  });

  it('APP-04 counts the 200 characters after trimming', () => {
    expect(ok(createApplicationRequestSchema, create({ company: ` ${'a'.repeat(200)} ` }))).toBe(true);
  });

  it('APP-04 accepts a location of 120 characters and refuses 121', () => {
    expect(ok(createApplicationRequestSchema, create({ location: 'l'.repeat(120) }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ location: 'l'.repeat(121) }))).toBe(false);
  });

  it('APP-04 accepts an http or https link of up to 2048 characters and refuses other schemes and 2049', () => {
    const link = (length: number) => `https://vagas.exemplo.com/${'a'.repeat(length - 'https://vagas.exemplo.com/'.length)}`;
    expect(ok(createApplicationRequestSchema, create({ url: 'http://vagas.exemplo.com/1' }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ url: 'https://vagas.exemplo.com/1' }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ url: link(2048) }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ url: link(2049) }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ url: 'ftp://vagas.exemplo.com/1' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ url: 'javascript:alert(1)' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ url: 'vagas.exemplo.com' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ url: '' }))).toBe(false);
  });

  it('APP-04 accepts a description of 20000 characters and refuses 20001', () => {
    expect(ok(createApplicationRequestSchema, create({ description: 'd'.repeat(20_000) }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({ description: 'd'.repeat(20_001) }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ description: 'Linha 1\nLinha 2\tcom tab' }))).toBe(true);
  });

  it('APP-04 refuses a control character such as U+0000, which Postgres would refuse', () => {
    expect(ok(createApplicationRequestSchema, create({ company: 'Empresa\u0000Alfa' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ description: 'texto\u0000' }))).toBe(false);
  });

  it('APP-04 refuses level, workModel, status and requirement outside the enum, and a missing level', () => {
    expect(ok(createApplicationRequestSchema, create({ level: 'principal' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ level: undefined }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({ workModel: 'remoto' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({}, { status: 'archived' }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({}, { skills: [{ skillId, requirement: 'optional' }] }))).toBe(false);
    for (const level of ['intern', 'junior', 'mid', 'senior', 'specialist']) {
      expect(ok(createApplicationRequestSchema, create({ level }))).toBe(true);
    }
    for (const workModel of ['remote', 'hybrid', 'onsite']) {
      expect(ok(createApplicationRequestSchema, create({ workModel }))).toBe(true);
    }
  });

  it('APP-04 accepts up to 50 skills and refuses 51', () => {
    const skills = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ skillId: `id-${index}`, requirement: 'required' }));
    expect(ok(createApplicationRequestSchema, create({}, { skills: skills(50) }))).toBe(true);
    expect(ok(createApplicationRequestSchema, create({}, { skills: skills(51) }))).toBe(false);
    expect(ok(createApplicationRequestSchema, create({}, { skills: [] }))).toBe(true);
  });

  it('APP-04 leaves a skill id that is not a uuid to the API, which answers 422 (APP-05)', () => {
    expect(ok(createApplicationRequestSchema, create({}, { skills: [{ skillId: 'not-a-uuid', requirement: 'required' }] }))).toBe(true);
  });

  it('APP-06 strips a userId sent by the client', () => {
    const parsed = createApplicationRequestSchema.parse({ ...create(), userId: 'someone-else' });

    expect(parsed).not.toHaveProperty('userId');
  });
});

describe('updateJobPostingRequestSchema', () => {
  it('APP-31 refuses an empty body and a body with only unknown keys', () => {
    expect(ok(updateJobPostingRequestSchema, {})).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { userId: 'x' })).toBe(false);
  });

  it('APP-28 accepts one field alone', () => {
    expect(updateJobPostingRequestSchema.parse({ company: ' Nova Empresa ' })).toEqual({ company: 'Nova Empresa' });
  });

  it('APP-29 accepts null on url, location, description and workModel and refuses it on the required fields', () => {
    expect(
      updateJobPostingRequestSchema.parse({ url: null, location: null, description: null, workModel: null }),
    ).toEqual({ url: null, location: null, description: null, workModel: null });
    expect(ok(updateJobPostingRequestSchema, { company: null })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { title: null })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { level: null })).toBe(false);
  });

  it('APP-31 applies the limits of the creation to each field', () => {
    expect(ok(updateJobPostingRequestSchema, { company: 'a'.repeat(201) })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { title: '  ' })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { url: 'ftp://x.exemplo.com' })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { location: 'l'.repeat(121) })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { description: 'd'.repeat(20_001) })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { level: 'principal' })).toBe(false);
    expect(ok(updateJobPostingRequestSchema, { workModel: 'remoto' })).toBe(false);
  });
});

describe('replaceSkillsRequestSchema', () => {
  it('APP-30 is the list of skills itself, empty allowed, at most 50', () => {
    expect(ok(replaceSkillsRequestSchema, [])).toBe(true);
    expect(ok(replaceSkillsRequestSchema, [{ skillId, requirement: 'nice_to_have' }])).toBe(true);
    expect(ok(replaceSkillsRequestSchema, Array.from({ length: 51 }, () => ({ skillId, requirement: 'required' })))).toBe(false);
    expect(ok(replaceSkillsRequestSchema, { skills: [] })).toBe(false);
  });
});

describe('changeStatusRequestSchema', () => {
  it('APP-20 takes a status and an optional note of up to 2000 characters', () => {
    expect(ok(changeStatusRequestSchema, { status: 'applied' })).toBe(true);
    expect(ok(changeStatusRequestSchema, { status: 'applied', note: 'n'.repeat(2000) })).toBe(true);
    expect(ok(changeStatusRequestSchema, { status: 'applied', note: 'n'.repeat(2001) })).toBe(false);
    expect(ok(changeStatusRequestSchema, { status: 'archived' })).toBe(false);
    expect(ok(changeStatusRequestSchema, {})).toBe(false);
  });

  it('APP-20 does not accept submittedDocumentId yet (AD-017)', () => {
    const parsed = changeStatusRequestSchema.parse({ status: 'applied', submittedDocumentId: '0195f3a0-0000-7000-8000-000000000001' });

    expect(parsed).toEqual({ status: 'applied' });
  });
});

describe('createEventRequestSchema', () => {
  it('APP-23 accepts a stage with its type and a note with its text, dated or not', () => {
    expect(ok(createEventRequestSchema, { kind: 'stage', stage: 'hr' })).toBe(true);
    expect(ok(createEventRequestSchema, { kind: 'stage', stage: 'technical', note: 'Conversa boa', occurredAt: '2026-11-01T12:00:00.000Z' })).toBe(true);
    expect(ok(createEventRequestSchema, { kind: 'note', note: 'Falei com a pessoa recrutadora' })).toBe(true);
    for (const stage of ['screening', 'hr', 'technical', 'case', 'other']) {
      expect(ok(createEventRequestSchema, { kind: 'stage', stage })).toBe(true);
    }
  });

  it('APP-25 refuses status_changed, a stage without type or with an unknown one, and a note without text', () => {
    expect(ok(createEventRequestSchema, { kind: 'status_changed', toStatus: 'applied' })).toBe(false);
    expect(ok(createEventRequestSchema, { kind: 'stage' })).toBe(false);
    expect(ok(createEventRequestSchema, { kind: 'stage', stage: 'final' })).toBe(false);
    expect(ok(createEventRequestSchema, { kind: 'note' })).toBe(false);
    expect(ok(createEventRequestSchema, { kind: 'note', note: '   ' })).toBe(false);
    expect(ok(createEventRequestSchema, { kind: 'other' })).toBe(false);
  });

  it('APP-23 trims the note of a stage and takes a blank one as none', () => {
    const parse = (note: string) => createEventRequestSchema.parse({ kind: 'stage', stage: 'hr', note });

    expect(parse('  Conversa boa \n')).toMatchObject({ note: 'Conversa boa' });
    expect(parse('')).toMatchObject({ note: undefined });
    expect(parse('  \n\t ')).toMatchObject({ note: undefined });
  });

  it('APP-25 accepts a note of 2000 characters and refuses 2001, on a note and on a stage', () => {
    expect(ok(createEventRequestSchema, { kind: 'note', note: 'n'.repeat(2000) })).toBe(true);
    expect(ok(createEventRequestSchema, { kind: 'note', note: 'n'.repeat(2001) })).toBe(false);
    expect(ok(createEventRequestSchema, { kind: 'stage', stage: 'hr', note: 'n'.repeat(2001) })).toBe(false);
  });

  it('APP-25 refuses an occurredAt that is not an ISO date', () => {
    expect(ok(createEventRequestSchema, { kind: 'note', note: 'x', occurredAt: 'ontem' })).toBe(false);
  });
});

describe('listApplicationsQuerySchema', () => {
  it('APP-11 defaults the tab to active and the sort to the last activity', () => {
    const parsed = listApplicationsQuerySchema.parse({});

    expect(parsed.tab).toBe('active');
    expect(parsed.sort).toBe('activity');
    expect(parsed.status).toBeUndefined();
  });

  it('APP-12 reads status, level and workModel as comma separated lists', () => {
    const parsed = listApplicationsQuerySchema.parse({
      tab: 'closed',
      status: 'accepted,rejected',
      level: 'junior,mid',
      workModel: 'remote',
      sort: 'created',
      q: 'saude',
    });

    expect(parsed).toEqual({
      tab: 'closed',
      status: ['accepted', 'rejected'],
      level: ['junior', 'mid'],
      workModel: ['remote'],
      sort: 'created',
      q: 'saude',
    });
  });

  it('APP-17 refuses a value outside the enum in each list, a tab and a sort outside the enum', () => {
    expect(ok(listApplicationsQuerySchema, { status: 'applied,archived' })).toBe(false);
    expect(ok(listApplicationsQuerySchema, { level: 'principal' })).toBe(false);
    expect(ok(listApplicationsQuerySchema, { workModel: 'remoto' })).toBe(false);
    expect(ok(listApplicationsQuerySchema, { tab: 'all' })).toBe(false);
    expect(ok(listApplicationsQuerySchema, { sort: 'company' })).toBe(false);
  });

  it('APP-17 refuses an empty list parameter, as a value outside the enum', () => {
    expect(ok(listApplicationsQuerySchema, { status: '' })).toBe(false);
    expect(ok(listApplicationsQuerySchema, { level: '' })).toBe(false);
    expect(ok(listApplicationsQuerySchema, { workModel: '' })).toBe(false);
    expect(ok(listApplicationsQuerySchema, { level: 'junior,' })).toBe(false);
  });

  it('APP-17 accepts q of 100 characters and refuses 101', () => {
    expect(ok(listApplicationsQuerySchema, { q: 'q'.repeat(100) })).toBe(true);
    expect(ok(listApplicationsQuerySchema, { q: 'q'.repeat(101) })).toBe(false);
  });
});

describe('applicationsPageSchema', () => {
  it('APP-16 carries active, closed and one count per status', () => {
    const byStatus = { saved: 1, applied: 0, interviewing: 0, offer: 0, accepted: 0, rejected: 0, withdrawn: 0, ghosted: 0 };

    expect(ok(applicationsPageSchema, { items: [], nextCursor: null, counts: { active: 1, closed: 0, byStatus } })).toBe(true);
    expect(ok(applicationsPageSchema, { items: [], nextCursor: null, counts: { active: 1, closed: 0 } })).toBe(false);
  });
});

describe('adminSkillSchema postingCount', () => {
  const skill = { id: skillId, name: 'Node.js', category: 'language', scope: 'global', aliases: [] };

  it('APP-85 accepts a non-negative integer count and refuses a negative or fractional one', () => {
    expect(ok(adminSkillSchema, { ...skill, postingCount: 0 })).toBe(true);
    expect(ok(adminSkillSchema, { ...skill, postingCount: 12 })).toBe(true);
    expect(ok(adminSkillSchema, { ...skill, postingCount: -1 })).toBe(false);
    expect(ok(adminSkillSchema, { ...skill, postingCount: 1.5 })).toBe(false);
  });

  it('APP-85 requires the count on every row: a row without it is refused', () => {
    expect(ok(adminSkillSchema, skill)).toBe(false);
  });
});
