import type {
  ApplicationDetail as ApplicationRecord,
  ApplicationStatus,
  PostingSkill,
  UpdateJobPostingRequest,
} from '@am/contracts';
import { Alert, AppShell, Button, DetailPage, Field, Icon, SkillTag } from '@am/ui';
import { ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Outcome } from '../../../lib/bff';
import { MESSAGES, problemMessage } from '../../identity';
import { DETAIL_MESSAGES } from '../model/messages';
import { PropertiesSidebar } from './PropertiesSidebar';

/** What the detail needs from the BFF; the route binds the server functions, a test binds the api. */
export interface ApplicationDetailApi {
  changeStatus: (id: string, status: ApplicationStatus) => Promise<Outcome<ApplicationRecord>>;
  updatePosting: (id: string, body: UpdateJobPostingRequest) => Promise<Outcome<ApplicationRecord>>;
}

export interface ApplicationDetailProps {
  application: ApplicationRecord;
  api: ApplicationDetailApi;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** An application was written, so the rest of the app (the list) reads again. */
  onChanged?: () => void;
  /** Where the "Candidaturas" of the breadcrumb leads. */
  listHref?: string;
  /** Opens the list without a page load; a click with a modifier key keeps its own meaning. */
  onOpenList?: () => void;
}

/** The lines of the description the sidebar shows before "Ver texto completo" (APP-76). */
const DESCRIPTION_LINES = 6;

/** The link back to the list: a plain anchor, taken over by the router when the route passes `onOpenList`. */
export function ListLink({
  href = '/applications',
  onOpenList,
  children,
}: {
  href?: string;
  onOpenList?: () => void;
  children: string;
}) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (onOpenList === undefined || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onOpenList();
  }
  return (
    <a
      href={href}
      onClick={open}
      className="rounded-sm text-text-muted outline-focus hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </a>
  );
}

function SkillRow({ label, skills, requirement }: { label: string; skills: PostingSkill[]; requirement: 'required' | 'nice' }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-22 shrink-0 pt-0.5 text-label text-text-muted">{label}</span>
      <ul aria-label={label} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {skills.map((skill) => (
          <li key={skill.id}>
            <SkillTag variant={skill.scope === 'private' ? 'private' : requirement}>{skill.name}</SkillTag>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The description in the sidebar: the first six lines with "Ver texto completo" when the text is longer,
 * which shows it all. Whether it is longer is measured on the page, so the link follows the width.
 */
function Description({ text }: { text: string }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const hasManyLines = text.split('\n').length > DESCRIPTION_LINES;
  const [cut, setCut] = useState(hasManyLines);

  useEffect(() => {
    if (expanded) return;
    function measure() {
      const element = paragraph.current;
      if (element !== null) setCut(hasManyLines || element.scrollHeight > element.clientHeight);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, expanded, hasManyLines]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-label text-text-muted">{DETAIL_MESSAGES.description}</span>
      <p
        ref={paragraph}
        className={`text-caption whitespace-pre-line text-text-muted wrap-anywhere${expanded ? '' : ' line-clamp-6'}`}
      >
        {text}
      </p>
      {cut && !expanded ? (
        <Button intent="ghost" size="sm" className="self-start px-0 text-accent-text" onClick={() => setExpanded(true)}>
          {DETAIL_MESSAGES.showAll}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The detail of an application (PageApplicationDetail, APP-66, APP-67, APP-76): the breadcrumb and the
 * posting link in the topbar, the company and title, the skills, the timeline, and the properties at
 * the side, which go under the content when narrow. The resume section of the card is not here (AD-017).
 */
export function ApplicationDetail({ application, api, onExpired, onChanged, listHref, onOpenList }: ApplicationDetailProps) {
  const [current, setCurrent] = useState(application);
  const [seen, setSeen] = useState(application);
  const [failure, setFailure] = useState<string | undefined>();
  // A new answer of the route (the loader read again) replaces what the screen holds.
  if (application !== seen) {
    setSeen(application);
    setCurrent(application);
  }

  /** Runs a write that answers the application; on failure the screen keeps its value and says why (APP-78). */
  async function save(action: () => Promise<Outcome<ApplicationRecord>>) {
    setFailure(undefined);
    let outcome: Outcome<ApplicationRecord>;
    try {
      outcome = await action();
    } catch {
      setFailure(MESSAGES.unavailable);
      return;
    }
    if (outcome.ok) {
      setCurrent(outcome.data);
      onChanged?.();
      return;
    }
    if (onExpired(outcome)) return;
    setFailure(problemMessage(outcome));
  }

  const required = current.skills.filter((skill) => skill.requirement === 'required');
  const nice = current.skills.filter((skill) => skill.requirement === 'nice_to_have');
  const id = current.id;

  return (
    <DetailPage.Root className="md:flex-col!">
      <AppShell.Topbar>
        <nav aria-label={DETAIL_MESSAGES.breadcrumb} className="flex min-w-0 items-center gap-1 text-body">
          <ListLink href={listHref} onOpenList={onOpenList}>
            {DETAIL_MESSAGES.list}
          </ListLink>
          <Icon icon={ChevronRight} size="sm" />
          <b className="truncate font-medium text-text">{current.company}</b>
        </nav>
        {current.url === null ? null : (
          <Button asChild intent="ghost" size="sm" className="w-control-sm justify-center px-0!" aria-label={DETAIL_MESSAGES.openPosting}>
            <a href={current.url} target="_blank" rel="noopener noreferrer">
              <Icon icon={ExternalLink} size="sm" />
            </a>
          </Button>
        )}
      </AppShell.Topbar>
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <DetailPage.Main>
          {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
          <div className="flex flex-col gap-1">
            <span className="text-text-muted">{current.company}</span>
            <h1 className="text-heading-lg">{current.title}</h1>
          </div>
          <section aria-labelledby="detail-skills" className="flex flex-col gap-3">
            <h2 id="detail-skills" className="text-heading-sm">
              {DETAIL_MESSAGES.skills}
            </h2>
            <div className="flex flex-col gap-1.5">
              <SkillRow label={DETAIL_MESSAGES.required} skills={required} requirement="required" />
              <SkillRow label={DETAIL_MESSAGES.nice} skills={nice} requirement="nice" />
            </div>
          </section>
          <section aria-labelledby="detail-timeline" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 id="detail-timeline" className="text-heading-sm">
                {DETAIL_MESSAGES.timeline}
              </h2>
              <Button intent="ghost" size="sm" icon={Plus}>
                {DETAIL_MESSAGES.addStage}
              </Button>
            </div>
            <Field.Root>
              <Field.Textarea
                aria-label={DETAIL_MESSAGES.notePlaceholder}
                placeholder={DETAIL_MESSAGES.notePlaceholder}
                rows={2}
              />
            </Field.Root>
          </section>
        </DetailPage.Main>
        <PropertiesSidebar
          application={current}
          onStatus={(status) => void save(() => api.changeStatus(id, status))}
          onPosting={(body) => void save(() => api.updatePosting(id, body))}
          description={
            current.description === null || current.description.trim() === '' ? undefined : (
              <Description text={current.description} />
            )
          }
          footer={
            <Button intent="ghost" size="sm" icon={Trash2} className="justify-start text-danger">
              {DETAIL_MESSAGES.delete}
            </Button>
          }
        />
      </div>
    </DetailPage.Root>
  );
}
