import type { AdminSkill } from '@am/contracts';
import { Button, ConfirmDialog, DropdownMenu, ListPage } from '@am/ui';
import { Ellipsis } from 'lucide-react';
import { CATEGORY_LABELS } from '../model/categories';
import { PROMOTE_DESCRIPTION, promoteTitle, rowMenuLabel, SKILLS_MESSAGES } from '../model/messages';

export interface SkillRowProps {
  skill: AdminSkill;
  /** Runs when the promotion is confirmed; the dialog waits for the promise before it closes (SKL-50). */
  onPromote: (skill: AdminSkill) => Promise<unknown>;
  onEdit: (skill: AdminSkill) => void;
  onAliases: (skill: AdminSkill) => void;
}

/**
 * One skill of the catalog (SKL-40): the official name, the "Privada" badge, the aliases or "—", the
 * category, and then the one action the skill allows: "Promover" for a private one, the "⋯" menu with
 * "Editar" and "Apelidos" for a global one (AD-014: a private skill has no aliases and no menu).
 */
export function SkillRow({ skill, onPromote, onEdit, onAliases }: SkillRowProps) {
  const isPrivate = skill.scope === 'private';
  const aliases = isPrivate || skill.aliases.length === 0 ? SKILLS_MESSAGES.noAliases : skill.aliases.map((alias) => alias.alias).join(', ');

  return (
    <ListPage.Row data-skill-id={skill.id} tabIndex={-1} className="outline-none">
      <ListPage.RowText className="flex items-center gap-2">
        <span className="font-medium whitespace-nowrap">{skill.name}</span>
        {isPrivate ? (
          <span className="inline-flex h-5 items-center rounded-sm border border-border-strong px-1.5 text-caption font-medium whitespace-nowrap text-text">
            {SKILLS_MESSAGES.privateBadge}
          </span>
        ) : null}
        <span className="min-w-0 truncate text-caption text-text-muted">{aliases}</span>
      </ListPage.RowText>
      <ListPage.RowMeta>
        <span className="w-30 text-caption">{CATEGORY_LABELS[skill.category]}</span>
        <span className="flex w-22 justify-end">
          {isPrivate ? (
            <ConfirmDialog
              trigger={
                <Button intent="secondary" size="sm">
                  {SKILLS_MESSAGES.promote}
                </Button>
              }
              title={promoteTitle(skill.name)}
              description={PROMOTE_DESCRIPTION}
              confirmLabel={SKILLS_MESSAGES.promote}
              cancelLabel="Cancelar"
              confirmIntent="primary"
              onConfirm={() => onPromote(skill)}
            />
          ) : (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  intent="ghost"
                  size="sm"
                  icon={Ellipsis}
                  aria-label={rowMenuLabel(skill.name)}
                  data-row-menu=""
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item onSelect={() => onEdit(skill)}>{SKILLS_MESSAGES.edit}</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={() => onAliases(skill)}>{SKILLS_MESSAGES.aliases}</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </span>
      </ListPage.RowMeta>
    </ListPage.Row>
  );
}
