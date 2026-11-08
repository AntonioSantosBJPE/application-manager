import { describe, expect, it } from 'vitest';
import {
  aliasesTitle,
  promoteTitle,
  PROMOTE_DESCRIPTION,
  removeAliasTitle,
  REMOVE_ALIAS_DESCRIPTION,
  rowMenuLabel,
  SKILLS_MESSAGES,
} from './messages';

describe('SKILLS_MESSAGES', () => {
  it('SKL-38 carries the texts of the PageSkills card', () => {
    expect(SKILLS_MESSAGES.title).toBe('Catálogo de skills');
    expect(SKILLS_MESSAGES.addAlias).toBe('Apelido');
    expect(SKILLS_MESSAGES.searchLabel).toBe('Nome ou apelido');
    expect(SKILLS_MESSAGES.scopeAll).toBe('Todas');
    expect(SKILLS_MESSAGES.scopePrivate).toBe('Privadas');
    expect(SKILLS_MESSAGES.privateBadge).toBe('Privada');
    expect(SKILLS_MESSAGES.noAliases).toBe('—');
    expect(SKILLS_MESSAGES.promote).toBe('Promover');
    expect(SKILLS_MESSAGES.promoteInfo).toBe(
      'Promover torna a skill global. Se a chave já existir como global, a promoção é recusada e a fusão é manual.',
    );
  });

  it('SKL-41 SKL-43 SKL-44 carries the texts of the empty state and the paging', () => {
    expect(SKILLS_MESSAGES.empty).toBe('Nenhuma skill encontrada.');
    expect(SKILLS_MESSAGES.clearFilters).toBe('Limpar filtros');
    expect(SKILLS_MESSAGES.loadMore).toBe('Carregar mais');
  });

  it('SKL-47 SKL-49 SKL-73 carries the three conflict messages word for word', () => {
    expect(SKILLS_MESSAGES.promoteConflict).toBe('Já existe uma skill global com esse nome ou apelido. A fusão é manual.');
    expect(SKILLS_MESSAGES.aliasConflict).toBe('Esse apelido já pertence a outra skill.');
    expect(SKILLS_MESSAGES.nameConflict).toBe('Já existe uma skill ou apelido com esse nome.');
  });

  it('SKL-72 SKL-74 carries the texts of the edit and aliases dialogs', () => {
    expect(SKILLS_MESSAGES.editTitle).toBe('Editar skill');
    expect(SKILLS_MESSAGES.edit).toBe('Editar');
    expect(SKILLS_MESSAGES.aliases).toBe('Apelidos');
    expect(SKILLS_MESSAGES.remove).toBe('Remover');
    expect(SKILLS_MESSAGES.noAliasesInDialog).toBe('Esta skill não tem apelidos.');
  });
});

describe('message builders', () => {
  it('SKL-40 names the row menu button after the skill', () => {
    expect(rowMenuLabel('Skill Fictícia Alfa')).toBe('Ações de Skill Fictícia Alfa');
  });

  it('SKL-45 titles the promote dialog with the skill and says who sees it and that it stays', () => {
    expect(promoteTitle('Skill Fictícia Alfa')).toBe('Promover Skill Fictícia Alfa?');
    expect(PROMOTE_DESCRIPTION).toContain('visível para todas as pessoas');
    expect(PROMOTE_DESCRIPTION).toContain('não se desfaz por aqui');
  });

  it('SKL-74 titles the aliases dialog with the skill', () => {
    expect(aliasesTitle('Skill Fictícia Alfa')).toBe('Apelidos de Skill Fictícia Alfa');
  });

  it('SKL-76 titles the remove dialog with the alias and says the search stops finding the skill', () => {
    expect(removeAliasTitle('alfa')).toBe('Remover o apelido alfa?');
    expect(REMOVE_ALIAS_DESCRIPTION).toContain('A busca por esse apelido deixa de achar a skill');
  });
});
