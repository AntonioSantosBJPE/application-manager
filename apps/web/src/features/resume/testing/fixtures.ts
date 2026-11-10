import type { Bullet, Certification, Education, Experience, Language, MasterResume, Profile, Project } from '@am/contracts';

export const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;

/** The id of the fictional skill `n`, as the dictionary of the resume keys it. */
export const skillId = (n: number) => uuid(500 + n);

/** The dictionary entry of the skills `ns`, named `Skill Fictícia n`. */
export function skillsOf(...ns: number[]): MasterResume['skills'] {
  return Object.fromEntries(ns.map((n) => [skillId(n), { name: `Skill Fictícia ${n}`, scope: 'global' as const }]));
}

/** A bullet with the skills `skillNs` (none means "sem skill"); `n` makes the id and the fictional text. */
export function bullet(n: number, skillNs: number[] = [1], overrides: Partial<Bullet> = {}): Bullet {
  return { id: uuid(300 + n), text: `Texto fictício do bullet ${n}.`, skillIds: skillNs.map(skillId), ...overrides };
}

export function experience(n: number, overrides: Partial<Experience> = {}): Experience {
  return {
    id: uuid(100 + n),
    role: `Cargo Fictício ${n}`,
    company: `Empresa Fictícia ${n}`,
    location: 'Remoto',
    startDate: '2023-03',
    endDate: null,
    bullets: [],
    ...overrides,
  };
}

export function project(n: number, overrides: Partial<Project> = {}): Project {
  return { id: uuid(200 + n), name: `Projeto Fictício ${n}`, url: null, description: null, bullets: [], ...overrides };
}

export function education(n: number, overrides: Partial<Education> = {}): Education {
  return {
    id: uuid(400 + n),
    course: `Curso Fictício ${n}`,
    institution: `Instituição Fictícia ${n}`,
    startDate: '2018-02',
    endDate: '2021-12',
    ...overrides,
  };
}

export function certification(n: number, overrides: Partial<Certification> = {}): Certification {
  return {
    id: uuid(600 + n),
    name: `Certificação Fictícia ${n}`,
    issuer: `Emissor Fictício ${n}`,
    issuedOn: '2022-06',
    url: null,
    ...overrides,
  };
}

export function language(n: number, overrides: Partial<Language> = {}): Language {
  return { id: uuid(700 + n), language: `Idioma Fictício ${n}`, level: 'advanced', ...overrides };
}

export function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    fullName: 'Pessoa Fictícia Alfa',
    headline: 'Título Fictício',
    email: 'alfa@exemplo.com',
    phone: null,
    location: null,
    links: [],
    summary: '',
    locale: 'pt-BR',
    ...overrides,
  };
}

/** The master resume as the api sends it, with fictional data; every section is empty unless overridden. */
export function masterResume(overrides: Partial<MasterResume> = {}): MasterResume {
  return {
    profile: profile(),
    experiences: [],
    projects: [],
    educations: [],
    certifications: [],
    languages: [],
    skills: {},
    ...overrides,
  };
}
