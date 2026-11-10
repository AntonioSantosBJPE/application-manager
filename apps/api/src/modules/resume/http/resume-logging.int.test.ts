import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, type TestDatabase } from '../../../../test/database.js';
import { AppModule } from '../../../app.module.js';
import { createApp } from '../../../create-app.js';

/** Text a person types, easy to find in a log line: none of it may show up there (RES-33). */
const markers = {
  fullName: 'MARCADOR-NOME-7c1e',
  headline: 'MARCADOR-TITULO-7c1e',
  email: 'marcador-email-7c1e@exemplo.com',
  phone: 'MARCADOR-TELEFONE-7c1e',
  profileLocation: 'MARCADOR-LOCAL-PERFIL-7c1e',
  linkLabel: 'MARCADOR-ROTULO-7c1e',
  linkUrl: 'https://marcador-link-7c1e.exemplo.com/perfil',
  summary: 'MARCADOR-RESUMO-7c1e',
  role: 'MARCADOR-CARGO-7c1e',
  company: 'MARCADOR-EMPRESA-7c1e',
  experienceLocation: 'MARCADOR-LOCAL-EXPERIENCIA-7c1e',
  editedCompany: 'MARCADOR-EMPRESA-EDITADA-7c1e',
  projectName: 'MARCADOR-PROJETO-7c1e',
  projectUrl: 'https://marcador-projeto-7c1e.exemplo.com/',
  projectDescription: 'MARCADOR-DESCRICAO-7c1e',
  course: 'MARCADOR-CURSO-7c1e',
  institution: 'MARCADOR-INSTITUICAO-7c1e',
  certification: 'MARCADOR-CERTIFICACAO-7c1e',
  issuer: 'MARCADOR-EMISSOR-7c1e',
  certificationUrl: 'https://marcador-certificado-7c1e.exemplo.com/',
  language: 'MARCADOR-IDIOMA-7c1e',
  bullet: 'MARCADOR-BULLET-7c1e',
  secondBullet: 'MARCADOR-BULLET-DOIS-7c1e',
  editedBullet: 'MARCADOR-BULLET-EDITADO-7c1e',
};

describe('the resume log events', () => {
  let database: TestDatabase;
  let close: () => Promise<void>;
  let ana: TestAccount;
  const lines: string[] = [];
  const ids: Record<string, string> = {};

  const events = (): Array<Record<string, unknown>> =>
    lines.map((line) => JSON.parse(line) as Record<string, unknown>).filter((line) => typeof line.event === 'string');

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'res_logging');
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
    ana = await createAccount(database.url, baseUrl, 'ana.res.logging@example.com', 'member');
    const send = async (method: string, path: string, body?: unknown, expected = 200): Promise<{ id: string }> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...asAccount(ana) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(response.status, `${method} ${path}`).toBe(expected);
      const text = await response.text();
      return text === '' ? { id: '' } : (JSON.parse(text) as { id: string });
    };

    // Every write of the module, in the order a resume lives them, each with text a person would type.
    await send('PUT', '/resume/profile', {
      fullName: markers.fullName,
      headline: markers.headline,
      email: markers.email,
      phone: markers.phone,
      location: markers.profileLocation,
      links: [{ label: markers.linkLabel, url: markers.linkUrl }],
      summary: markers.summary,
      locale: 'pt-BR',
    });
    ids.experience = (
      await send('POST', '/resume/experiences', { role: markers.role, company: markers.company, location: markers.experienceLocation, startDate: '2021-03' }, 201)
    ).id;
    ids.secondExperience = (await send('POST', '/resume/experiences', { role: markers.role, company: markers.company, startDate: '2020-01' }, 201)).id;
    ids.project = (
      await send('POST', '/resume/projects', { name: markers.projectName, url: markers.projectUrl, description: markers.projectDescription }, 201)
    ).id;
    ids.education = (await send('POST', '/resume/educations', { course: markers.course, institution: markers.institution, startDate: '2015-02' }, 201)).id;
    ids.certification = (
      await send('POST', '/resume/certifications', { name: markers.certification, issuer: markers.issuer, url: markers.certificationUrl }, 201)
    ).id;
    ids.language = (await send('POST', '/resume/languages', { language: markers.language, level: 'advanced' }, 201)).id;
    await send('PATCH', `/resume/experiences/${ids.experience}`, { company: markers.editedCompany });
    await send('PUT', '/resume/experiences/order', { ids: [ids.experience, ids.secondExperience] });
    const bullet = await send('POST', `/resume/experiences/${ids.experience}/bullets`, { text: markers.bullet, skillIds: [] }, 201);
    ids.bullet = ((bullet as unknown as { bullet: { id: string } }).bullet).id;
    const second = await send('POST', `/resume/experiences/${ids.experience}/bullets`, { text: markers.secondBullet, skillIds: [] }, 201);
    ids.secondBullet = ((second as unknown as { bullet: { id: string } }).bullet).id;
    await send('PATCH', `/resume/experiences/${ids.experience}/bullets/${ids.bullet}`, { text: markers.editedBullet });
    await send('PUT', `/resume/experiences/${ids.experience}/bullets/order`, { ids: [ids.secondBullet, ids.bullet] });
    await send('DELETE', `/resume/experiences/${ids.experience}/bullets/${ids.bullet}`, undefined, 204);
    for (const [section, id] of [
      ['experiences', ids.secondExperience],
      ['projects', ids.project],
      ['educations', ids.education],
      ['certifications', ids.certification],
      ['languages', ids.language],
    ] as const) {
      await send('DELETE', `/resume/${section}/${id}`, undefined, 204);
    }
  }, 120_000);

  afterAll(async () => {
    await close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('RES-33 logs { event, resourceId, actorId } once for each write, with the id of the person who acted', () => {
    const expected: Array<[string, string]> = [
      ['resume.profile_saved', ana.id],
      ['resume.item_created', ids.experience!],
      ['resume.item_created', ids.secondExperience!],
      ['resume.item_created', ids.project!],
      ['resume.item_created', ids.education!],
      ['resume.item_created', ids.certification!],
      ['resume.item_created', ids.language!],
      ['resume.item_updated', ids.experience!],
      ['resume.items_ordered', ana.id],
      ['resume.bullet_created', ids.bullet!],
      ['resume.bullet_created', ids.secondBullet!],
      ['resume.bullet_updated', ids.bullet!],
      ['resume.bullets_ordered', ids.experience!],
      ['resume.bullet_deleted', ids.bullet!],
      ['resume.item_deleted', ids.secondExperience!],
      ['resume.item_deleted', ids.project!],
      ['resume.item_deleted', ids.education!],
      ['resume.item_deleted', ids.certification!],
      ['resume.item_deleted', ids.language!],
    ];

    expect(events().map((line) => [line.event, line.resourceId])).toEqual(expected);
    for (const line of events()) {
      expect(line, String(line.event)).toMatchObject({ actorId: ana.id, level: 'info' });
    }
  });

  it('RES-33 writes no name, e-mail, phone, location, link, summary, bullet text, description or URL in any log line, and none in the events', () => {
    // Control: the lines are the API's own, so they hold the requests and the ids the check looks for.
    expect(lines.some((line) => line.includes('"req"'))).toBe(true);
    expect(lines.some((line) => line.includes(ids.experience!))).toBe(true);
    for (const [field, value] of Object.entries(markers)) {
      expect(
        lines.filter((line) => line.includes(value)),
        `a log line holds the ${field}`,
      ).toEqual([]);
    }
    // An event holds the three fields and the logger's own, and nothing a person typed.
    for (const line of events()) {
      for (const field of ['fullName', 'name', 'email', 'phone', 'location', 'links', 'link', 'summary', 'text', 'description', 'url', 'company', 'role']) {
        expect(line, String(line.event)).not.toHaveProperty(field);
      }
    }
  });
});
