import type { ResumeSection } from '@am/contracts';
import type { SortableAnnouncements } from '@am/ui';

/** The words of the reorder, which `Sortable` leaves to the caller (RES-72, RES-73, RES-76). */
export const REORDER_MESSAGES = {
  /** Read on the handle: how to pick, move, drop and cancel with the keyboard (RES-72). */
  instructions: 'Pegue com Espaço ou Enter, mova com as setas e solte com Espaço ou Enter. Esc cancela.',
  /** What a screen reader calls the handle. */
  roleDescription: 'item arrastável',
  /** The accessible name of the handle of an item or bullet. */
  move: (name: string) => `Mover ${name}`,
} as const;

/** The name of the list of the items of a section, for assistive technology. */
export const ITEM_LIST_LABELS: Record<ResumeSection, string> = {
  experiences: 'Lista de experiências',
  projects: 'Lista de projetos',
  educations: 'Lista de formações',
  certifications: 'Lista de certificações',
  languages: 'Lista de idiomas',
};

/** The name of the list of the bullets of an item. */
export const bulletListLabel = (title: string) => `Ordem dos bullets de ${title}`;

/** A bullet is named by the start of its text, in the handle and in the announcements. */
export function bulletName(text: string): string {
  const shown = text.length > 40 ? `${text.slice(0, 40).trimEnd()}…` : text;
  return `bullet “${shown}”`;
}

/** The live-region sentences of one list, naming each item by `nameOf(id)` (RES-72, RES-73). */
export function announcementsFor(nameOf: (id: string) => string): SortableAnnouncements {
  return {
    onPick: ({ id, position, total }) => `${nameOf(id)} pego. Posição ${position} de ${total}.`,
    onMove: ({ id, position, total }) => `${nameOf(id)} movido para a posição ${position} de ${total}.`,
    onDrop: ({ id, position, total }) => `${nameOf(id)} solto na posição ${position} de ${total}.`,
    onCancel: ({ id, position, total }) => `Movimento cancelado. ${nameOf(id)} voltou à posição ${position} de ${total}.`,
  };
}
