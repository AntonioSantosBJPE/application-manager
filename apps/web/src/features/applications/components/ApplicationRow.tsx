import type { ApplicationSummary } from '@am/contracts';
import { Icon, ListPage, PipelineStatus, SkillTag } from '@am/ui';
import { Clock } from 'lucide-react';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { relativeDays } from '../model/dates';
import { LEVEL_LABELS, NO_WORK_MODEL_LABEL, STATUS_LABELS, WORK_MODEL_LABELS } from '../model/labels';
import { APPLICATIONS_MESSAGES } from '../model/messages';
import { rowSkills } from '../model/row-skills';

export interface ApplicationRowProps extends Omit<ComponentProps<'li'>, 'children' | 'onClick'> {
  application: ApplicationSummary;
  /** The instant "hoje" and "há N d" count from; it comes from the loader, never from a clock in here. */
  now: Date;
  /** Opens the application (APP-49): a click on the row or on the company and the title. */
  onOpen: (id: string) => void;
  /** The "⋯" menu of the row, drawn after the last activity (APP-50). */
  actions?: ReactNode;
}

/** The address of the detail; a click is handled in place, the `href` serves a new tab and the keyboard. */
export const applicationPath = (id: string) => `/applications/${id}`;

/**
 * One application of the list (APP-44): the status icon named after the status, the company and the
 * title, "sem retorno?" in `warning` when the api suggests it, two skills, the level, the work model or
 * "—" and the last activity. Below `md` only the status, the company, the title and the activity stay
 * (APP-56). There is no resume coverage column (AD-017).
 */
export function ApplicationRow({ application, now, onOpen, actions, className, ...rest }: ApplicationRowProps) {
  const skills = rowSkills(application.skills);

  function open(event: MouseEvent<HTMLElement>) {
    // A click inside the row's own link is the link's; a click that bubbles out of a portaled menu comes
    // from outside the row in the DOM, and is the menu's.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if ((event.target as HTMLElement).closest('a, button, [role="menu"]') !== null) return;
    onOpen(application.id);
  }

  return (
    <ListPage.Row
      data-application-id={application.id}
      className={['cursor-pointer', className].filter(Boolean).join(' ')}
      {...rest}
      onClick={open}
    >
      <ListPage.RowText className="flex items-center gap-2">
        <PipelineStatus status={application.status} label={STATUS_LABELS[application.status]} iconOnly />
        <a
          href={applicationPath(application.id)}
          className="text-body-strong whitespace-nowrap text-text outline-focus focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={(event) => {
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onOpen(application.id);
          }}
        >
          {application.company}
        </a>
        <span className="min-w-0 truncate text-text-muted">{application.title}</span>
      </ListPage.RowText>
      <ListPage.RowMeta>
        {application.ghostSuggested ? (
          <span className="hidden items-center gap-1 text-warning md:inline-flex">
            <Icon icon={Clock} size="sm" />
            <span className="text-caption">{APPLICATIONS_MESSAGES.ghost}</span>
          </span>
        ) : null}
        <span className="hidden items-center gap-1 md:flex">
          {skills.map((skill) => (
            <SkillTag key={skill.id} variant={skill.requirement === 'required' ? 'required' : 'nice'}>
              {skill.name}
            </SkillTag>
          ))}
        </span>
        <span className="hidden w-14 text-caption md:inline">{LEVEL_LABELS[application.level]}</span>
        <span className="hidden w-18 text-caption md:inline">
          {application.workModel === null ? NO_WORK_MODEL_LABEL : WORK_MODEL_LABELS[application.workModel]}
        </span>
        <span className="w-16 text-right font-mono text-caption">{relativeDays(application.lastActivityAt, now)}</span>
        {actions}
      </ListPage.RowMeta>
    </ListPage.Row>
  );
}
