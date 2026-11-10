import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../infra/database/database.module.js';
import { fromMonthDate } from '../domain/months.js';
import { bullets, certifications, educations, experiences, languages, profiles, projects } from './schema.js';

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
}
