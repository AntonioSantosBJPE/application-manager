// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderDetail } from '../testing/detail-harness';
import { detail, postingSkill } from '../testing/fixtures';
import { ApplicationNotFound } from './ApplicationNotFound';

afterEach(() => {
  vi.restoreAllMocks();
});

const opened = detail(1, {
  company: 'Empresa Fictícia Alfa',
  title: 'Vaga de Teste Pleno',
  status: 'applied',
  level: 'mid',
  workModel: 'onsite',
  location: 'Recife, PE',
  url: 'https://vagas.exemplo.com/1234',
  createdAt: '2026-10-14T15:00:00.000Z',
  lastActivityAt: '2026-10-20T15:00:00.000Z',
  skills: [
    { ...postingSkill(1, 'required', 'Java'), category: 'language' },
    { ...postingSkill(2, 'required', 'Spring Boot'), category: 'framework' },
    { ...postingSkill(3, 'nice_to_have', 'Kubernetes'), category: 'tool' },
  ],
});

const sidebar = () => screen.getByRole('complementary', { name: 'Propriedades' });

describe('ApplicationDetail', () => {
  it('APP-66 shows the card without the resume section: breadcrumb, company and title, skills, timeline and properties', () => {
    renderDetail(opened);

    const crumb = screen.getByRole('navigation', { name: 'Caminho' });
    expect(within(crumb).getByRole('link', { name: 'Candidaturas' })).toHaveAttribute('href', '/applications');
    expect(within(crumb).getByText('Empresa Fictícia Alfa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Vaga de Teste Pleno' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Skills da vaga' })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Obrigatórias' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Java',
      'Spring Boot',
    ]);
    expect(within(screen.getByRole('list', { name: 'Desejáveis' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Kubernetes',
    ]);

    expect(screen.getByRole('heading', { level: 2, name: 'Linha do tempo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Etapa' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Adicionar nota…')).toBeInTheDocument();

    const names = within(sidebar())
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(names).toEqual(['Status', 'Nível', 'Modelo', 'Local', 'Vaga', 'Cadastrada', 'Atividade']);
    const values = within(sidebar())
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(values).toEqual([
      'Enviada',
      'Pleno',
      'Presencial',
      'Editar local Recife, PE',
      'Editar link da vaga https://vagas.exemplo.com/1234',
      '14 out 2026',
      '20 out 2026',
    ]);
    expect(within(sidebar()).getByRole('button', { name: 'Excluir candidatura' })).toBeInTheDocument();

    expect(screen.queryByText('Currículo')).toBeNull();
    expect(screen.queryByText(/seu currículo cobre/)).toBeNull();
  });

  it('APP-66 shows "—" for a posting without a work model, local or link', () => {
    renderDetail({ ...opened, workModel: null, location: null, url: null });

    const values = within(sidebar())
      .getAllByRole('definition')
      .map((value) => value.textContent);
    expect(values.slice(2, 5)).toEqual(['—', 'Editar local —', 'Editar link da vaga —']);
  });

  it('APP-67 opens the posting in a new tab with noopener noreferrer when the posting has a link', () => {
    renderDetail(opened);

    const link = screen.getByRole('link', { name: 'Abrir vaga' });
    expect(link).toHaveAttribute('href', 'https://vagas.exemplo.com/1234');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('APP-67 has no "Abrir vaga" when the posting has no link', () => {
    renderDetail({ ...opened, url: null });

    expect(screen.queryByRole('link', { name: 'Abrir vaga' })).toBeNull();
  });

  it('APP-76 shows "Ver texto completo" when the description is longer than six lines, and the click shows all of it', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(240);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120);
    renderDetail({ ...opened, description: 'Texto fictício da vaga.' });

    const text = within(sidebar()).getByText('Texto fictício da vaga.');
    expect(text.className).toContain('line-clamp-6');

    fireEvent.click(within(sidebar()).getByRole('button', { name: 'Ver texto completo' }));

    expect(within(sidebar()).getByText('Texto fictício da vaga.').className).not.toContain('line-clamp');
    expect(within(sidebar()).queryByRole('button', { name: 'Ver texto completo' })).toBeNull();
  });

  it('APP-76 shows "Ver texto completo" for a description of more than six explicit lines', () => {
    renderDetail({ ...opened, description: ['1', '2', '3', '4', '5', '6', '7'].join('\n') });

    expect(within(sidebar()).getByRole('button', { name: 'Ver texto completo' })).toBeInTheDocument();
  });

  it('APP-76 leaves "Ver texto completo" out when the description fits in six lines', () => {
    renderDetail({ ...opened, description: 'Texto curto.' });

    expect(within(sidebar()).getByText('Texto curto.')).toBeInTheDocument();
    expect(within(sidebar()).queryByRole('button', { name: 'Ver texto completo' })).toBeNull();
  });

  it('APP-76 leaves the whole section out when there is no description', () => {
    renderDetail({ ...opened, description: null });

    expect(screen.queryByText('Descrição da vaga')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver texto completo' })).toBeNull();
  });
});

describe('ApplicationNotFound', () => {
  it('APP-77 says the application was not found and links back to the list', () => {
    render(<ApplicationNotFound />);

    expect(screen.getByText('Candidatura não encontrada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para Candidaturas' })).toHaveAttribute('href', '/applications');
  });

  it('APP-77 opens the list through the router when the screen is given the way', () => {
    const onOpenList = vi.fn();
    render(<ApplicationNotFound onOpenList={onOpenList} />);

    fireEvent.click(screen.getByRole('link', { name: 'Voltar para Candidaturas' }));

    expect(onOpenList).toHaveBeenCalledTimes(1);
  });
});
