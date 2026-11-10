import type { Bullet, MasterResume } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import { bulletsWithoutSkill, missingSkillMessage, sectionCounts } from './counts';

const skillId = '8f6a1c2e-0000-7000-8000-000000000001';
let sequence = 0;
const uuid = () => `8f6a1c2e-0000-7000-8000-${String(++sequence).padStart(12, '0')}`;

const bullet = (withSkill: boolean): Bullet => ({ id: uuid(), text: 'Texto fictício de bullet.', skillIds: withSkill ? [skillId] : [] });
const experience = (bullets: Bullet[]) => ({
  id: uuid(), role: 'Cargo Fictício', company: 'Empresa Fictícia Alfa', location: null, startDate: '2023-03', endDate: null, bullets,
});
const project = (bullets: Bullet[]) => ({ id: uuid(), name: 'Projeto Fictício', url: null, description: null, bullets });

function resume(overrides: Partial<MasterResume> = {}): MasterResume {
  return {
    profile: { fullName: '', headline: '', email: '', phone: null, location: null, links: [], summary: '', locale: 'pt-BR' },
    experiences: [],
    projects: [],
    educations: [],
    certifications: [],
    languages: [],
    skills: {},
    ...overrides,
  };
}

describe('counts', () => {
  it('RES-37 counts the items of each section, and none for the profile', () => {
    const counts = sectionCounts(
      resume({
        experiences: [experience([]), experience([]), experience([])],
        projects: [project([]), project([])],
        educations: [{ id: uuid(), course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2019-02', endDate: null }],
        languages: [
          { id: uuid(), language: 'Inglês', level: 'advanced' },
          { id: uuid(), language: 'Espanhol', level: 'basic' },
        ],
      }),
    );

    expect(counts).toEqual({ profile: 0, experiences: 3, projects: 2, educations: 1, certifications: 0, languages: 2 });
  });

  it('RES-37 counts zero everywhere for an empty resume', () => {
    expect(sectionCounts(resume())).toEqual({ profile: 0, experiences: 0, projects: 0, educations: 0, certifications: 0, languages: 0 });
  });

  it('RES-38 counts the bullets with no skill across experiences and projects', () => {
    const total = bulletsWithoutSkill(
      resume({
        experiences: [experience([bullet(true), bullet(false)]), experience([bullet(false)])],
        projects: [project([bullet(false), bullet(true)])],
      }),
    );

    expect(total).toBe(3);
  });

  it('RES-38 counts none when every bullet has a skill, or when there is no bullet', () => {
    expect(bulletsWithoutSkill(resume({ experiences: [experience([bullet(true), bullet(true)])] }))).toBe(0);
    expect(bulletsWithoutSkill(resume({ experiences: [experience([])], projects: [project([])] }))).toBe(0);
  });

  it('RES-38 says nothing with no bullet without skill', () => {
    expect(missingSkillMessage(0)).toBeNull();
  });

  it('RES-38 says it in the singular with one', () => {
    expect(missingSkillMessage(1)).toBe('1 bullet sem skill não entra na ordenação por relevância.');
  });

  it('RES-38 says it in the plural with two or more', () => {
    expect(missingSkillMessage(2)).toBe('2 bullets sem skill não entram na ordenação por relevância.');
    expect(missingSkillMessage(12)).toBe('12 bullets sem skill não entram na ordenação por relevância.');
  });
});
