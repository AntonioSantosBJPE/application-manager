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
