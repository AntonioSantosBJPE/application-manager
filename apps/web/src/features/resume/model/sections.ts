import type { LanguageLevel, ResumeSection } from '@am/contracts';

/** The sections the index shows, in its order: the profile first, then the five lists of items. */
export const PAGE_SECTIONS = ['profile', 'experiences', 'projects', 'educations', 'certifications', 'languages'] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

/** The section the page shows when the address names none, or one that does not exist (RES-36). */
export const DEFAULT_SECTION: PageSection = 'profile';

/** The value of `section` in the address, as a section; anything else is the profile (RES-36). */
export function parseSection(value: unknown): PageSection {
  return PAGE_SECTIONS.find((section) => section === value) ?? DEFAULT_SECTION;
}

/** The name of each section in the index and as the title of the section itself. */
export const SECTION_LABELS: Record<PageSection, string> = {
  profile: 'Perfil',
  experiences: 'Experiência',
  projects: 'Projetos',
  educations: 'Formação',
  certifications: 'Certificações',
  languages: 'Idiomas',
};

/** What a section with no item says (RES-39). */
export const EMPTY_SECTION_TEXTS: Record<ResumeSection, string> = {
  experiences: 'Nenhuma experiência ainda.',
  projects: 'Nenhum projeto ainda.',
  educations: 'Nenhuma formação ainda.',
  certifications: 'Nenhuma certificação ainda.',
  languages: 'Nenhum idioma ainda.',
};

/** The button at the top of a section that opens an empty item (RES-51). */
export const ADD_ITEM_LABELS: Record<ResumeSection, string> = {
  experiences: '+ Experiência',
  projects: '+ Projeto',
  educations: '+ Formação',
  certifications: '+ Certificação',
  languages: '+ Idioma',
};

/** What an item of each section is called in a sentence ("Excluir experiência"). */
export const ITEM_NOUNS: Record<ResumeSection, string> = {
  experiences: 'experiência',
  projects: 'projeto',
  educations: 'formação',
  certifications: 'certificação',
  languages: 'idioma',
};

/** The button in the fields of an item that removes it (RES-54). */
export const DELETE_ITEM_LABELS: Record<ResumeSection, string> = {
  experiences: 'Excluir experiência',
  projects: 'Excluir projeto',
  educations: 'Excluir formação',
  certifications: 'Excluir certificação',
  languages: 'Excluir idioma',
};

/** The title of the confirmation before an item is removed (RES-57). */
export const DELETE_ITEM_TITLES: Record<ResumeSection, string> = {
  experiences: 'Excluir experiência?',
  projects: 'Excluir projeto?',
  educations: 'Excluir formação?',
  certifications: 'Excluir certificação?',
  languages: 'Excluir idioma?',
};

/** The level of a language as the header of its item says it (RES-49). */
export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  basic: 'Básico',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
  fluent: 'Fluente',
  native: 'Nativo',
};

/** The levels in the order a person thinks of them, from the least to the most. */
export const LANGUAGE_LEVEL_ORDER: readonly LanguageLevel[] = ['basic', 'intermediate', 'advanced', 'fluent', 'native'];
