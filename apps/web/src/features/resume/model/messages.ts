/** The copy the master resume spec fixes for the page, so no component invents its own wording. */
export const RESUME_MESSAGES = {
  title: 'Currículo mestre',
  /** Under a field whose save failed; the value typed stays in the field (RES-48). */
  saveFailed: 'Não foi possível salvar. Tente de novo.',
  /** When the new order could not be saved and the list went back to the one before (RES-74). */
  reorderFailed: 'Não foi possível salvar a nova ordem.',
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
