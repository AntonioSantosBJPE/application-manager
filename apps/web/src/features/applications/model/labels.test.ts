import { describe, expect, it } from 'vitest';
import {
  LEVEL_LABELS,
  NO_WORK_MODEL_LABEL,
  SORT_LABELS,
  STAGE_LABELS,
  STATUS_GROUP_LABELS,
  STATUS_LABELS,
  TAB_LABELS,
  WORK_MODEL_LABELS,
} from './labels';

describe('labels', () => {
  it('APP-44 names the eight statuses as the spec does', () => {
    expect(STATUS_LABELS).toEqual({
      saved: 'Salva',
      applied: 'Enviada',
      interviewing: 'Em entrevistas',
      offer: 'Proposta',
      accepted: 'Aceita',
      rejected: 'Recusada',
      withdrawn: 'Desisti',
      ghosted: 'Sem retorno',
    });
  });

  it('APP-45 names the eight group titles in the plural of the card', () => {
    expect(STATUS_GROUP_LABELS).toEqual({
      saved: 'Salvas',
      applied: 'Enviadas',
      interviewing: 'Em entrevistas',
      offer: 'Propostas',
      accepted: 'Aceitas',
      rejected: 'Recusadas',
      withdrawn: 'Desisti',
      ghosted: 'Sem retorno',
    });
  });

  it('APP-44 names levels, work models and the absent work model as the spec does', () => {
    expect(LEVEL_LABELS).toEqual({
      intern: 'Estágio',
      junior: 'Júnior',
      mid: 'Pleno',
      senior: 'Sênior',
      specialist: 'Especialista',
    });
    expect(WORK_MODEL_LABELS).toEqual({ remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' });
    expect(NO_WORK_MODEL_LABEL).toBe('—');
  });

  it('APP-72 names the five stages as the spec does', () => {
    expect(STAGE_LABELS).toEqual({
      screening: 'Triagem',
      hr: 'RH',
      technical: 'Técnica',
      case: 'Case',
      other: 'Outra',
    });
  });

  it('APP-46 names the tabs and the two orders', () => {
    expect(TAB_LABELS).toEqual({ active: 'Ativas', closed: 'Encerradas' });
    expect(SORT_LABELS).toEqual({ activity: 'Última atividade', created: 'Cadastro' });
  });
});
