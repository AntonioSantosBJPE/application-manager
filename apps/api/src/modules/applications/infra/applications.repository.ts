import type { ApplicationStatus, JobLevel, SkillRequirement, Stage, WorkModel } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
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
}
