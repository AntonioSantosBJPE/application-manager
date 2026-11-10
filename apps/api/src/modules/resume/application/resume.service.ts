import { BULLETS_PER_ITEM_MAX, RESUME_ITEMS_MAX, type Bullet, type BulletResponse, type CreateBulletRequest, type UpdateBulletRequest, type MasterResume, type OrderResponse, type Profile, type ResumeSection, type ResumeSummary, type SaveProfileRequest, type SkillDictionary } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import { SkillsCatalog } from '../../skills/index.js';
import { isUuid } from '../domain/ids.js';
import { isExactOrder } from '../domain/order.js';
import type { BulletSection } from '../domain/sections.js';
import { ResumeRepository, type BulletRecord } from '../infra/resume.repository.js';

type ResumeEventName = 'resume.profile_saved' | 'resume.item_created' | 'resume.item_updated' | 'resume.item_deleted' | 'resume.items_ordered' | 'resume.bullet_created' | 'resume.bullet_updated' | 'resume.bullet_deleted';

/** An item as the API shows it, without the bullets of an experience or a project (AD-028). */
export type ResumeItem = Record<string, unknown>;

/** The item or the bullet does not exist, is somebody else's, belongs to another parent or the id is not a uuid (`404`, RES-14, RES-22). */
export class ResumeNotFoundError extends Error {
  constructor() {
    super('Resume entry not found');
  }
}

/** An edit leaves the end of an experience or an education before its start, counting the date already saved (`400`, RES-11). */
export class InvalidDatesError extends Error {
  constructor() {
    super('The end must not be before the start');
  }
}

/** The ids sent are not exactly the ids that exist: one is missing, repeated, foreign or not a uuid (`400`, RES-27). */
export class OrderMismatchError extends Error {
  constructor() {
    super('The order must list every id exactly once');
  }
}

/** One or more skills cannot be used: they do not exist, are private to someone else, repeat or are not uuids (`422`, RES-20). */
export class InvalidSkillsError extends Error {
  constructor(readonly invalidSkillIds: string[]) {
    super('Some skills cannot be used');
  }
}

/** The section already holds the most items, or the item the most bullets, the design allows (`422`, RES-13, RES-21). */
export class LimitReachedError extends Error {
  constructor(limit: number, what: string) {
    super(`A resume holds at most ${limit} ${what}`);
  }
}

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

  /**
   * Puts a new item on top of its section. The count and the insert share one transaction under the lock of
   * the user, so two requests with 49 items end with 50 and one `422` (RES-07, RES-13).
   */
  async createItem(userId: string, section: ResumeSection, body: Record<string, unknown>): Promise<ResumeItem> {
    const item = await this.repository.transaction(async (tx) => {
      await this.repository.lockUser(tx, userId);
      if ((await this.repository.countItems(tx, section, userId)) >= RESUME_ITEMS_MAX) throw new LimitReachedError(RESUME_ITEMS_MAX, 'items per section');
      return this.repository.insertItem(tx, section, userId, body);
    });
    this.record('resume.item_created', String(item.id), userId);
    return item;
  }

  /**
   * Writes the fields sent and answers the item. An end date edited alone is checked against the start saved,
   * and the other way round, under the lock of the row (RES-08, RES-11, RES-14).
   */
  async updateItem(userId: string, section: ResumeSection, id: string, body: Record<string, unknown>): Promise<ResumeItem> {
    if (!isUuid(id)) throw new ResumeNotFoundError();
    const item = await this.repository.transaction(async (tx) => {
      const current = await this.repository.findItem(tx, section, userId, id);
      if (current === undefined) throw new ResumeNotFoundError();
      if (Object.keys(body).length === 0) return current;
      const start = (body.startDate ?? current.startDate) as string | undefined;
      const end = (body.endDate === undefined ? current.endDate : body.endDate) as string | null | undefined;
      if (start !== undefined && end !== undefined && end !== null && end < start) throw new InvalidDatesError();
      const updated = await this.repository.updateItem(tx, section, userId, id, body);
      if (updated === undefined) throw new ResumeNotFoundError();
      return updated;
    });
    this.record('resume.item_updated', id, userId);
    return item;
  }

  /** The delete is one statement, so the item and its bullets go together or not at all (RES-09, RES-10, RES-14). */
  async deleteItem(userId: string, section: ResumeSection, id: string): Promise<void> {
    if (!isUuid(id) || !(await this.repository.deleteItem(section, userId, id))) throw new ResumeNotFoundError();
    this.record('resume.item_deleted', id, userId);
  }

  /**
   * Saves the order of a section. The set is compared with the one in the table under the lock of the user, so
   * an item created a moment ago is either in the list or the list is refused (RES-25, RES-27).
   */
  async orderItems(userId: string, section: ResumeSection, ids: string[]): Promise<OrderResponse> {
    await this.repository.transaction(async (tx) => {
      await this.repository.lockUser(tx, userId);
      if (!isExactOrder(ids, await this.repository.itemIds(tx, section, userId))) throw new OrderMismatchError();
      await this.repository.setOrder(tx, section, userId, ids);
    });
    this.record('resume.items_ordered', userId, userId);
    return { ids };
  }

  /**
   * Puts a new bullet at the end of its item. The item is looked for first, so a bullet of somebody else's
   * item answers `404` and not `422`; the count and the insert then share a transaction under the lock of the
   * user (RES-15, RES-20, RES-21, RES-22).
   */
  async createBullet(userId: string, section: BulletSection, itemId: string, body: CreateBulletRequest): Promise<BulletResponse> {
    if (!isUuid(itemId) || !(await this.repository.itemExists(section, userId, itemId))) throw new ResumeNotFoundError();
    const skillIds = this.normalized(body.skillIds);
    const invalid = await this.invalidSkillIds(userId, skillIds);
    if (invalid.length > 0) throw new InvalidSkillsError(invalid);

    const bullet = await this.repository.transaction(async (tx) => {
      await this.repository.lockUser(tx, userId);
      if (!(await this.repository.itemExists(section, userId, itemId, tx))) throw new ResumeNotFoundError();
      if ((await this.repository.countBullets(tx, section, itemId)) >= BULLETS_PER_ITEM_MAX) throw new LimitReachedError(BULLETS_PER_ITEM_MAX, 'bullets per item');
      return this.repository.insertBullet(tx, section, userId, itemId, { text: body.text, skillIds });
    });
    this.record('resume.bullet_created', bullet.id, userId);
    return this.bulletResponse(userId, bullet);
  }

  /**
   * Writes the text, the skills or both. The bullet is looked for in its item first, so another item's bullet
   * and somebody else's answer `404` before the skills are looked at (RES-16, RES-20, RES-22).
   */
  async updateBullet(userId: string, section: BulletSection, itemId: string, bulletId: string, body: UpdateBulletRequest): Promise<BulletResponse> {
    if (!isUuid(itemId) || !isUuid(bulletId) || (await this.repository.findBullet(section, userId, itemId, bulletId)) === undefined) throw new ResumeNotFoundError();
    const skillIds = body.skillIds === undefined ? undefined : this.normalized(body.skillIds);
    if (skillIds !== undefined) {
      const invalid = await this.invalidSkillIds(userId, skillIds);
      if (invalid.length > 0) throw new InvalidSkillsError(invalid);
    }
    const bullet = await this.repository.updateBullet(section, userId, itemId, bulletId, { text: body.text, skillIds });
    if (bullet === undefined) throw new ResumeNotFoundError();
    this.record('resume.bullet_updated', bullet.id, userId);
    return this.bulletResponse(userId, bullet);
  }

  async deleteBullet(userId: string, section: BulletSection, itemId: string, bulletId: string): Promise<void> {
    if (!isUuid(itemId) || !isUuid(bulletId) || !(await this.repository.deleteBullet(section, userId, itemId, bulletId))) throw new ResumeNotFoundError();
    this.record('resume.bullet_deleted', bulletId, userId);
  }

  /** A bullet and the skills it cites, each described once by the catalog; a skill that is no longer visible drops out without an error (RES-23). */
  private async bulletResponse(userId: string, bullet: BulletRecord): Promise<BulletResponse> {
    const described = await this.skills.describe(userId, bullet.skillIds);
    const skills: SkillDictionary = {};
    for (const [id, skill] of described) skills[id] = { name: skill.name, scope: skill.scope };
    return { bullet: { id: bullet.id, text: bullet.text, skillIds: bullet.skillIds.filter((id) => described.has(id)) }, skills };
  }

  /** The skill ids as stored: a uuid in lowercase, anything else untouched so it is refused as sent. */
  private normalized(ids: string[]): string[] {
    return ids.map((id) => (isUuid(id) ? id.toLowerCase() : id));
  }

  /** The ids, in the order sent and each once, that the member cannot use: not a uuid, repeated, unknown or somebody else's private skill. */
  private async invalidSkillIds(userId: string, ids: string[]): Promise<string[]> {
    const invalid = new Set<string>();
    const seen = new Set<string>();
    for (const id of ids) {
      if (!isUuid(id) || seen.has(id)) invalid.add(id);
      seen.add(id);
    }
    const usable = new Set(await this.skills.visibleIds(userId, [...seen]));
    for (const id of ids) if (isUuid(id) && !usable.has(id)) invalid.add(id);
    return ids.filter((id, index) => invalid.has(id) && ids.indexOf(id) === index);
  }
}
