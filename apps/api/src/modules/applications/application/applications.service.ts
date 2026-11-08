import {
  ACTIVE_STATUSES,
  EVENT_FUTURE_TOLERANCE_MS,
  FUNNEL_ORDER,
  normalizeSkillKey,
  type ApplicationDetail,
  type ApplicationEvent,
  type ApplicationStatus,
  type ApplicationsCount,
  type ApplicationsPage,
  type ApplicationSummary,
  type ChangeStatusRequest,
  type CreateApplicationRequest,
  type CreateEventRequest,
  type ListApplicationsQuery,
  type ReplaceSkillsRequest,
  type UpdateJobPostingRequest,
} from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CLOCK, type Clock } from '../../../infra/clock/clock.js';
import { SkillsCatalog } from '../../skills/index.js';
import { decodeCursor, encodeCursor } from '../domain/cursor.js';
import { funnelRank, statusesOf } from '../domain/funnel.js';
import { GHOST_SNOOZE_MS, isGhostSuggested } from '../domain/ghost.js';
import { isUuid } from '../domain/ids.js';
import { searchPatternOf, searchTextOf } from '../domain/search-text.js';
import {
  ApplicationsRepository,
  type ApplicationRecord,
  type EventRecord,
  type ListFilters,
  type PostingSkillRow,
} from '../infra/applications.repository.js';

/** The list shows 50 applications per page (APP-09). */
export const LIST_PAGE_SIZE = 50;

type ApplicationEventName = 'application.created' | 'application.posting_updated' | 'application.skills_replaced' | 'application.status_changed' | 'application.event_added' | 'application.ghost_snoozed';

/** The application does not exist, is somebody else's or the id is not a uuid (`404`, APP-19). */
export class ApplicationNotFoundError extends Error {
  constructor() {
    super('Application not found');
  }
}

/** An event dated more than 5 minutes ahead of the clock (`400`, APP-25). */
export class EventInFutureError extends Error {
  constructor() {
    super('The event is dated in the future');
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
    const skills = this.normalized(request.skills ?? []);
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

  /**
   * One page of the member's applications with the counters of the tabs and of each status (APP-09..APP-13,
   * APP-16). A search matches the company and the title, or a skill whose name or alias holds the key of `q`.
   */
  async list(userId: string, query: ListApplicationsQuery): Promise<ApplicationsPage> {
    const search = await this.searchOf(userId, query.q);
    const { level, workModel } = query;
    const filters: ListFilters = {
      statuses: query.status === undefined ? statusesOf(query.tab) : statusesOf(query.tab).filter((status) => query.status!.includes(status)),
      level,
      workModel,
      search,
    };
    const cursor = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const [found, counted] = await Promise.all([
      this.repository.page(userId, filters, { sort: query.sort, cursor, limit: LIST_PAGE_SIZE + 1 }),
      this.repository.countByStatus(userId, { level, workModel, search }),
    ]);
    const records = found.slice(0, LIST_PAGE_SIZE);
    const last = records.at(-1);
    const byStatus = Object.fromEntries(FUNNEL_ORDER.map((status) => [status, counted.get(status) ?? 0])) as Record<ApplicationStatus, number>;
    const active = ACTIVE_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
    const closed = FUNNEL_ORDER.reduce((sum, status) => sum + byStatus[status], 0) - active;
    return {
      items: await this.summaries(userId, records),
      nextCursor:
        found.length > LIST_PAGE_SIZE && last !== undefined
          ? encodeCursor({ rank: funnelRank(last.status), at: query.sort === 'created' ? last.createdAt : last.lastActivityAt, id: last.id })
          : null,
      counts: { active, closed, byStatus },
    };
  }

  /** The total of applications of the member, for the sidebar and the home (APP-43, APP-84). */
  async count(userId: string): Promise<ApplicationsCount> {
    return { total: await this.repository.countAll(userId) };
  }

  /** The text pattern and the skills of `q`; a `q` with nothing to compare filters nothing. */
  private async searchOf(userId: string, q: string | undefined): Promise<ListFilters['search']> {
    if (q === undefined) return undefined;
    const pattern = searchPatternOf(q);
    if (pattern === '%%') return undefined;
    const key = normalizeSkillKey(q);
    return { pattern, skillIds: key === '' ? [] : await this.skills.matchingIds(userId, key) };
  }

  /** The list items: the skills of every posting of the page are described by the catalog in one call. */
  private async summaries(userId: string, records: ApplicationRecord[]): Promise<ApplicationSummary[]> {
    const skillRows = await this.repository.skillsOf(records.map((record) => record.jobPostingId));
    const described = await this.skills.describe(
      userId,
      [...skillRows.values()].flatMap((rows) => rows.map((row) => row.skillId)),
    );
    const now = this.clock.now();
    return records.map((record) => ({
      id: record.id,
      status: record.status,
      company: record.company,
      title: record.title,
      level: record.level,
      workModel: record.workModel,
      skills: (skillRows.get(record.jobPostingId) ?? []).flatMap((row) => {
        const skill = described.get(row.skillId);
        return skill === undefined ? [] : [{ id: skill.id, name: skill.name, scope: skill.scope, requirement: row.requirement }];
      }),
      createdAt: record.createdAt.toISOString(),
      lastActivityAt: record.lastActivityAt.toISOString(),
      ghostSuggested: isGhostSuggested(record, now),
    }));
  }

  /** The application of this user with its posting, skills and timeline (APP-18); anything else is `404` (APP-19). */
  async get(userId: string, id: string): Promise<ApplicationDetail> {
    return this.detailOf(userId, id);
  }

  /**
   * Changes only the posting fields sent; `null` clears an optional one. The search text follows the company
   * and the title, and `last_activity_at` stays as it is (APP-28, APP-29).
   */
  async updatePosting(userId: string, id: string, request: UpdateJobPostingRequest): Promise<ApplicationDetail> {
    const record = isUuid(id) ? await this.repository.findOwned(userId, id) : undefined;
    if (record === undefined) throw new ApplicationNotFoundError();
    const searchText =
      request.company === undefined && request.title === undefined
        ? undefined
        : searchTextOf(request.company ?? record.company, request.title ?? record.title);
    await this.repository.updatePosting(userId, record.jobPostingId, { ...request, searchText });
    this.record('application.posting_updated', record.id, userId);
    return this.detailOf(userId, record.id);
  }

  /**
   * Moves the application to any status from any status and records it on the timeline with the status it left
   * and the one it reached (APP-20, APP-21). The row is locked while it is read and written, so two changes at
   * once run one after the other and each event names the status it really found (APP-27). The same status again
   * writes nothing and leaves the activity as it was (APP-22).
   */
  async changeStatus(userId: string, id: string, request: ChangeStatusRequest): Promise<ApplicationDetail> {
    if (!isUuid(id)) throw new ApplicationNotFoundError();
    const changed = await this.repository.transaction(async (tx) => {
      const record = await this.repository.findOwned(userId, id, tx, { forUpdate: true });
      if (record === undefined) throw new ApplicationNotFoundError();
      if (record.status === request.status) return false;
      const now = this.clock.now();
      await this.repository.setStatus(tx, record.id, request.status);
      await this.repository.insertEvent(tx, {
        applicationId: record.id,
        kind: 'status_changed',
        fromStatus: record.status,
        toStatus: request.status,
        note: request.note,
        occurredAt: now,
        createdAt: now,
      });
      return true;
    });
    if (changed) this.record('application.status_changed', id, userId);
    return this.detailOf(userId, id);
  }

  /**
   * Appends a stage or a note dated `occurredAt` (now when absent) to the timeline. A date more than 5 minutes
   * ahead of the clock is refused; the activity becomes the later of its value and the event date (APP-23..APP-25).
   */
  async addEvent(userId: string, id: string, request: CreateEventRequest): Promise<ApplicationEvent> {
    if (!isUuid(id)) throw new ApplicationNotFoundError();
    const now = this.clock.now();
    const occurredAt = request.occurredAt === undefined ? now : new Date(request.occurredAt);
    const record = await this.repository.findOwned(userId, id);
    if (record === undefined) throw new ApplicationNotFoundError();
    if (occurredAt.getTime() > now.getTime() + EVENT_FUTURE_TOLERANCE_MS) throw new EventInFutureError();
    const event = await this.repository.transaction((tx) =>
      this.repository.insertEvent(tx, {
        applicationId: record.id,
        kind: request.kind,
        stage: request.kind === 'stage' ? request.stage : undefined,
        note: request.note,
        occurredAt,
        createdAt: now,
      }),
    );
    this.record('application.event_added', record.id, userId);
    return toEvent(event);
  }

  /**
   * "Ainda não" on the ghost suggestion: hides it for 21 days from now. It writes no event and the activity
   * stays as it was, so the suggestion comes back by itself when the snooze ends (APP-35, AD-020).
   */
  async snoozeGhost(userId: string, id: string): Promise<ApplicationDetail> {
    const record = isUuid(id) ? await this.repository.findOwned(userId, id) : undefined;
    if (record === undefined) throw new ApplicationNotFoundError();
    await this.repository.snooze(userId, record.id, new Date(this.clock.now().getTime() + GHOST_SNOOZE_MS));
    this.record('application.ghost_snoozed', record.id, userId);
    return this.detailOf(userId, record.id);
  }

  /** The skill ids as stored: a uuid in lowercase, anything else untouched so it is refused as sent. */
  private normalized(skills: ReplaceSkillsRequest): ReplaceSkillsRequest {
    return skills.map((skill) => ({ ...skill, skillId: isUuid(skill.skillId) ? skill.skillId.toLowerCase() : skill.skillId }));
  }

  /**
   * Replaces every skill of the posting with the list sent, in the order sent, in one transaction. A skill the
   * member cannot use refuses the whole request and nothing changes; the activity does not move (APP-30, APP-31).
   */
  async replaceSkills(userId: string, id: string, request: ReplaceSkillsRequest): Promise<ApplicationDetail> {
    const record = isUuid(id) ? await this.repository.findOwned(userId, id) : undefined;
    if (record === undefined) throw new ApplicationNotFoundError();
    const skills = this.normalized(request);
    const invalid = await this.invalidSkillIds(
      userId,
      skills.map((skill) => skill.skillId),
    );
    if (invalid.length > 0) throw new InvalidSkillsError(invalid);
    await this.repository.transaction((tx) => this.repository.replaceSkills(tx, record.jobPostingId, skills));
    this.record('application.skills_replaced', record.id, userId);
    return this.detailOf(userId, record.id);
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
