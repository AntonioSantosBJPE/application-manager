import { describe, expect, it } from 'vitest';
import {
  ADD_ITEM_LABELS,
  DELETE_ITEM_LABELS,
  DELETE_ITEM_TITLES,
  EMPTY_SECTION_TEXTS,
  LANGUAGE_LEVEL_LABELS,
  PAGE_SECTIONS,
  parseSection,
  SECTION_LABELS,
} from './sections';

describe('sections', () => {
  it('RES-36 shows the profile when the address names no section', () => {
    expect(parseSection(undefined)).toBe('profile');
  });

  it('RES-36 shows the profile when the address names an unknown section', () => {
    for (const value of ['unknown', '', 'Experiences', 42, null, ['experiences']]) {
      expect(parseSection(value), String(value)).toBe('profile');
    }
  });

  it('RES-36 keeps each of the six sections the address names', () => {
    for (const section of PAGE_SECTIONS) expect(parseSection(section)).toBe(section);
    expect(PAGE_SECTIONS).toEqual(['profile', 'experiences', 'projects', 'educations', 'certifications', 'languages']);
  });

  it('RES-35 names the six sections of the index as the spec does, in order', () => {
    expect(PAGE_SECTIONS.map((section) => SECTION_LABELS[section])).toEqual([
      'Perfil',
      'Experiência',
      'Projetos',
      'Formação',
      'Certificações',
      'Idiomas',
    ]);
  });

  it('RES-39 says the five texts of an empty section as the spec does', () => {
    expect(EMPTY_SECTION_TEXTS).toEqual({
      experiences: 'Nenhuma experiência ainda.',
      projects: 'Nenhum projeto ainda.',
      educations: 'Nenhuma formação ainda.',
      certifications: 'Nenhuma certificação ainda.',
      languages: 'Nenhum idioma ainda.',
    });
  });

  it('RES-51 names the five buttons that open an empty item as the spec does', () => {
    expect(ADD_ITEM_LABELS).toEqual({
      experiences: '+ Experiência',
      projects: '+ Projeto',
      educations: '+ Formação',
      certifications: '+ Certificação',
      languages: '+ Idioma',
    });
  });

  it('RES-57 titles the confirmation and names the delete button of each section as the spec does', () => {
    expect(DELETE_ITEM_TITLES).toEqual({
      experiences: 'Excluir experiência?',
      projects: 'Excluir projeto?',
      educations: 'Excluir formação?',
      certifications: 'Excluir certificação?',
      languages: 'Excluir idioma?',
    });
    expect(DELETE_ITEM_LABELS).toEqual({
      experiences: 'Excluir experiência',
      projects: 'Excluir projeto',
      educations: 'Excluir formação',
      certifications: 'Excluir certificação',
      languages: 'Excluir idioma',
    });
  });

  it('RES-49 names the five language levels as the spec does', () => {
    expect(LANGUAGE_LEVEL_LABELS).toEqual({
      basic: 'Básico',
      intermediate: 'Intermediário',
      advanced: 'Avançado',
      fluent: 'Fluente',
      native: 'Nativo',
    });
  });
});
