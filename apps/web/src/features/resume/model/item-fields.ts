import type { ResumeSection } from '@am/contracts';
import type { CachedItemOf } from './items';

/** How a field is drawn and typed. */
export type FieldKind = 'text' | 'textarea' | 'month' | 'level';

export interface FieldSpec {
  /** The key of the field in the form and in the body sent to the api. */
  name: string;
  /** The label, as the spec writes it (RES-54). */
  label: string;
  kind: FieldKind;
  /** The field holds no value when empty; a required one has to be filled for the item to be saved. */
  optional?: boolean;
  /** Takes the whole row of the grid. */
  wide?: boolean;
}

/** The fields of each section, in the order the person fills them. */
export const ITEM_FIELDS: Record<ResumeSection, FieldSpec[]> = {
  experiences: [
    { name: 'role', label: 'Cargo', kind: 'text' },
    { name: 'company', label: 'Empresa', kind: 'text' },
    { name: 'location', label: 'Local · opcional', kind: 'text', optional: true, wide: true },
  ],
  projects: [
    { name: 'name', label: 'Nome', kind: 'text', wide: true },
    { name: 'url', label: 'URL · opcional', kind: 'text', optional: true, wide: true },
    { name: 'description', label: 'Descrição · opcional', kind: 'textarea', optional: true, wide: true },
  ],
  educations: [
    { name: 'course', label: 'Curso', kind: 'text' },
    { name: 'institution', label: 'Instituição', kind: 'text' },
  ],
  certifications: [
    { name: 'name', label: 'Nome', kind: 'text' },
    { name: 'issuer', label: 'Emissor · opcional', kind: 'text', optional: true },
    { name: 'issuedOn', label: 'Emissão · opcional', kind: 'month', optional: true },
    { name: 'url', label: 'URL · opcional', kind: 'text', optional: true },
  ],
  languages: [
    { name: 'language', label: 'Idioma', kind: 'text' },
    { name: 'level', label: 'Nível', kind: 'level', wide: true },
  ],
};

/** The sections whose items have a start, an end and the box that says there is no end. */
export const ENDING_LABELS: Partial<Record<ResumeSection, string>> = {
  experiences: 'Trabalho aqui atualmente',
  educations: 'Em andamento',
};

export const START_LABEL = 'Início';
export const END_LABEL = 'Fim';

/** What the header of a new item says until it has a title of its own. */
export const NEW_ITEM_TITLES: Record<ResumeSection, string> = {
  experiences: 'Nova experiência',
  projects: 'Novo projeto',
  educations: 'Nova formação',
  certifications: 'Nova certificação',
  languages: 'Novo idioma',
};

/** What the form holds: every field as typed text, and `current` as "1" or "". */
export type ItemValues = Record<string, string>;

const text = (value: string | null | undefined) => value ?? '';

/** The values of an item, or of a new one with every field empty. */
export function valuesOf<S extends ResumeSection>(section: S, item?: CachedItemOf[S]): ItemValues {
  const empty: ItemValues = { current: '' };
  if (item === undefined) return empty;
  const row = item as unknown as Record<string, string | null>;
  const values: ItemValues = {};
  for (const spec of ITEM_FIELDS[section]) values[spec.name] = text(row[spec.name]);
  if (ENDING_LABELS[section] !== undefined) {
    values.startDate = text(row.startDate);
    values.endDate = text(row.endDate);
    values.current = row.endDate === null ? '1' : '';
  }
  return values;
}

/** The body the api reads for these values: texts trimmed, an empty optional field as `null`. */
export function bodyOf(section: ResumeSection, values: ItemValues): Record<string, string | null> {
  const required = (name: string) => text(values[name]).trim();
  const optional = (name: string) => (required(name) === '' ? null : required(name));
  const end = values.current === '1' ? null : optional('endDate');
  switch (section) {
    case 'experiences':
      return {
        role: required('role'),
        company: required('company'),
        location: optional('location'),
        startDate: required('startDate'),
        endDate: end,
      };
    case 'projects':
      return { name: required('name'), url: optional('url'), description: optional('description') };
    case 'educations':
      return {
        course: required('course'),
        institution: required('institution'),
        startDate: required('startDate'),
        endDate: end,
      };
    case 'certifications':
      return {
        name: required('name'),
        issuer: optional('issuer'),
        issuedOn: optional('issuedOn'),
        url: optional('url'),
      };
    case 'languages':
      return { language: required('language'), level: required('level') };
  }
}

/** The fields of the body that differ between two sets of values; both dates go together, so the api can compare them. */
export function changedBody(section: ResumeSection, now: ItemValues, saved: ItemValues): Record<string, string | null> {
  const next = bodyOf(section, now);
  const before = bodyOf(section, saved);
  const changed = Object.keys(next).filter((key) => next[key] !== before[key]);
  if (changed.includes('startDate') || changed.includes('endDate')) {
    for (const key of ['startDate', 'endDate']) if (!changed.includes(key)) changed.push(key);
  }
  return Object.fromEntries(changed.map((key) => [key, next[key] ?? null]));
}
