import { describe, expect, it } from 'vitest';
import {
  BULLET_TEXT_MAX_LENGTH,
  BULLETS_PER_ITEM_MAX,
  createBulletRequestSchema,
  createItemRequestSchemas,
  monthSchema,
  orderRequestSchema,
  PROFILE_LINKS_MAX,
  RESUME_ITEMS_MAX,
  saveProfileRequestSchema,
  SKILLS_PER_BULLET_MAX,
  updateBulletRequestSchema,
  updateItemRequestSchemas,
} from './resume.js';

const ok = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

const skillId = (n: number) => `0195f3a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const profile = (over: Record<string, unknown> = {}) => ({
  fullName: 'Pessoa Fictícia Alfa',
  headline: 'Engenheira de Software',
  email: 'alfa@exemplo.com',
  phone: null,
  location: null,
  links: [{ label: 'Site', url: 'https://exemplo.com/' }],
  summary: 'Resumo fictício.',
  locale: 'pt-BR',
  ...over,
});
const experience = (over: Record<string, unknown> = {}) => ({
  role: 'Desenvolvedora',
  company: 'Empresa Fictícia Alfa',
  startDate: '2021-01',
  endDate: '2023-03',
  ...over,
});

describe('limits', () => {
  it('RES-11 exports the limits of the spec', () => {
    expect(RESUME_ITEMS_MAX).toBe(50);
    expect(BULLETS_PER_ITEM_MAX).toBe(30);
    expect(SKILLS_PER_BULLET_MAX).toBe(20);
    expect(PROFILE_LINKS_MAX).toBe(5);
    expect(BULLET_TEXT_MAX_LENGTH).toBe(500);
  });
});

describe('profile', () => {
  it('RES-04 accepts empty texts while the profile is being filled', () => {
    const empty = profile({ fullName: '', headline: '', email: '', summary: '', links: [] });
    expect(ok(saveProfileRequestSchema, empty)).toBe(true);
  });

  it('RES-03 trims the texts', () => {
    const parsed = saveProfileRequestSchema.parse(profile({ fullName: '  Pessoa Fictícia Alfa  ' }));
    expect(parsed.fullName).toBe('Pessoa Fictícia Alfa');
  });

  it('RES-05 refuses a filled email outside the format', () => {
    expect(ok(saveProfileRequestSchema, profile({ email: 'sem-arroba' }))).toBe(false);
  });

  it('RES-05 refuses a field above its limit and accepts the limit itself', () => {
    expect(ok(saveProfileRequestSchema, profile({ fullName: 'a'.repeat(120) }))).toBe(true);
    expect(ok(saveProfileRequestSchema, profile({ fullName: 'a'.repeat(121) }))).toBe(false);
    expect(ok(saveProfileRequestSchema, profile({ summary: 'a'.repeat(2000) }))).toBe(true);
    expect(ok(saveProfileRequestSchema, profile({ summary: 'a'.repeat(2001) }))).toBe(false);
  });

  it('RES-05 accepts 5 links and refuses 6', () => {
    const links = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `L${i}`, url: 'https://exemplo.com/' }));
    expect(ok(saveProfileRequestSchema, profile({ links: links(5) }))).toBe(true);
    expect(ok(saveProfileRequestSchema, profile({ links: links(6) }))).toBe(false);
  });

  it('RES-05 refuses a link without label or with a url that is not http or https', () => {
    expect(ok(saveProfileRequestSchema, profile({ links: [{ label: '  ', url: 'https://exemplo.com/' }] }))).toBe(false);
    expect(ok(saveProfileRequestSchema, profile({ links: [{ label: 'Site', url: 'ftp://exemplo.com/' }] }))).toBe(false);
    expect(ok(saveProfileRequestSchema, profile({ links: [{ label: 'Site', url: 'javascript:alert(1)' }] }))).toBe(false);
  });

  it('RES-05 refuses a locale other than pt-BR', () => {
    expect(ok(saveProfileRequestSchema, profile({ locale: 'en-US' }))).toBe(false);
  });
});

describe('months', () => {
  it('RES-11 accepts 2023-03 and refuses 2023-13, 2023-3 and 2023-03-01', () => {
    expect(ok(monthSchema, '2023-03')).toBe(true);
    expect(ok(monthSchema, '2023-13')).toBe(false);
    expect(ok(monthSchema, '2023-3')).toBe(false);
    expect(ok(monthSchema, '2023-03-01')).toBe(false);
  });

  it('RES-11 refuses an end before the start in an experience and in an education', () => {
    expect(ok(createItemRequestSchemas.experiences, experience({ startDate: '2023-03', endDate: '2023-02' }))).toBe(false);
    expect(ok(createItemRequestSchemas.experiences, experience({ startDate: '2023-03', endDate: '2023-03' }))).toBe(true);
    const education = { course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2020-02', endDate: '2019-12' };
    expect(ok(createItemRequestSchemas.educations, education)).toBe(false);
  });

  it('RES-12 accepts an experience and an education without end', () => {
    expect(ok(createItemRequestSchemas.experiences, experience({ endDate: null }))).toBe(true);
    expect(ok(createItemRequestSchemas.experiences, experience({ endDate: undefined }))).toBe(true);
    const education = { course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2020-02', endDate: null };
    expect(ok(createItemRequestSchemas.educations, education)).toBe(true);
  });

  it('RES-11 checks the end against the start in an edit only when both come', () => {
    expect(ok(updateItemRequestSchemas.experiences, { startDate: '2023-03', endDate: '2023-01' })).toBe(false);
    expect(ok(updateItemRequestSchemas.experiences, { endDate: '2001-01' })).toBe(true);
    expect(ok(updateItemRequestSchemas.experiences, { endDate: null })).toBe(true);
    expect(ok(updateItemRequestSchemas.educations, { startDate: '2023-03', endDate: '2023-01' })).toBe(false);
  });
});

describe('items', () => {
  it('RES-11 refuses an empty required field and a field above the limit', () => {
    expect(ok(createItemRequestSchemas.experiences, experience({ role: '   ' }))).toBe(false);
    expect(ok(createItemRequestSchemas.experiences, experience({ company: 'a'.repeat(161) }))).toBe(false);
    expect(ok(createItemRequestSchemas.experiences, experience({ company: 'a'.repeat(160) }))).toBe(true);
  });

  it('RES-11 refuses a url that is not http or https in a project and a certification', () => {
    expect(ok(createItemRequestSchemas.projects, { name: 'Projeto Fictício', url: 'ftp://exemplo.com/' })).toBe(false);
    expect(ok(createItemRequestSchemas.projects, { name: 'Projeto Fictício', url: 'https://exemplo.com/' })).toBe(true);
    expect(ok(createItemRequestSchemas.certifications, { name: 'Certificação Fictícia', url: 'exemplo.com' })).toBe(false);
  });

  it('RES-11 refuses a language level outside the enum', () => {
    expect(ok(createItemRequestSchemas.languages, { language: 'Inglês', level: 'native' })).toBe(true);
    expect(ok(createItemRequestSchemas.languages, { language: 'Inglês', level: 'expert' })).toBe(false);
  });

  it('RES-11 leaves the optional fields of a create out', () => {
    expect(ok(createItemRequestSchemas.projects, { name: 'Projeto Fictício' })).toBe(true);
    expect(ok(createItemRequestSchemas.certifications, { name: 'Certificação Fictícia' })).toBe(true);
  });

  it('RES-08 sends in an edit only the fields it changes', () => {
    expect(updateItemRequestSchemas.projects.parse({ name: ' Novo ' })).toEqual({ name: 'Novo' });
  });
});

describe('bullet', () => {
  it('RES-19 refuses a text that is empty after trimming', () => {
    expect(ok(createBulletRequestSchema, { text: '   ', skillIds: [] })).toBe(false);
  });

  it('RES-19 accepts 500 characters and refuses 501', () => {
    expect(ok(createBulletRequestSchema, { text: 'a'.repeat(500), skillIds: [] })).toBe(true);
    expect(ok(createBulletRequestSchema, { text: 'a'.repeat(501), skillIds: [] })).toBe(false);
  });

  it('RES-19 accepts 20 skills and refuses 21', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => skillId(i + 1));
    expect(ok(createBulletRequestSchema, { text: 'Fiz algo.', skillIds: ids(20) })).toBe(true);
    expect(ok(createBulletRequestSchema, { text: 'Fiz algo.', skillIds: ids(21) })).toBe(false);
  });

  it('RES-18 accepts an empty list of skills', () => {
    expect(ok(createBulletRequestSchema, { text: 'Fiz algo.', skillIds: [] })).toBe(true);
  });

  it('RES-16 accepts only the text, only the skills and both, and refuses an empty edit', () => {
    expect(ok(updateBulletRequestSchema, { text: 'Novo.' })).toBe(true);
    expect(ok(updateBulletRequestSchema, { skillIds: [] })).toBe(true);
    expect(ok(updateBulletRequestSchema, { text: 'Novo.', skillIds: [skillId(1)] })).toBe(true);
    expect(ok(updateBulletRequestSchema, {})).toBe(false);
  });
});

describe('order', () => {
  it('RES-25 takes a list of ids', () => {
    expect(ok(orderRequestSchema, { ids: [skillId(1), skillId(2)] })).toBe(true);
    expect(ok(orderRequestSchema, { ids: 'x' })).toBe(false);
  });
});
