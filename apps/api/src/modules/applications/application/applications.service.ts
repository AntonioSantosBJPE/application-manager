import type {
  ApplicationDetail,
  ApplicationEvent,
  CreateApplicationRequest,
} from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import { SkillsCatalog } from '../../skills/index.js';
import { isGhostSuggested } from '../domain/ghost.js';
import { isUuid } from '../domain/ids.js';
import { searchTextOf } from '../domain/search-text.js';
import {
  ApplicationsRepository,
  type ApplicationRecord,
  type EventRecord,
  type PostingSkillRow,
} from '../infra/applications.repository.js';

type ApplicationEventName = 'application.created';

/** The application does not exist, is somebody else's or the id is not a uuid (`404`, APP-19). */
export class ApplicationNotFoundError extends Error {
  constructor() {
    super('Application not found');
  }
}

/** One or more skills cannot be used: they do not exist, are private to someone else, repeat or are not uuids (`422`). */
export class InvalidSkillsError extends Error {
  constructor(readonly invalidSkillIds: string[]) {
    super('Some skills cannot be used');
  }
}

const toEvent = (event: EventRecord): ApplicationEvent => ({
  id: event.id,
  kind: event.kind,
  fromStatus: event.fromStatus,
  toStatus: event.toStatus,
  stage: event.stage,
  note: event.note,
  occurredAt: event.occurredAt.toISOString(),
});

/** What the member does with applications. The owner is always the `userId` the controller read from the session (APP-06). */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly repository: ApplicationsRepository,
    private readonly skills: SkillsCatalog,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * One structured event per write: the action, the application and the person, and nothing typed by
   * the person: no company, title, link, location, description or note (APP-41).
   */
  private record(event: ApplicationEventName, applicationId: string, actorId: string): void {
    this.logger.info({ event, applicationId, actorId });
  }

  /**
   * Registers the posting, its skills and the application in one transaction (APP-01..APP-03). A skill
   * the member cannot use refuses the whole request before anything is written (APP-05).
   */
  async create(userId: string, request: CreateApplicationRequest): Promise<ApplicationDetail> {
    const skills = (request.skills ?? []).map((skill) => ({ ...skill, skillId: isUuid(skill.skillId) ? skill.skillId.toLowerCase() : skill.skillId }));
    const invalid = await this.invalidSkillIds(
      userId,
      skills.map((skill) => skill.skillId),
    );
    if (invalid.length > 0) throw new InvalidSkillsError(invalid);

    const { company, title, url, description, level, location, workModel } = request.jobPosting;
    const id = await this.repository.transaction((tx) =>
      this.repository.insert(tx, {
        userId,
        posting: {
          company,
          title,
          url: url ?? null,
          description: description ?? null,
          level,
          location: location ?? null,
          workModel: workModel ?? null,
          searchText: searchTextOf(company, title),
        },
        skills,
        status: request.status ?? 'saved',
        now: this.clock.now(),
      }),
    );
    this.record('application.created', id, userId);
    return this.detailOf(userId, id);
  }

  /** The application of this user with its posting, skills and timeline (APP-18); anything else is `404` (APP-19). */
  async get(userId: string, id: string): Promise<ApplicationDetail> {
    return this.detailOf(userId, id);
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

  /** The whole application as the API shows it: the posting, the skills described by the catalog, the events and the ghost suggestion. */
  private async detailOf(userId: string, id: string): Promise<ApplicationDetail> {
    const record = isUuid(id) ? await this.repository.findOwned(userId, id) : undefined;
    if (record === undefined) throw new ApplicationNotFoundError();
    return this.describe(userId, record);
  }

  private async describe(userId: string, record: ApplicationRecord): Promise<ApplicationDetail> {
    const [skillRows, events] = await Promise.all([
      this.repository.skillsOf([record.jobPostingId]),
      this.repository.eventsOf(record.id),
    ]);
    const rows: PostingSkillRow[] = skillRows.get(record.jobPostingId) ?? [];
    const described = await this.skills.describe(
      userId,
      rows.map((row) => row.skillId),
    );
    return {
      id: record.id,
      status: record.status,
      company: record.company,
      title: record.title,
      level: record.level,
      workModel: record.workModel,
      url: record.url,
      location: record.location,
      description: record.description,
      skills: rows.flatMap((row) => {
        const skill = described.get(row.skillId);
        return skill === undefined
          ? []
          : [{ id: skill.id, name: skill.name, scope: skill.scope, category: skill.category, requirement: row.requirement }];
      }),
      createdAt: record.createdAt.toISOString(),
      lastActivityAt: record.lastActivityAt.toISOString(),
      ghostSuggested: isGhostSuggested(record, this.clock.now()),
      events: events.map(toEvent),
    };
  }
}
