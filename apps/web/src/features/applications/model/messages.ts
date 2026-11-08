import type { ApplicationStatus } from '@am/contracts';
import { STATUS_LABELS } from './labels';

/** The copy the applications spec fixes for the list and the new application dialog (APP-42..APP-65). */
export const APPLICATIONS_MESSAGES = {
  title: 'Candidaturas',
  newApplication: 'Nova candidatura',
  newShortcut: 'C',
  levelFilter: 'Nível',
  workModelFilter: 'Modelo',
  statusFilter: 'Filtro',
  searchLabel: 'Empresa, título ou skill',
  filters: 'Filtros',
  ghost: 'sem retorno?',
  empty: 'Nenhuma candidatura ainda.',
  noMatch: 'Nenhuma candidatura com esses filtros.',
  clearFilters: 'Limpar filtros',
  loadError: 'Não foi possível carregar as candidaturas.',
  retry: 'Tentar de novo',
  loadMore: 'Carregar mais',
  loading: 'Carregando candidaturas…',
  list: 'Candidaturas',
} as const;

/** The accessible name of the "+" of a group header (APP-45). */
export const newInStatusLabel = (status: ApplicationStatus) => `Nova candidatura em ${STATUS_LABELS[status]}`;

/** The accessible name of the "⋯" button of a row (APP-50). */
export const rowActionsLabel = (company: string) => `Ações de ${company}`;

/** The copy of the new application dialog (APP-57..APP-65). */
export const FORM_MESSAGES = {
  createTitle: 'Nova candidatura',
  company: 'Empresa',
  jobTitle: 'Título',
  link: 'Link da vaga',
  linkHint: '· opcional',
  linkPlaceholder: 'https://',
  level: 'Nível',
  workModel: 'Modelo',
  requiredSkills: 'Skills obrigatórias',
  niceSkills: 'Skills desejáveis',
  skillsPlaceholder: 'Adicionar…',
  description: 'Descrição',
  descriptionHint: '· opcional, cole o texto da vaga',
  enters: 'Entra como',
  toCreate: 'para criar',
  close: 'esc',
  cancel: 'Cancelar',
  create: 'Criar candidatura',
  companyRequired: 'Informe a empresa.',
  titleRequired: 'Informe o título.',
  levelRequired: 'Escolha o nível.',
  linkInvalid: 'O link precisa começar com http:// ou https://.',
  tooLong: (max: number) => `Use até ${max} caracteres.`,
} as const;

/** The copy of the detail of an application (PageApplicationDetail, APP-66..APP-82). */
export const DETAIL_MESSAGES = {
  list: 'Candidaturas',
  breadcrumb: 'Caminho',
  openPosting: 'Abrir vaga',
  moreActions: 'Mais ações',
  skills: 'Skills da vaga',
  required: 'Obrigatórias',
  nice: 'Desejáveis',
  timeline: 'Linha do tempo',
  addStage: 'Etapa',
  notePlaceholder: 'Adicionar nota…',
  properties: 'Propriedades',
  status: 'Status',
  level: 'Nível',
  workModel: 'Modelo',
  location: 'Local',
  posting: 'Vaga',
  createdAt: 'Cadastrada',
  activity: 'Atividade',
  description: 'Descrição da vaga',
  showAll: 'Ver texto completo',
  delete: 'Excluir candidatura',
  notFound: 'Candidatura não encontrada.',
  backToList: 'Voltar para Candidaturas',
  empty: '—',
  editLocation: 'Editar local',
  editPosting: 'Editar link da vaga',
} as const;

/** The accessible name of a property menu: the name of the property and the value it shows ("Status Enviada"). */
export const propertyLabel = (name: string, value: string) => `${name} ${value}`;
