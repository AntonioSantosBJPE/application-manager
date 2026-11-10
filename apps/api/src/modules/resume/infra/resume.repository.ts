import type { ResumeSection } from '@am/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, exists, ne, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import { fromMonthDate } from '../domain/months.js';
import { toItem, toRowValues } from '../domain/sections.js';
import { bullets, certifications, educations, experiences, languages, profiles, projects } from './schema.js';

/** What a write runs on: the database or a transaction of it, so the rows of one request commit together. */
export type DatabaseExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

/**
 * The table of each section. The five tables share `id`, `user_id` and `position`, which is all the generic
 * statements below touch, so they are handled as one type and the values written are checked by the contract.
 */
const SECTION_TABLES = { experiences, projects, educations, certifications, languages } as const;
const tableOf = (section: ResumeSection): typeof experiences => SECTION_TABLES[section] as unknown as typeof experiences;

export interface ProfileRecord {
  fullName: string;
  headline: string;
  email: string;
  phone: string | null;
  location: string | null;
  links: { label: string; url: string }[];
  summary: string;
  locale: 'pt-BR';
}

export interface BulletRecord {
  id: string;
  text: string;
  skillIds: string[];
  experienceId: string | null;
  projectId: string | null;
}

/** Everything the member wrote, each list already in the order saved, dates already as `YYYY-MM` (RES-02). */
export interface ResumeRecord {
  profile: ProfileRecord | undefined;
  experiences: { id: string; role: string; company: string; location: string | null; startDate: string; endDate: string | null }[];
  projects: { id: string; name: string; url: string | null; description: string | null }[];
  educations: { id: string; course: string; institution: string; startDate: string; endDate: string | null }[];
  certifications: { id: string; name: string; issuer: string | null; issuedOn: string | null; url: string | null }[];
  languages: { id: string; language: string; level: 'basic' | 'intermediate' | 'advanced' | 'fluent' | 'native' }[];
  bullets: BulletRecord[];
}

/**
 * SQL for the `resume` schema. Whether a request is allowed is decided by the service; this class only
 * reads and writes rows, and every read filters by the owner (RES-28).
 */
@Injectable()
export class ResumeRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** The whole resume of one user: the profile, the five sections and the bullets, each list `order by position, id`. */
  async readAll(userId: string): Promise<ResumeRecord> {
    const [profile, experienceRows, projectRows, educationRows, certificationRows, languageRows, bulletRows] = await Promise.all([
      this.db.select().from(profiles).where(eq(profiles.userId, userId)),
      this.db.select().from(experiences).where(eq(experiences.userId, userId)).orderBy(asc(experiences.position), asc(experiences.id)),
      this.db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.position), asc(projects.id)),
      this.db.select().from(educations).where(eq(educations.userId, userId)).orderBy(asc(educations.position), asc(educations.id)),
      this.db.select().from(certifications).where(eq(certifications.userId, userId)).orderBy(asc(certifications.position), asc(certifications.id)),
      this.db.select().from(languages).where(eq(languages.userId, userId)).orderBy(asc(languages.position), asc(languages.id)),
      this.db.select().from(bullets).where(eq(bullets.userId, userId)).orderBy(asc(bullets.position), asc(bullets.id)),
    ]);
    const row = profile[0];
    return {
      profile:
        row === undefined
          ? undefined
          : {
              fullName: row.fullName,
              headline: row.headline,
              email: row.email,
              phone: row.phone,
              location: row.location,
              links: row.links,
              summary: row.summary,
              locale: 'pt-BR',
            },
      experiences: experienceRows.map(({ id, role, company, location, startDate, endDate }) => ({
        id,
        role,
        company,
        location,
        startDate: fromMonthDate(startDate),
        endDate: endDate === null ? null : fromMonthDate(endDate),
      })),
      projects: projectRows.map(({ id, name, url, description }) => ({ id, name, url, description })),
      educations: educationRows.map(({ id, course, institution, startDate, endDate }) => ({
        id,
        course,
        institution,
        startDate: fromMonthDate(startDate),
        endDate: endDate === null ? null : fromMonthDate(endDate),
      })),
      certifications: certificationRows.map(({ id, name, issuer, issuedOn, url }) => ({
        id,
        name,
        issuer,
        issuedOn: issuedOn === null ? null : fromMonthDate(issuedOn),
        url,
      })),
      languages: languageRows.map(({ id, language, level }) => ({ id, language, level })),
      bullets: bulletRows.map(({ id, text, skillIds, experienceId, projectId }) => ({ id, text, skillIds, experienceId, projectId })),
    };
  }

  /** One profile per user: the first save inserts, the next ones update the same row (RES-03, RES-06). */
  async upsertProfile(userId: string, profile: ProfileRecord, now: Date): Promise<ProfileRecord> {
    const values = { ...profile, updatedAt: now };
    const [row] = await this.db
      .insert(profiles)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: profiles.userId, set: values })
      .returning();
    const { fullName, headline, email, phone, location, links, summary } = row!;
    return { fullName, headline, email, phone, location, links, summary, locale: 'pt-BR' };
  }

  /**
   * Whether the master resume is ready: a profile with a name and a bullet with at least one skill, in one
   * query with two `EXISTS`, so no resume row leaves the database (RES-86).
   */
  async isReady(userId: string): Promise<boolean> {
    const named = this.db
      .select({ one: sql`1` })
      .from(profiles)
      .where(and(eq(profiles.userId, userId), ne(profiles.fullName, '')));
    const tagged = this.db
      .select({ one: sql`1` })
      .from(bullets)
      .where(and(eq(bullets.userId, userId), sql`cardinality(${bullets.skillIds}) > 0`));
    const [row] = await this.db.select({ ready: sql<boolean>`${exists(named)} and ${exists(tagged)}` }).from(sql`(select 1) as one`);
    return row!.ready;
  }

  /** A transaction handle, so a limit check and the write it guards are one step. */
  transaction<T>(run: (tx: DatabaseExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(run);
  }

  /**
   * One lock per user, held until the transaction ends: two creations or an order and a creation of the same
   * person run one after the other, so a limit or an exact order is checked against what the other left (RES-13).
   */
  async lockUser(tx: DatabaseExecutor, userId: string): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`resume:${userId}`}))`);
  }

  async countItems(tx: DatabaseExecutor, section: ResumeSection, userId: string): Promise<number> {
    const table = tableOf(section);
    const [row] = await tx.select({ total: sql<number>`count(*)::int` }).from(table).where(eq(table.userId, userId));
    return row!.total;
  }

  /** The new item goes on top without renumbering the others: one before the smallest position, or 0 in an empty section (RES-07). */
  async insertItem(tx: DatabaseExecutor, section: ResumeSection, userId: string, values: Record<string, unknown>): Promise<Record<string, unknown>> {
    const table = tableOf(section);
    const [row] = await tx
      .insert(table)
      .values({
        ...(toRowValues(values) as typeof table.$inferInsert),
        userId,
        position: sql`(select coalesce(min(${table.position}), 1) - 1 from ${table} where ${table.userId} = ${userId})`,
      })
      .returning();
    return toItem(row!);
  }
}
