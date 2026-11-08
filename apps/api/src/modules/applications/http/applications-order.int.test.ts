import { applicationsCountSchema, applicationsPageSchema, type ApplicationStatus, type ApplicationSummary } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccount } from '../../../../test/accounts.js';
import { call, seedApplications, startApplicationsEnv, type ApplicationsEnv } from '../../../../test/applications.js';

const FUNNEL: ApplicationStatus[] = ['offer', 'interviewing', 'applied', 'saved', 'accepted', 'rejected', 'withdrawn', 'ghosted'];
const ACTIVE: ApplicationStatus[] = ['offer', 'interviewing', 'applied', 'saved'];
const LEVELS = ['intern', 'junior', 'mid', 'senior', 'specialist'];
const WORK_MODELS = ['remote', 'hybrid', null];
const pad = (value: number) => String(value).padStart(2, '0');

interface Row {
  id: string;
  status: ApplicationStatus;
  level: string;
  workModel: string | null;
  title: string;
  lastActivityAt: string;
  createdAt: string;
}

/** The order the spec asks for, worked out from the rows and not from the API: funnel group, then the date, then the id, the latest first. */
function expectedOrder(rows: Row[], key: 'lastActivityAt' | 'createdAt'): string[] {
  return [...rows]
    .sort(
      (a, b) =>
        FUNNEL.indexOf(a.status) - FUNNEL.indexOf(b.status) || (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0) || (a.id < b.id ? 1 : -1),
    )
    .map((row) => row.id);
}

function expectedCounts(rows: Row[]) {
  const byStatus = Object.fromEntries(FUNNEL.map((status) => [status, rows.filter((row) => row.status === status).length]));
  const active = rows.filter((row) => ACTIVE.includes(row.status)).length;
  return { active, closed: rows.length - active, byStatus };
}

describe('GET /applications: order, cursor and counters', () => {
  let env: ApplicationsEnv & { close: () => Promise<void> };
  let rows: Row[];
  let tied: string[];
  let lots: string[];

  const page = async (account: ApplicationsEnv['ana'], search: string) => {
    const response = await call(env, account, 'GET', `/applications${search}`);
    expect(response.status, search).toBe(200);
    return applicationsPageSchema.parse(await response.json());
  };
  /** Follows `nextCursor` until it is null and answers every page. */
  const allPages = async (account: ApplicationsEnv['ana'], search: string) => {
    const pages = [await page(account, search)];
    while (pages.at(-1)!.nextCursor !== null) {
      pages.push(await page(account, `${search}${search === '' ? '?' : '&'}cursor=${encodeURIComponent(pages.at(-1)!.nextCursor!)}`));
    }
    return pages;
  };
  const idsOf = (items: ApplicationSummary[]) => items.map((item) => item.id);

  beforeAll(async () => {
    env = await startApplicationsEnv('app_order');
    // Ana: 120 applications, 15 in each status, with dates that repeat so that ties are everywhere.
    const seeds = Array.from({ length: 120 }, (_, index) => ({
      userId: env.ana.id,
      company: `Empresa Fictícia ${index}`,
      title: index % 2 === 0 ? 'Vaga Alfa' : 'Vaga Beta',
      level: LEVELS[index % 5]!,
      workModel: WORK_MODELS[index % 3] ?? null,
      status: FUNNEL[index % 8]!,
      lastActivityAt: `2026-10-${pad(1 + (index % 6))}T12:00:00.000Z`,
      createdAt: `2026-09-${pad(1 + (index % 9))}T08:00:00.000Z`,
    }));
    const ids = await seedApplications(env.databaseUrl, seeds);
    rows = seeds.map((seed, index) => ({
      id: ids[index]!,
      status: seed.status,
      level: seed.level,
      workModel: seed.workModel,
      title: seed.title,
      lastActivityAt: seed.lastActivityAt,
      createdAt: seed.createdAt,
    }));
    // Bruno: 60 saved applications with the very same dates, 50 titled "lote a" and 10 "lote b".
    tied = await seedApplications(
      env.databaseUrl,
      Array.from({ length: 60 }, (_, index) => ({
        userId: env.bruno.id,
        company: `Massa Fictícia ${index}`,
        title: index < 50 ? 'Vaga lote a' : 'Vaga lote b',
        status: 'saved',
        createdAt: '2026-10-10T10:00:00.000Z',
        lastActivityAt: '2026-10-10T10:00:00.000Z',
      })),
    );
    lots = tied.slice(0, 50);
  }, 180_000);

  afterAll(async () => {
    await env.close();
  });

  it('APP-14 orders the active tab by funnel group (offer, interviewing, applied, saved) and inside a group by lastActivityAt, the latest first', async () => {
    const pages = await allPages(env.ana, '');
    const items = pages.flatMap((p) => p.items);
    const active = rows.filter((row) => ACTIVE.includes(row.status));

    expect(idsOf(items)).toEqual(expectedOrder(active, 'lastActivityAt'));
    expect(items.map((item) => item.status).filter((status, index, all) => status !== all[index - 1])).toEqual(ACTIVE);
  });

  it('APP-14 orders the closed tab accepted, rejected, withdrawn, ghosted', async () => {
    const items = (await allPages(env.ana, '?tab=closed')).flatMap((p) => p.items);
    const closed = rows.filter((row) => !ACTIVE.includes(row.status));

    expect(idsOf(items)).toEqual(expectedOrder(closed, 'lastActivityAt'));
    expect(items.map((item) => item.status).filter((status, index, all) => status !== all[index - 1])).toEqual(['accepted', 'rejected', 'withdrawn', 'ghosted']);
  });

  it('APP-14 orders by createdAt, the latest first, inside each group with sort=created', async () => {
    const items = (await allPages(env.ana, '?sort=created')).flatMap((p) => p.items);
    const active = rows.filter((row) => ACTIVE.includes(row.status));

    expect(idsOf(items)).toEqual(expectedOrder(active, 'createdAt'));
    expect(idsOf(items)).not.toEqual(expectedOrder(active, 'lastActivityAt'));
    expect(idsOf((await page(env.ana, '?sort=activity')).items)).toEqual(idsOf((await page(env.ana, '')).items));
  });

  it('APP-14 breaks the ties of one date by id, so the order is the same on every request', async () => {
    const first = idsOf((await page(env.bruno, '')).items);
    const second = idsOf((await page(env.bruno, '')).items);

    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort().reverse());
  });

  it('APP-15 gives a cursor on the first page of 60 applications and the next 10 on the second, with no repeat and no gap', async () => {
    const pages = await allPages(env.ana, '');
    const active = rows.filter((row) => ACTIVE.includes(row.status));

    expect(pages.map((p) => p.items.length)).toEqual([50, 10]);
    expect(pages[0]!.nextCursor).toEqual(expect.any(String));
    expect(pages[1]!.nextCursor).toBeNull();
    const seen = pages.flatMap((p) => idsOf(p.items));
    expect(new Set(seen).size).toBe(60);
    expect([...seen].sort()).toEqual(active.map((row) => row.id).sort());
  });

  it('APP-15 pages 60 applications that share the same status and the same dates without repeating or skipping one', async () => {
    const pages = await allPages(env.bruno, '');
    const seen = pages.flatMap((p) => idsOf(p.items));

    expect(pages.map((p) => p.items.length)).toEqual([50, 10]);
    expect(new Set(seen).size).toBe(60);
    expect([...seen].sort()).toEqual([...tied].sort());
  });

  it('APP-15 pages the sort=created order the same way', async () => {
    const pages = await allPages(env.ana, '?sort=created');
    const active = rows.filter((row) => ACTIVE.includes(row.status));

    expect(pages.map((p) => p.items.length)).toEqual([50, 10]);
    expect(pages.flatMap((p) => idsOf(p.items))).toEqual(expectedOrder(active, 'createdAt'));
  });

  it('APP-15 answers a null cursor when the page holds exactly 50 applications and none is left', async () => {
    const body = await page(env.bruno, '?q=lote%20a');

    expect(body.items).toHaveLength(50);
    expect(body.nextCursor).toBeNull();
    expect([...idsOf(body.items)].sort()).toEqual([...lots].sort());
  });

  it('APP-16 counts active, closed and each status of the account, 15 in each status', async () => {
    const body = await page(env.ana, '');

    expect(body.counts).toEqual(expectedCounts(rows));
    expect(body.counts).toEqual({
      active: 60,
      closed: 60,
      byStatus: { offer: 15, interviewing: 15, applied: 15, saved: 15, accepted: 15, rejected: 15, withdrawn: 15, ghosted: 15 },
    });
  });

  it('APP-16 ignores the tab, the status and the cursor', async () => {
    const all = expectedCounts(rows);
    const first = await page(env.ana, '');

    expect((await page(env.ana, '?tab=closed')).counts).toEqual(all);
    expect((await page(env.ana, '?status=applied')).counts).toEqual(all);
    expect((await page(env.ana, '?tab=closed&status=accepted,ghosted')).counts).toEqual(all);
    expect((await page(env.ana, `?cursor=${encodeURIComponent(first.nextCursor!)}`)).counts).toEqual(all);
  });

  it('APP-16 respects level, workModel and q', async () => {
    const byLevel = rows.filter((row) => ['junior', 'mid'].includes(row.level));
    const byModel = rows.filter((row) => row.workModel === 'remote');
    const bySearch = rows.filter((row) => row.title === 'Vaga Alfa');
    const combined = rows.filter((row) => row.level === 'senior' && row.workModel === 'hybrid' && row.title === 'Vaga Beta');

    expect((await page(env.ana, '?level=junior,mid')).counts).toEqual(expectedCounts(byLevel));
    expect((await page(env.ana, '?workModel=remote&tab=closed')).counts).toEqual(expectedCounts(byModel));
    expect((await page(env.ana, '?q=alfa')).counts).toEqual(expectedCounts(bySearch));
    expect((await page(env.ana, '?level=senior&workModel=hybrid&q=BETA&status=saved')).counts).toEqual(expectedCounts(combined));
    expect(expectedCounts(combined).active + expectedCounts(combined).closed).toBeGreaterThan(0);
    expect((await page(env.ana, '?q=zzzsemresultado')).counts).toEqual(expectedCounts([]));
  });

  it('APP-16 counts only the applications of the session account', async () => {
    expect((await page(env.bruno, '')).counts).toEqual({
      active: 60,
      closed: 0,
      byStatus: { offer: 0, interviewing: 0, applied: 0, saved: 60, accepted: 0, rejected: 0, withdrawn: 0, ghosted: 0 },
    });
  });

  it('APP-43 answers the total of applications of the session account on GET /applications/count, whatever the status', async () => {
    const ana = await call(env, env.ana, 'GET', '/applications/count');
    const bruno = await call(env, env.bruno, 'GET', '/applications/count');

    expect(ana.status).toBe(200);
    expect(applicationsCountSchema.parse(await ana.json())).toEqual({ total: 120 });
    expect(applicationsCountSchema.parse(await bruno.json())).toEqual({ total: 60 });
  });

  it('APP-43 answers a total of 0 for a member with no application', async () => {
    const carla = await createAccount(env.databaseUrl, env.api.baseUrl, 'carla.app_order@example.com', 'member');

    const response = await call(env, carla, 'GET', '/applications/count');

    expect(response.status).toBe(200);
    expect(applicationsCountSchema.parse(await response.json())).toEqual({ total: 0 });
  });
});
