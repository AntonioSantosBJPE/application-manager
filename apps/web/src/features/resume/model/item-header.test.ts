import { describe, expect, it } from 'vitest';
import { itemHeader } from './item-header';

const id = '8f6a1c2e-0000-7000-8000-000000000011';

describe('itemHeader', () => {
  it('RES-49 shows "{cargo} · {empresa}" with the range in mono and the location for an experience', () => {
    const header = itemHeader('experiences', {
      id,
      role: 'Cargo Fictício',
      company: 'Empresa Fictícia Alfa',
      location: 'Remoto',
      startDate: '2021-01',
      endDate: '2023-02',
    });

    expect(header).toEqual({
      title: 'Cargo Fictício · Empresa Fictícia Alfa',
      dates: 'jan 2021 — fev 2023',
      detail: 'Remoto',
    });
  });

  it('RES-50 shows "{início} — atual" for an experience with no end, and no detail without a location', () => {
    const header = itemHeader('experiences', {
      id,
      role: 'Cargo Fictício',
      company: 'Empresa Fictícia Alfa',
      location: null,
      startDate: '2023-03',
      endDate: null,
    });

    expect(header).toEqual({ title: 'Cargo Fictício · Empresa Fictícia Alfa', dates: 'mar 2023 — atual', detail: undefined });
  });

  it('RES-49 shows the name and the link for a project, and only the name without a link', () => {
    expect(itemHeader('projects', { id, name: 'Projeto Fictício', url: 'https://exemplo.com/p', description: null })).toEqual({
      title: 'Projeto Fictício',
      detail: 'https://exemplo.com/p',
    });
    expect(itemHeader('projects', { id, name: 'Projeto Fictício', url: null, description: 'x' })).toEqual({
      title: 'Projeto Fictício',
      detail: undefined,
    });
  });

  it('RES-49 shows "{curso} · {instituição}" with the dates for an education, "atual" while it goes on', () => {
    const closed = itemHeader('educations', { id, course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2019-02', endDate: '2022-12' });
    const open = itemHeader('educations', { id, course: 'Curso Fictício', institution: 'Instituição Fictícia', startDate: '2024-02', endDate: null });

    expect(closed).toEqual({ title: 'Curso Fictício · Instituição Fictícia', dates: 'fev 2019 — dez 2022' });
    expect(open.dates).toBe('fev 2024 — atual');
  });

  it('RES-49 shows "{nome} · {emissor}" with the issue month for a certification', () => {
    expect(itemHeader('certifications', { id, name: 'Certificação Fictícia', issuer: 'Emissor Fictício', issuedOn: '2024-05', url: null })).toEqual({
      title: 'Certificação Fictícia · Emissor Fictício',
      dates: 'mai 2024',
    });
  });

  it('RES-49 leaves out the issuer and the month a certification does not have', () => {
    expect(itemHeader('certifications', { id, name: 'Certificação Fictícia', issuer: null, issuedOn: null, url: null })).toEqual({
      title: 'Certificação Fictícia',
      dates: undefined,
    });
  });

  it('RES-49 shows "{idioma} · {nível}" for a language, the level in words', () => {
    expect(itemHeader('languages', { id, language: 'Inglês', level: 'advanced' })).toEqual({ title: 'Inglês · Avançado' });
    expect(itemHeader('languages', { id, language: 'Português', level: 'native' })).toEqual({ title: 'Português · Nativo' });
  });
});
