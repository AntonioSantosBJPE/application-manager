import { randomUUID } from 'node:crypto';
import { call, startApplicationsEnv, withApplicationsEnv, type ApplicationsEnv } from './applications.js';
import { query } from './database.js';

/** The environment of an integration test of `/resume`: the same real API, two members and an admin as `/applications` uses. */
export type ResumeEnv = ApplicationsEnv;
export { call, startApplicationsEnv as startResumeEnv, withApplicationsEnv as withResumeEnv };

export interface SeedExperience {
  userId: string;
  role?: string;
  company?: string;
  startDate?: string;
  endDate?: string | null;
  position?: number;
}

/** Writes an experience straight into the database, so a test can set positions and dates the API would not. Answers its id. */
export async function seedExperience(databaseUrl: string, row: SeedExperience): Promise<string> {
  const id = randomUUID();
  await query(
    databaseUrl,
    `insert into resume.experiences (id, user_id, role, company, start_date, end_date, position)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      row.userId,
      row.role ?? 'Desenvolvedora',
      row.company ?? 'Empresa Fictícia Alfa',
      row.startDate ?? '2021-01-01',
      row.endDate ?? null,
      row.position ?? 0,
    ],
  );
  return id;
}

/** The number of rows in each table of the `resume` schema, to prove that a request wrote nothing. */
export async function resumeRowCounts(databaseUrl: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of ['profiles', 'experiences', 'projects', 'educations', 'certifications', 'languages', 'bullets']) {
    counts[table] = Number((await query<{ count: string }>(databaseUrl, `select count(*) from resume.${table}`))[0]!.count);
  }
  return counts;
}

/** Writes a profile row straight into the database, with only the fields a test cares about. */
export async function seedProfile(databaseUrl: string, userId: string, fullName: string): Promise<void> {
  await query(databaseUrl, 'insert into resume.profiles (user_id, full_name, updated_at) values ($1, $2, now())', [userId, fullName]);
}

/** Writes a bullet of an experience with the skill ids given (any uuid: the schema holds no foreign key to skills). Answers its id. */
export async function seedBullet(
  databaseUrl: string,
  row: { userId: string; experienceId: string; text?: string; skillIds?: string[]; position?: number },
): Promise<string> {
  const id = randomUUID();
  await query(
    databaseUrl,
    'insert into resume.bullets (id, user_id, experience_id, text, skill_ids, position) values ($1, $2, $3, $4, $5, $6)',
    [id, row.userId, row.experienceId, row.text ?? 'Texto fictício do bullet.', row.skillIds ?? [], row.position ?? 0],
  );
  return id;
}
