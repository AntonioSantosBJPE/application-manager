import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, type TestDatabase } from '../../../../test/database.js';
import { AppModule } from '../../../app.module.js';
import { createApp } from '../../../create-app.js';

/** Text a person types, easy to find in a log line: none of it may show up there (APP-41). */
const markers = {
  company: 'MARCADOR-EMPRESA-3f9a',
  title: 'MARCADOR-TITULO-3f9a',
  url: 'https://marcador-link-3f9a.exemplo.com/vaga',
  location: 'MARCADOR-LOCAL-3f9a',
  description: 'MARCADOR-DESCRICAO-3f9a',
  note: 'MARCADOR-NOTA-3f9a',
  editedCompany: 'MARCADOR-EMPRESA-EDITADA-3f9a',
  editedTitle: 'MARCADOR-TITULO-EDITADO-3f9a',
  editedUrl: 'https://marcador-link-editado-3f9a.exemplo.com/vaga',
  editedLocation: 'MARCADOR-LOCAL-EDITADO-3f9a',
  editedDescription: 'MARCADOR-DESCRICAO-EDITADA-3f9a',
  statusNote: 'MARCADOR-NOTA-STATUS-3f9a',
  stageNote: 'MARCADOR-NOTA-ETAPA-3f9a',
};

describe('the application log events', () => {
  let database: TestDatabase;
  let close: () => Promise<void>;
  let ana: TestAccount;
  const lines: string[] = [];
  let applicationId = '';

  const events = (): Array<Record<string, unknown>> =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>).filter((line) => typeof line.event === 'string');

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'app_logging');
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
    const baseUrl = await app.getUrl();
    close = () => app.close();
    ana = await createAccount(database.url, baseUrl, 'ana.app.logging@example.com', 'member');
    const send = (method: string, path: string, body?: unknown): Promise<Response> =>
      fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...asAccount(ana) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    // Every write of the module, in the order a posting lives them, each with text a person would type.
    const created = await send('POST', '/applications', {
      jobPosting: { company: markers.company, title: markers.title, url: markers.url, location: markers.location, description: markers.description, level: 'mid' },
    });
    expect(created.status).toBe(201);
    applicationId = ((await created.json()) as { id: string }).id;
    expect(
      (
        await send('PATCH', `/applications/${applicationId}/job-posting`, {
          company: markers.editedCompany,
          title: markers.editedTitle,
          url: markers.editedUrl,
          location: markers.editedLocation,
          description: markers.editedDescription,
        })
      ).status,
    ).toBe(200);
    expect((await send('PUT', `/applications/${applicationId}/skills`, [])).status).toBe(200);
    expect((await send('POST', `/applications/${applicationId}/status`, { status: 'applied', note: markers.statusNote })).status).toBe(200);
    expect((await send('POST', `/applications/${applicationId}/events`, { kind: 'stage', stage: 'hr', note: markers.stageNote })).status).toBe(201);
    expect((await send('POST', `/applications/${applicationId}/events`, { kind: 'note', note: markers.note })).status).toBe(201);
    expect((await send('POST', `/applications/${applicationId}/ghost-snooze`)).status).toBe(200);
    expect((await send('DELETE', `/applications/${applicationId}`)).status).toBe(204);
  }, 120_000);

  afterAll(async () => {
    await close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('APP-41 logs { event, applicationId, actorId } once for each write, with the id of the person who acted', () => {
    const expected = [
      'application.created',
      'application.posting_updated',
      'application.skills_replaced',
      'application.status_changed',
      'application.event_added',
      'application.event_added',
      'application.ghost_snoozed',
      'application.deleted',
    ];

    expect(events().map((line) => line.event)).toEqual(expected);
    for (const line of events()) {
      expect(line, String(line.event)).toMatchObject({ applicationId, actorId: ana.id, level: 'info' });
    }
  });

  it('APP-41 writes no company, title, link, location, description or note in any log line, and none in the events', () => {
    // Control: the lines are the API's own, so they hold the requests and the id the check looks for.
    expect(lines.some((line) => line.includes('"req"'))).toBe(true);
    expect(lines.some((line) => line.includes(applicationId))).toBe(true);
    for (const [field, value] of Object.entries(markers)) {
      expect(
        lines.filter((line) => line.includes(value)),
        `a log line holds the ${field}`,
      ).toEqual([]);
    }
    // An event holds the three fields and the logger's own, and nothing a person typed.
    for (const line of events()) {
      for (const field of ['company', 'title', 'url', 'link', 'location', 'description', 'note', 'name', 'email']) {
        expect(line, String(line.event)).not.toHaveProperty(field);
      }
    }
  });
});
