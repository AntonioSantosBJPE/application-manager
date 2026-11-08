import { FUNNEL_ORDER, type ApplicationsSort, type ApplicationStatus, type JobLevel, type SkillRequirement, type Stage, type WorkModel } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, exists, inArray, like, or, sql, type SQL } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import type { ApplicationCursor } from '../domain/cursor.js';
import { applicationEvents, applications, jobPostings, jobPostingSkills } from './schema.js';

/** What a write runs on: the database or a transaction of it, so the rows of one request commit together. */
export type DatabaseExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

export interface PostingValues {
  company: string;
  title: string;
  url: string | null;
  description: string | null;
  level: JobLevel;
  location: string | null;
  workModel: WorkModel | null;
}

export interface ApplicationRecord extends PostingValues {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  lastActivityAt: Date;
  ghostSnoozedUntil: Date | null;
  jobPostingId: string;
}

export interface PostingSkillRow {
  skillId: string;
  requirement: SkillRequirement;
}

export interface EventRecord {
  id: string;
  kind: 'status_changed' | 'stage' | 'note';
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus | null;
  stage: Stage | null;
  note: string | null;
  occurredAt: Date;
}

export interface NewApplication {
  userId: string;
  posting: PostingValues & { searchText: string };
  skills: PostingSkillRow[];
  status: ApplicationStatus;
  now: Date;
}

/**
 * What narrows the list: each list is an OR inside and the parameters are ANDed (APP-12). `search` is the
 * `LIKE` pattern of the text and the ids of the skills whose name or alias holds the key (APP-13).
 */
export interface ListFilters {
  /** The statuses of the tab; left out when the count ignores the tab (APP-16). */
  statuses?: ApplicationStatus[];
  level?: JobLevel[];
  workModel?: WorkModel[];
  search?: { pattern: string; skillIds: string[] };
}

/** The position of the status in the funnel as a SQL number, so the order and the cursor run in the database (APP-14). */
const funnelRank = sql<number>`(case ${applications.status} ${sql.raw(FUNNEL_ORDER.map((status, rank) => `when '${status}' then ${rank}`).join(' '))} end)`;

/**
 * SQL for `applications.*`. Whether a request is allowed is decided by the service; this class only
 * reads and writes rows, and every read of an application filters by the owner (Key decision 1).
 */
@Injectable()
export class ApplicationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** A transaction handle, so the posting, its skills, the application and its first event are one step. */
  transaction<T>(run: (tx: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(run);
  }

  /**
   * Writes the posting, its skills (with their `position`), the application and, when it does not
   * start as `saved`, the `status_changed` event without `from_status`, whose date is the creation
   * date (APP-01, APP-02). Answers the id of the application.
   */
  async insert(tx: DatabaseExecutor, input: NewApplication): Promise<string> {
    const [posting] = await tx
      .insert(jobPostings)
      .values({ userId: input.userId, ...input.posting, createdAt: input.now })
      .returning({ id: jobPostings.id });
    if (input.skills.length > 0) {
      await tx
        .insert(jobPostingSkills)
        .values(input.skills.map((skill, position) => ({ jobPostingId: posting!.id, ...skill, position })));
    }
    const [application] = await tx
      .insert(applications)
      .values({
        userId: input.userId,
        jobPostingId: posting!.id,
        status: input.status,
        lastActivityAt: input.now,
        createdAt: input.now,
      })
      .returning({ id: applications.id });
    if (input.status !== 'saved') {
      await tx.insert(applicationEvents).values({
        applicationId: application!.id,
        kind: 'status_changed',
        toStatus: input.status,
        occurredAt: input.now,
        createdAt: input.now,
      });
    }
    return application!.id;
  }

  /** The application of this user with its posting, or `undefined` when it does not exist or is somebody else's (APP-19). */
  async findOwned(userId: string, id: string, executor: DatabaseExecutor = this.db): Promise<ApplicationRecord | undefined> {
    const [row] = await executor
      .select({
        id: applications.id,
        status: applications.status,
        createdAt: applications.createdAt,
        lastActivityAt: applications.lastActivityAt,
        ghostSnoozedUntil: applications.ghostSnoozedUntil,
        jobPostingId: applications.jobPostingId,
        company: jobPostings.company,
        title: jobPostings.title,
        url: jobPostings.url,
        description: jobPostings.description,
        level: jobPostings.level,
        location: jobPostings.location,
        workModel: jobPostings.workModel,
      })
      .from(applications)
      .innerJoin(jobPostings, eq(applications.jobPostingId, jobPostings.id))
      .where(and(eq(applications.id, id), eq(applications.userId, userId)))
      .limit(1);
    return row;
  }

  /** The skills of the postings, by posting id, each list in the order they were sent in. */
  async skillsOf(postingIds: string[], executor: DatabaseExecutor = this.db): Promise<Map<string, PostingSkillRow[]>> {
    const byPosting = new Map<string, PostingSkillRow[]>();
    if (postingIds.length === 0) return byPosting;
    const rows = await executor
      .select({ postingId: jobPostingSkills.jobPostingId, skillId: jobPostingSkills.skillId, requirement: jobPostingSkills.requirement })
      .from(jobPostingSkills)
      .where(inArray(jobPostingSkills.jobPostingId, postingIds))
      .orderBy(asc(jobPostingSkills.jobPostingId), asc(jobPostingSkills.position));
    for (const row of rows) {
      byPosting.set(row.postingId, [...(byPosting.get(row.postingId) ?? []), { skillId: row.skillId, requirement: row.requirement }]);
    }
    return byPosting;
  }

  /** The events of the application, the most recent first by `occurred_at`; a tie goes to the later created (APP-18). */
  async eventsOf(applicationId: string, executor: DatabaseExecutor = this.db): Promise<EventRecord[]> {
    return executor
      .select({
        id: applicationEvents.id,
        kind: applicationEvents.kind,
        fromStatus: applicationEvents.fromStatus,
        toStatus: applicationEvents.toStatus,
        stage: applicationEvents.stage,
        note: applicationEvents.note,
        occurredAt: applicationEvents.occurredAt,
      })
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, applicationId))
      .orderBy(desc(applicationEvents.occurredAt), desc(applicationEvents.createdAt), desc(applicationEvents.id));
  }

  /** The conditions of the owner and of the filters, over `applications` joined with `job_postings`. */
  private where(userId: string, filters: ListFilters): SQL | undefined {
    const { statuses, level, workModel, search } = filters;
    const matchesSkill =
      search === undefined || search.skillIds.length === 0
        ? undefined
        : exists(
            this.db
              .select({ one: sql`1` })
              .from(jobPostingSkills)
              .where(and(eq(jobPostingSkills.jobPostingId, jobPostings.id), inArray(jobPostingSkills.skillId, search.skillIds))),
          );
    return and(
      eq(applications.userId, userId),
      statuses === undefined ? undefined : inArray(applications.status, statuses),
      level === undefined ? undefined : inArray(jobPostings.level, level),
      workModel === undefined ? undefined : inArray(jobPostings.workModel, workModel),
      search === undefined ? undefined : or(like(jobPostings.searchText, search.pattern), matchesSkill),
    );
  }

  /**
   * One page of the member's applications: by status group in funnel order, inside a group the most
   * recent `last_activity_at` first (or `created_at` with `sort=created`), and an id breaks the ties, so
   * the order is total. A cursor continues after the row it names without repeating or skipping one (APP-14, APP-15).
   */
  async page(
    userId: string,
    filters: ListFilters,
    options: { sort: ApplicationsSort; cursor?: ApplicationCursor; limit: number },
  ): Promise<ApplicationRecord[]> {
    const dated = options.sort === 'created' ? applications.createdAt : applications.lastActivityAt;
    const { cursor } = options;
    const afterCursor =
      cursor === undefined
        ? undefined
        : sql`(${funnelRank} > ${cursor.rank}::int
            or (${funnelRank} = ${cursor.rank}::int
              and (${dated} < ${cursor.at.toISOString()}::timestamptz
                or (${dated} = ${cursor.at.toISOString()}::timestamptz and ${applications.id} < ${cursor.id}::uuid))))`;
    return this.db
      .select({
        id: applications.id,
        status: applications.status,
        createdAt: applications.createdAt,
        lastActivityAt: applications.lastActivityAt,
        ghostSnoozedUntil: applications.ghostSnoozedUntil,
        jobPostingId: applications.jobPostingId,
        company: jobPostings.company,
        title: jobPostings.title,
        url: jobPostings.url,
        description: jobPostings.description,
        level: jobPostings.level,
        location: jobPostings.location,
        workModel: jobPostings.workModel,
      })
      .from(applications)
      .innerJoin(jobPostings, eq(applications.jobPostingId, jobPostings.id))
      .where(and(this.where(userId, filters), afterCursor))
      .orderBy(asc(funnelRank), desc(dated), desc(applications.id))
      .limit(options.limit);
  }

  /** How many applications the member has, whatever the status (the total of the sidebar). */
  async countAll(userId: string): Promise<number> {
    const [row] = await this.db.select({ total: sql<string>`count(*)` }).from(applications).where(eq(applications.userId, userId));
    return Number(row?.total ?? 0);
  }

  /** How many applications of the member each status holds under the filters; a status with none is absent (APP-16). */
  async countByStatus(userId: string, filters: ListFilters): Promise<Map<ApplicationStatus, number>> {
    const rows = await this.db
      .select({ status: applications.status, total: sql<string>`count(*)` })
      .from(applications)
      .innerJoin(jobPostings, eq(applications.jobPostingId, jobPostings.id))
      .where(this.where(userId, filters))
      .groupBy(applications.status);
    return new Map(rows.map((row) => [row.status, Number(row.total)]));
  }
}
