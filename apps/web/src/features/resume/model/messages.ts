/** The copy the master resume spec fixes for the page, so no component invents its own wording. */
export const RESUME_MESSAGES = {
  title: 'Currículo mestre',
  /** Under a field whose save failed; the value typed stays in the field (RES-48). */
  saveFailed: 'Não foi possível salvar. Tente de novo.',
  /** When the new order could not be saved and the list went back to the one before (RES-74). */
  reorderFailed: 'Não foi possível salvar a nova ordem.',
  /** Under the button that removes an item the api did not remove (RES-58). */
  deleteFailed: 'Não foi possível excluir. Tente de novo.',
  loadFailed: 'Não foi possível carregar o currículo.',
  retry: 'Tentar de novo',
  /** The name of the index of sections, for assistive technology. */
  /** Before the time of the last save that worked (RES-44). */
  savedAt: 'Salvo às',
  indexLabel: 'Seções do currículo',
  /** Under a new item that is not complete yet (RES-52). */
  requiredToSave: 'Preencha os campos obrigatórios para salvar.',
  endBeforeStart: 'O fim não pode ser antes do início.',
} as const;

/** "Salvo às 14:32", the time being the browser's, written by the caller of `useSavedAt` (RES-44). */
export const savedAtLabel = (time: string) => `${RESUME_MESSAGES.savedAt} ${time}`;

/** The labels of the profile fields, as the spec writes them (RES-43). */
export const PROFILE_LABELS = {
  fullName: 'Nome completo',
  headline: 'Título profissional',
  email: 'E-mail',
  phone: 'Telefone · opcional',
  location: 'Local · opcional',
  summary: 'Resumo',
} as const;

/** The links of the profile (RES-46, RES-84). */
export const LINK_MESSAGES = {
  title: 'Links',
  /** After the `plus` icon. */
  add: 'Link',
  label: 'Rótulo',
  url: 'URL',
  /** The name of the row `n`, counted from 1. */
  row: (n: number) => `Link ${n}`,
  /** The name of the button that removes the row `n`. */
  remove: (n: number) => `Remover link ${n}`,
} as const;

/** The names of the controls of an item, each saying which item it is about (RES-54, RES-56). */
export const ITEM_MESSAGES = {
  edit: (title: string) => `Editar ${title}`,
  expand: (title: string) => `Expandir ${title}`,
  bullets: (title: string) => `Bullets de ${title}`,
} as const;

/** The words of the confirmation before an item is removed (RES-57). */
export const DELETE_DIALOG = { confirm: 'Excluir', cancel: 'Cancelar' } as const;

/** The words of a bullet (RES-60 to RES-69). */
export const BULLET_MESSAGES = {
  /** After the `plus` icon. */
  add: 'Bullet',
  noSkill: 'sem skill',
  /** The name of the field that edits the text of a bullet, read before the text itself. */
  editText: 'Editar texto do bullet',
  /** The name of the field of a bullet that is being written. */
  newText: 'Texto do novo bullet',
  /** The name of the "⋯" menu button of a bullet. */
  actions: 'Ações do bullet',
  delete: 'Excluir bullet',
  /** The item of the menu, and the notice "sem skill", that open the field of skills (RES-66). */
  editSkills: 'Editar skills',
  skillsLabel: 'Skills do bullet',
  /** Closes the field of skills (RES-67). */
  done: 'Concluir',
  saveFailed: RESUME_MESSAGES.saveFailed,
  deleteFailed: RESUME_MESSAGES.deleteFailed,
} as const;
