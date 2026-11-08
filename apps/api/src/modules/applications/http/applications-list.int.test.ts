import { applicationsPageSchema, problemDetailsSchema, skillSchema, type ApplicationsPage } from '@am/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  call,
  seedApplication,
  startApplicationsEnv,
  type ApplicationsEnv,
} from '../../../../test/applications.js';
import { query } from '../../../../test/database.js';

describe('GET /applications: isolation and filters', () => {
  let env: ApplicationsEnv & { close: () => Promise<void> };
  const ids: Record<string, string> = {};
  const skill: Record<string, string> = {};
  let anaPrivateId: string;

  const list = async (account: ApplicationsEnv['ana'], search = ''): Promise<ApplicationsPage> => {
    const response = await call(env, account, 'GET', `/applications${search}`);
    expect(response.status, search).toBe(200);
    return applicationsPageSchema.parse(await response.json());
  };
  /** The company of each item, sorted: the filters are judged by which applications come back, not by their order. */
  const companies = async (account: ApplicationsEnv['ana'], search = ''): Promise<string[]> =>
    (await list(account, search)).items.map((item) => item.company).sort();

  beforeAll(async () => {
    env = await startApplicationsEnv('app_list');
    const globalId = async (key: string): Promise<string> =>
      (await query<{ id: string }>(env.databaseUrl, 'select id from skills.skills where normalized_key = $1 and owner_user_id is null', [key]))[0]!.id;
    for (const key of ['nodejs', 'react', 'python', 'postgresql', 'typescript']) skill[key] = await globalId(key);
    // "Apelido Fictício Zeta" is an alias of Python and a part of no name, so only an alias search finds it.
    await query(env.databaseUrl, "insert into skills.skill_aliases (skill_id, alias, normalized_alias) values ($1, 'Apelido Fictício Zeta', 'apelidoficticiozeta')", [skill.python]);
    anaPrivateId = skillSchema.parse(await (await call(env, env.ana, 'POST', '/skills', { name: 'Skill Fictícia Alfa', category: 'tool' })).json()).id;
    const brunoPrivateId = skillSchema.parse(await (await call(env, env.bruno, 'POST', '/skills', { name: 'Skill Fictícia Beta', category: 'tool' })).json()).id;

    const ana = env.ana.id;
    const day = (offset: number) => `2026-10-${String(offset).padStart(2, '0')}T12:00:00.000Z`;
    ids.alfa = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', level: 'mid', workModel: 'remote', status: 'saved',
      lastActivityAt: day(28), skills: [{ skillId: skill.nodejs!, requirement: 'required' }, { skillId: skill.react!, requirement: 'nice_to_have' }],
    });
    ids.saude = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Saúde Ágil Ltda', title: 'Engenheira de Dados', level: 'senior', workModel: 'hybrid', status: 'applied',
      lastActivityAt: day(27), skills: [{ skillId: skill.python!, requirement: 'required' }, { skillId: skill.postgresql!, requirement: 'nice_to_have' }],
    });
    ids.banco = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Banco Fictício Beta', title: 'Desenvolvedor Backend', level: 'junior', workModel: 'onsite', status: 'interviewing',
      lastActivityAt: day(26), skills: [{ skillId: anaPrivateId, requirement: 'required' }, { skillId: skill.typescript!, requirement: 'nice_to_have' }],
    });
    ids.loja = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Loja Fictícia Gama', title: 'Pessoa Desenvolvedora', level: 'intern', workModel: null, status: 'offer', lastActivityAt: day(25),
    });
    ids.estudio = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Estúdio Fictício Delta', title: 'Vaga Especialista', level: 'specialist', workModel: 'remote', status: 'accepted', lastActivityAt: day(24),
    });
    ids.fabrica = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Fábrica Fictícia Épsilon', title: 'Analista', level: 'mid', workModel: 'hybrid', status: 'rejected', lastActivityAt: day(23),
    });
    ids.agencia = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Agência Fictícia Zeta', title: 'Designer de Produto', level: 'junior', workModel: 'onsite', status: 'withdrawn', lastActivityAt: day(22),
    });
    ids.oficina = await seedApplication(env.databaseUrl, {
      userId: ana, company: 'Oficina Fictícia Eta', title: 'Líder Técnica', level: 'senior', workModel: 'remote', status: 'ghosted', lastActivityAt: day(21),
    });
    // The other account: same company and title as one of Ana's, one private skill of its own and 55 more saved applications.
    ids.brunoAlfa = await seedApplication(env.databaseUrl, {
      userId: env.bruno.id, company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', level: 'mid', status: 'saved',
      skills: [{ skillId: skill.nodejs!, requirement: 'required' }, { skillId: brunoPrivateId, requirement: 'required' }],
    });
    for (let index = 0; index < 55; index += 1) {
      await seedApplication(env.databaseUrl, {
        userId: env.bruno.id, company: `Empresa Fictícia ${index}`, title: 'Vaga em Massa', status: 'saved',
        lastActivityAt: `2026-09-01T12:${String(index).padStart(2, '0')}:00.000Z`,
      });
    }
  }, 180_000);

  afterAll(async () => {
    await env.close();
  });

  it('APP-09 answers 200 with { items, nextCursor, counts } and only the applications of the session account', async () => {
    const body = await list(env.ana);

    expect(Object.keys(body).sort()).toEqual(['counts', 'items', 'nextCursor']);
    expect(body.items.map((item) => item.id).sort()).toEqual([ids.alfa, ids.saude, ids.banco, ids.loja].sort());
    expect(body.items.map((item) => item.id)).not.toContain(ids.brunoAlfa);
    const brunos = await list(env.bruno, '?q=empresa+ficticia+alfa');
    expect(brunos.items.map((item) => item.id)).toEqual([ids.brunoAlfa]);
  });

  it('APP-09 returns 50 applications per page', async () => {
    const body = await list(env.bruno);

    expect(body.items).toHaveLength(50);
    expect(body.counts.active).toBe(56);
  });

  it('APP-10 gives each item id, status, company, title, level, workModel, the posting skills, createdAt, lastActivityAt and ghostSuggested, and nothing else', async () => {
    const body = await list(env.ana);
    const alfa = body.items.find((item) => item.id === ids.alfa)!;

    expect(alfa).toEqual({
      id: ids.alfa,
      status: 'saved',
      company: 'Empresa Fictícia Alfa',
      title: 'Vaga de Teste Pleno',
      level: 'mid',
      workModel: 'remote',
      skills: [
        { id: skill.nodejs, name: 'Node.js', scope: 'global', requirement: 'required' },
        { id: skill.react, name: 'React', scope: 'global', requirement: 'nice_to_have' },
      ],
      createdAt: '2026-11-03T12:00:00.000Z',
      lastActivityAt: '2026-10-28T12:00:00.000Z',
      ghostSuggested: false,
    });
    expect(Object.keys(alfa).sort()).toEqual(
      ['company', 'createdAt', 'ghostSuggested', 'id', 'lastActivityAt', 'level', 'skills', 'status', 'title', 'workModel'],
    );
    expect(body.items.find((item) => item.id === ids.loja)).toMatchObject({ workModel: null, skills: [] });
    expect(body.items.find((item) => item.id === ids.banco)?.skills).toEqual([
      { id: anaPrivateId, name: 'Skill Fictícia Alfa', scope: 'private', requirement: 'required' },
      { id: skill.typescript, name: 'TypeScript', scope: 'global', requirement: 'nice_to_have' },
    ]);
  });

  it('APP-11 lists Salva, Enviada, Em entrevistas and Proposta by default and with tab=active, and the four closed statuses with tab=closed', async () => {
    const active = ['Banco Fictício Beta', 'Empresa Fictícia Alfa', 'Loja Fictícia Gama', 'Saúde Ágil Ltda'];
    const closed = ['Agência Fictícia Zeta', 'Estúdio Fictício Delta', 'Fábrica Fictícia Épsilon', 'Oficina Fictícia Eta'];

    expect(await companies(env.ana)).toEqual(active);
    expect(await companies(env.ana, '?tab=active')).toEqual(active);
    expect(await companies(env.ana, '?tab=closed')).toEqual(closed);
    expect((await list(env.ana, '?tab=closed')).items.map((item) => item.status).sort()).toEqual(['accepted', 'ghosted', 'rejected', 'withdrawn']);
  });

  it('APP-12 keeps the statuses, levels and work models listed, OR inside a list and AND between parameters', async () => {
    expect(await companies(env.ana, '?status=applied,interviewing')).toEqual(['Banco Fictício Beta', 'Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?tab=closed&status=accepted,ghosted')).toEqual(['Estúdio Fictício Delta', 'Oficina Fictícia Eta']);
    expect(await companies(env.ana, '?level=junior,senior')).toEqual(['Banco Fictício Beta', 'Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?workModel=remote,onsite')).toEqual(['Banco Fictício Beta', 'Empresa Fictícia Alfa']);
    expect(await companies(env.ana, '?level=senior&workModel=hybrid')).toEqual(['Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?level=senior&workModel=remote')).toEqual([]);
    expect(await companies(env.ana, '?status=saved&level=mid&workModel=remote')).toEqual(['Empresa Fictícia Alfa']);
  });

  it('APP-12 keeps a status of the other tab out, so the status filter never widens the tab', async () => {
    expect(await companies(env.ana, '?tab=active&status=accepted')).toEqual([]);
    expect(await companies(env.ana, '?tab=active&status=saved,accepted')).toEqual(['Empresa Fictícia Alfa']);
  });

  it('APP-13 finds the company or the title by a part of the text, ignoring accent and case', async () => {
    expect(await companies(env.ana, '?q=saude')).toEqual(['Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?q=SAÚDE')).toEqual(['Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?q=engenheira%20de%20dados')).toEqual(['Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?q=backend')).toEqual(['Banco Fictício Beta']);
    expect(await companies(env.ana, '?q=AGIL%20LTDA')).toEqual(['Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?q=zzzsemresultado')).toEqual([]);
  });

  it('APP-13 never matches a q that spans the company and the title', async () => {
    expect(await companies(env.ana, '?q=empresa%20ficticia%20alfa')).toEqual(['Empresa Fictícia Alfa']);
    expect(await companies(env.ana, '?q=alfa%20vaga')).toEqual([]);
    expect(await companies(env.ana, '?q=ltda%20engenheira')).toEqual([]);
  });

  it('APP-13 finds an application by a skill of the posting, by name or by alias, and nodejs finds the one with Node.js', async () => {
    expect(await companies(env.ana, '?q=nodejs')).toEqual(['Empresa Fictícia Alfa']);
    expect(await companies(env.ana, '?q=Node.js')).toEqual(['Empresa Fictícia Alfa']);
    expect(await companies(env.ana, '?q=postgresql')).toEqual(['Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?q=Apelido%20Fict%C3%ADcio%20Zeta')).toEqual(['Saúde Ágil Ltda']);
    expect(await companies(env.ana, '?q=skill%20fict%C3%ADcia%20alfa')).toEqual(['Banco Fictício Beta']);
  });

  it('APP-13 never lets a search reach the private skill or the application of another account', async () => {
    expect(await companies(env.ana, '?q=skill%20fict%C3%ADcia%20beta')).toEqual([]);
    expect((await list(env.ana, '?q=empresa+ficticia+alfa')).items.map((item) => item.id)).toEqual([ids.alfa]);
    expect((await list(env.bruno, '?q=skill+ficticia+beta')).items.map((item) => item.id)).toEqual([ids.brunoAlfa]);
  });

  it('APP-13 takes % and _ as plain text and a blank q as no filter', async () => {
    expect(await companies(env.ana, '?q=%25')).toEqual([]);
    expect(await companies(env.ana, '?q=_')).toEqual([]);
    expect(await companies(env.ana, '?q=%20%20')).toEqual(await companies(env.ana));
  });

  it('APP-13 combines the search with the other filters', async () => {
    expect(await companies(env.ana, '?q=ficticia&level=senior')).toEqual([]);
    expect(await companies(env.ana, '?q=ficticia&level=junior')).toEqual(['Banco Fictício Beta']);
    expect(await companies(env.ana, '?tab=closed&q=ficticia&workModel=hybrid')).toEqual(['Fábrica Fictícia Épsilon']);
  });

  it('APP-17 answers 400 in Problem Details for a value outside the enum, a q above 100 characters and an invalid cursor', async () => {
    const invalid = [
      '?status=archived',
      '?status=applied,archived',
      '?level=principal',
      '?workModel=remoto',
      '?status=',
      '?level=',
      '?workModel=',
      '?level=,',
      '?tab=all',
      '?sort=company',
      `?q=${'q'.repeat(101)}`,
      '?cursor=not-a-cursor!',
      `?cursor=${Buffer.from('{"rank":9,"at":"2026-01-01T00:00:00.000Z","id":"x"}').toString('base64url')}`,
    ];

    for (const search of invalid) {
      const response = await call(env, env.ana, 'GET', `/applications${search}`);

      expect(response.status, search).toBe(400);
      expect(response.headers.get('content-type'), search).toContain('application/problem+json');
      expect(problemDetailsSchema.parse(await response.json()).status, search).toBe(400);
    }
    expect((await call(env, env.ana, 'GET', `/applications?q=${'q'.repeat(100)}`)).status).toBe(200);
  });
});
