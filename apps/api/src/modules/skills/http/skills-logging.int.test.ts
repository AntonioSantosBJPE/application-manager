import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { AppModule } from '../../../app.module.js';
import { createApp } from '../../../create-app.js';

const SKILL_NAME = 'Skill Fictícia Alfa';
const ALIAS_TEXT = 'Alfa Fictícia';
const EDITED_ALIAS_TEXT = 'Alfa Fictícia Editada';
const RENAMED = 'Skill Fictícia Alfa Renomeada';

describe('the skills catalog log events', () => {
  let database: TestDatabase;
  let baseUrl: string;
  let close: () => Promise<void>;
  let admin: TestAccount;
  let ana: TestAccount;
  /** The real JSON lines the API wrote to its log destination. */
  const lines: string[] = [];
  const ids: Record<string, string> = {};

  const call = (method: string, path: string, account: TestAccount, body?: unknown): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...asAccount(account) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const events = (): Array<Record<string, unknown>> =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>).filter((line) => typeof line.event === 'string');

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_logging');
    let pending = '';
    const destination = new Writable({
      write(chunk: Buffer, _encoding, done) {
        pending += chunk.toString('utf8');
        const complete = pending.split('\n');
        pending = complete.pop() ?? '';
        lines.push(...complete.filter((line) => line.trim() !== ''));
        done();
      },
    });
    const app = await createApp(
      AppModule.forRoot(
        { databaseUrl: database.url, webPublicUrl: 'http://localhost:3000', sessionCookieSecure: false, port: 0, logLevel: 'info' },
        { logDestination: destination },
      ),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    close = () => app.close();
    admin = await createAccount(database.url, baseUrl, 'admin.logging@example.com', 'admin');
    ana = await createAccount(database.url, baseUrl, 'ana.logging@example.com', 'member');

    // The six operations, in the order a catalog lives them.
    const created = await call('POST', '/skills', ana, { name: SKILL_NAME, category: 'tool' });
    expect(created.status).toBe(201);
    ids.skill = ((await created.json()) as { id: string }).id;
    expect((await call('POST', `/skills/${ids.skill}/promote`, admin)).status).toBe(200);
    expect((await call('PATCH', `/skills/${ids.skill}`, admin, { name: RENAMED })).status).toBe(200);
    const alias = await call('POST', `/skills/${ids.skill}/aliases`, admin, { alias: ALIAS_TEXT });
    expect(alias.status).toBe(201);
    ids.alias = ((await alias.json()) as { id: string }).id;
    expect((await call('PATCH', `/skills/${ids.skill}/aliases/${ids.alias}`, admin, { alias: EDITED_ALIAS_TEXT })).status).toBe(200);
    expect((await call('DELETE', `/skills/${ids.skill}/aliases/${ids.alias}`, admin)).status).toBe(204);
  }, 120_000);

  afterAll(async () => {
    await close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-60 logs { event, skillId, actorId } once for each of the six operations, with the id of the person who acted', () => {
    const expected: Array<[string, string]> = [
      ['skill.created', ana.id],
      ['skill.promoted', admin.id],
      ['skill.updated', admin.id],
      ['skill.alias_created', admin.id],
      ['skill.alias_updated', admin.id],
      ['skill.alias_removed', admin.id],
    ];

    expect(events().map((line) => line.event)).toEqual(expected.map(([event]) => event));
    for (const [event, actorId] of expected) {
      const line = events().find((candidate) => candidate.event === event);
      expect(line, event).toMatchObject({ event, skillId: ids.skill, actorId, level: 'info' });
    }
  });

  it('SKL-61 writes no e-mail, session token, cookie or skill name in any log line, and none in the events', async () => {
    const forbidden = [
      admin.email,
      ana.email,
      admin.token,
      ana.token,
      `am_session=${admin.token}`,
      `am_session=${ana.token}`,
      SKILL_NAME,
      RENAMED,
      ALIAS_TEXT,
      EDITED_ALIAS_TEXT,
    ];

    // Control: the lines are the API's own, so they hold requests and the ids the check looks for.
    expect(lines.some((line) => line.includes('"req"'))).toBe(true);
    expect(lines.some((line) => line.includes(ids.skill!))).toBe(true);
    for (const value of forbidden) {
      expect(
        lines.filter((line) => line.includes(value)),
        `a log line holds ${value === admin.token || value === ana.token ? 'a session token' : value}`,
      ).toEqual([]);
    }
    // The sessions exist for real: the tokens and cookies searched for are the ones that signed the calls.
    expect(await query(database.url, 'select count(*)::int as sessions from identity.sessions')).toEqual([{ sessions: 2 }]);
    // An event holds no field for any of them, besides the logger's own.
    for (const line of events()) {
      for (const field of ['name', 'email', 'alias', 'cookie', 'token']) expect(line, String(line.event)).not.toHaveProperty(field);
    }
  });
});
