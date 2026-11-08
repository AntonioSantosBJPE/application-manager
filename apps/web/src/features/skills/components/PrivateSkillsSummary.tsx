import type { AdminSkillsPage } from '@am/contracts';
import { Alert, DashboardPage, SkillTag } from '@am/ui';
import { ArrowRight } from 'lucide-react';
import { useId, type ReactElement } from 'react';
import { MESSAGES } from '../../identity';
import type { Outcome } from '../../../lib/bff';

/** How many private skills the widget names; the rest is counted as "e mais N". */
export const SUMMARY_LIMIT = 8;

export interface PrivateSkillsSummaryProps {
  /** The first page of `GET /admin/skills?scope=private`: the api decides the order and the counts. */
  result: Outcome<AdminSkillsPage>;
  /** The "Abrir catálogo" link to the catalog filtered by private skills; the route passes its own router link. */
  link: ReactElement;
}

/**
 * The private skills widget of the admin dashboard (SKL-55..SKL-57): up to eight private `SkillTag`s in
 * the order the api answers (alphabetical) and "e mais N" for the rest, or the sentence that nothing
 * waits. A read that failed shows a `danger` alert and keeps the action, so the other widgets of the
 * dashboard are not affected.
 */
export function PrivateSkillsSummary({ result, link }: PrivateSkillsSummaryProps) {
  const titleId = useId();
  const shown = result.ok ? result.data.items.slice(0, SUMMARY_LIMIT) : [];
  const more = result.ok ? result.data.counts.private - shown.length : 0;

  return (
    <DashboardPage.Widget span={12} role="group" aria-labelledby={titleId}>
      <DashboardPage.Widget.Header>
        <DashboardPage.Widget.Title id={titleId}>
          Skills privadas aguardando promoção
        </DashboardPage.Widget.Title>
        <DashboardPage.Widget.Action asChild iconEnd={ArrowRight}>
          {link}
        </DashboardPage.Widget.Action>
      </DashboardPage.Widget.Header>
      {!result.ok ? <Alert intent="danger">{MESSAGES.unavailable}</Alert> : null}
      {result.ok && shown.length === 0 ? (
        <p className="text-caption text-text-muted">Nenhuma skill privada aguardando promoção.</p>
      ) : null}
      {shown.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1">
          {shown.map((skill) => (
            <li key={skill.id}>
              <SkillTag variant="private">{skill.name}</SkillTag>
            </li>
          ))}
          {more > 0 ? <li className="text-caption text-text-muted">e mais {more}</li> : null}
        </ul>
      ) : null}
    </DashboardPage.Widget>
  );
}
