import type { Bullet, MasterResume, Profile, ResumeSummary, SaveProfileRequest, SkillDictionary } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import { SkillsCatalog } from '../../skills/index.js';
import { ResumeRepository, type BulletRecord } from '../infra/resume.repository.js';

type ResumeEventName = 'resume.profile_saved';

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
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * One structured event per write: the action, the resource and the person, and nothing typed by the
   * person: no name, e-mail, phone, location, link, summary, bullet text, description or URL (RES-33).
   */
  private record(event: ResumeEventName, resourceId: string, actorId: string): void {
    this.logger.info({ event, resourceId, actorId });
  }

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

  /** Creates the profile on the first save and updates it after; the texts arrive trimmed by the contract (RES-03, RES-04). */
  async saveProfile(userId: string, body: SaveProfileRequest): Promise<Profile> {
    const profile = await this.repository.upsertProfile(userId, body, this.clock.now());
    this.record('resume.profile_saved', userId, userId);
    return profile;
  }

  /** Whether the home may show step 02 as done; answered by the database, without describing any skill (RES-86). */
  async summary(userId: string): Promise<ResumeSummary> {
    return { ready: await this.repository.isReady(userId) };
  }
}
