import type { Bullet, MasterResume, Profile, SkillDictionary } from '@am/contracts';
import { Injectable } from '@nestjs/common';
import { SkillsCatalog } from '../../skills/index.js';
import { ResumeRepository, type BulletRecord } from '../infra/resume.repository.js';

/** What a member without a profile row sees: every field empty and the only locale there is (RES-01). */
const EMPTY_PROFILE: Profile = {
  fullName: '',
  headline: '',
  email: '',
  phone: null,
  location: null,
  links: [],
  summary: '',
  locale: 'pt-BR',
};

/** What the member does with the master resume. The owner is always the `userId` the controller read from the session (RES-28). */
@Injectable()
export class ResumeService {
  constructor(
    private readonly repository: ResumeRepository,
    private readonly skills: SkillsCatalog,
  ) {}

  /** The whole resume with every skill cited once in the dictionary; writes nothing, so a first visit leaves no row (RES-01, RES-02). */
  async get(userId: string): Promise<MasterResume> {
    const record = await this.repository.readAll(userId);
    const described = await this.skills.describe(
      userId,
      record.bullets.flatMap((bullet) => bullet.skillIds),
    );
    const skills: SkillDictionary = {};
    for (const [id, skill] of described) skills[id] = { name: skill.name, scope: skill.scope };

    const bulletsOf = (parent: 'experienceId' | 'projectId', id: string): Bullet[] =>
      record.bullets
        .filter((bullet: BulletRecord) => bullet[parent] === id)
        .map((bullet) => ({ id: bullet.id, text: bullet.text, skillIds: bullet.skillIds.filter((skillId) => described.has(skillId)) }));

    return {
      profile: record.profile ?? EMPTY_PROFILE,
      experiences: record.experiences.map((item) => ({ ...item, bullets: bulletsOf('experienceId', item.id) })),
      projects: record.projects.map((item) => ({ ...item, bullets: bulletsOf('projectId', item.id) })),
      educations: record.educations,
      certifications: record.certifications,
      languages: record.languages,
      skills,
    };
  }
}
