import type { ApplicationStatus, ApplicationsSort, ApplicationsTab, JobLevel, Stage, WorkModel } from '@am/contracts';

/** The label of each status on the row, the menus and the timeline (spec: "Rótulos de status"). */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Salva',
  applied: 'Enviada',
  interviewing: 'Em entrevistas',
  offer: 'Proposta',
  accepted: 'Aceita',
  rejected: 'Recusada',
  withdrawn: 'Desisti',
  ghosted: 'Sem retorno',
};

/** The title of each group on the list, in the plural the PageApplications card draws (spec: "Grupos da lista"). */
export const STATUS_GROUP_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Salvas',
  applied: 'Enviadas',
  interviewing: 'Em entrevistas',
  offer: 'Propostas',
  accepted: 'Aceitas',
  rejected: 'Recusadas',
  withdrawn: 'Desisti',
  ghosted: 'Sem retorno',
};

export const LEVEL_LABELS: Record<JobLevel, string> = {
  intern: 'Estágio',
  junior: 'Júnior',
  mid: 'Pleno',
  senior: 'Sênior',
  specialist: 'Especialista',
};

/** The order of the level chips, from the least to the most senior. */
export const LEVEL_ORDER: readonly JobLevel[] = ['intern', 'junior', 'mid', 'senior', 'specialist'];

export const WORK_MODEL_LABELS: Record<WorkModel, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
};

export const WORK_MODEL_ORDER: readonly WorkModel[] = ['remote', 'hybrid', 'onsite'];

/** What a posting without a work model shows. */
export const NO_WORK_MODEL_LABEL = '—';

export const STAGE_LABELS: Record<Stage, string> = {
  screening: 'Triagem',
  hr: 'RH',
  technical: 'Técnica',
  case: 'Case',
  other: 'Outra',
};

export const STAGE_ORDER: readonly Stage[] = ['screening', 'hr', 'technical', 'case', 'other'];

export const TAB_LABELS: Record<ApplicationsTab, string> = {
  active: 'Ativas',
  closed: 'Encerradas',
};

/** The button toggles between the two orders (spec: "Ordenação e menu da linha"). */
export const SORT_LABELS: Record<ApplicationsSort, string> = {
  activity: 'Última atividade',
  created: 'Cadastro',
};
