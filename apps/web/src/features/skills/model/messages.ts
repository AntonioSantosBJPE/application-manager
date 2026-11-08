/** The copy the skills spec fixes, so no screen invents its own wording (SKL-38, SKL-43, SKL-47, SKL-49, SKL-73..SKL-76). */
export const SKILLS_MESSAGES = {
  title: 'Catálogo de skills',
  addAlias: 'Apelido',
  searchLabel: 'Nome ou apelido',
  scopeAll: 'Todas',
  scopePrivate: 'Privadas',
  privateBadge: 'Privada',
  noAliases: '—',
  promote: 'Promover',
  edit: 'Editar',
  aliases: 'Apelidos',
  remove: 'Remover',
  loadMore: 'Carregar mais',
  clearFilters: 'Limpar filtros',
  empty: 'Nenhuma skill encontrada.',
  promoteInfo:
    'Promover torna a skill global. Se a chave já existir como global, a promoção é recusada e a fusão é manual.',
  promoteConflict: 'Já existe uma skill global com esse nome ou apelido. A fusão é manual.',
  aliasConflict: 'Esse apelido já pertence a outra skill.',
  nameConflict: 'Já existe uma skill ou apelido com esse nome.',
  noAliasesInDialog: 'Esta skill não tem apelidos.',
  editTitle: 'Editar skill',
} as const;

/** The accessible name of the "⋯" button of a global row (SKL-40). */
export const rowMenuLabel = (name: string) => `Ações de ${name}`;

export const promoteTitle = (name: string) => `Promover ${name}?`;

export const aliasesTitle = (name: string) => `Apelidos de ${name}`;

export const removeAliasTitle = (alias: string) => `Remover o apelido ${alias}?`;

/** What the promote dialog says: the skill becomes visible to everyone and this screen cannot undo it (SKL-45). */
export const PROMOTE_DESCRIPTION =
  'A skill passa a ser visível para todas as pessoas. A promoção não se desfaz por aqui.';

/** What the remove-alias dialog says: the search stops finding the skill by that alias (SKL-76). */
export const REMOVE_ALIAS_DESCRIPTION = 'A busca por esse apelido deixa de achar a skill.';
