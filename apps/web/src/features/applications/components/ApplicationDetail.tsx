import type {
  ApplicationDetail as ApplicationRecord,
  ApplicationEvent,
  ApplicationStatus,
  CreateEventRequest,
  ReplaceSkillsRequest,
  UpdateJobPostingRequest,
} from '@am/contracts';
import { Alert, AppShell, Button, DetailPage, Icon } from '@am/ui';
import { ChevronRight, ExternalLink, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Outcome } from '../../../lib/bff';
import type { SkillsFieldApi } from '../../skills';
import { MESSAGES, problemMessage } from '../../identity';
import { DETAIL_MESSAGES } from '../model/messages';
import { ApplicationTimeline } from './ApplicationTimeline';
import { GhostAlert } from './GhostAlert';
import { DeleteApplication } from './DeleteApplication';
import { DetailActions } from './DetailActions';
import { NoteComposer } from './NoteComposer';
import { PropertiesSidebar } from './PropertiesSidebar';
import { SkillsSection } from './SkillsSection';
import { StageDialog } from './StageDialog';

/** What the detail needs from the BFF; the route binds the server functions, a test binds the api. */
export interface ApplicationDetailApi {
  /** Reads the detail again: the events come back in their order, with the activity the api computed. */
  load: (id: string) => Promise<Outcome<ApplicationRecord>>;
  addEvent: (id: string, body: CreateEventRequest) => Promise<Outcome<ApplicationEvent>>;
  replaceSkills: (id: string, body: ReplaceSkillsRequest) => Promise<Outcome<ApplicationRecord>>;
  remove: (id: string) => Promise<Outcome<undefined>>;
  snooze: (id: string) => Promise<Outcome<ApplicationRecord>>;
  /** The search and the creation of the skills field, as in the registration dialog. */
  skills: SkillsFieldApi;
  changeStatus: (id: string, status: ApplicationStatus) => Promise<Outcome<ApplicationRecord>>;
  updatePosting: (id: string, body: UpdateJobPostingRequest) => Promise<Outcome<ApplicationRecord>>;
}

export interface ApplicationDetailProps {
  application: ApplicationRecord;
  /** The instant the loader took, which "today" counts from in the stage dialog. */
  now: Date;
  api: ApplicationDetailApi;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** An application was written, so the rest of the app (the list) reads again. */
  onChanged?: () => void;
  /** The application was deleted: the route opens the list (APP-75). */
  onDeleted: () => void;
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
export function ApplicationDetail({
  application,
  now,
  api,
  onExpired,
  onChanged,
  onDeleted,
  listHref,
  onOpenList,
}: ApplicationDetailProps) {
  const [current, setCurrent] = useState(application);
  const [seen, setSeen] = useState(application);
  const [failure, setFailure] = useState<string | undefined>();
  const [staging, setStaging] = useState(false);
  const stageButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  // A new answer of the route (the loader read again) replaces what the screen holds.
  if (application !== seen) {
    setSeen(application);
    setCurrent(application);
  }

  /**
   * Runs a call of the api. A failure leaves the screen as it was and says why (APP-78); a `401` is the
   * login opening, so it says nothing. Answers the data, or undefined when the call did not work.
   */
  async function run<T>(action: () => Promise<Outcome<T>>): Promise<T | undefined> {
    setFailure(undefined);
    let outcome: Outcome<T>;
    try {
      outcome = await action();
    } catch {
      setFailure(MESSAGES.unavailable);
      return undefined;
    }
    if (outcome.ok) return outcome.data;
    if (!onExpired(outcome)) setFailure(problemMessage(outcome));
    return undefined;
  }

  /** A write that answers the application: the screen shows what the api answered. */
  async function save(action: () => Promise<Outcome<ApplicationRecord>>) {
    const saved = await run(action);
    if (saved === undefined) return;
    setCurrent(saved);
    onChanged?.();
  }

  /** A write that answers the event: the detail is read again so the timeline shows it where it belongs (APP-71). */
  async function record(body: CreateEventRequest): Promise<boolean> {
    if ((await run(() => api.addEvent(current.id, body))) === undefined) return false;
    onChanged?.();
    const reloaded = await run(() => api.load(current.id));
    if (reloaded !== undefined) setCurrent(reloaded);
    return true;
  }

  const id = current.id;

  /** Deletes for good and leaves the page; a refusal keeps the page and says why (APP-75, APP-78). */
  async function remove() {
    setFailure(undefined);
    let outcome: Outcome<undefined>;
    try {
      outcome = await api.remove(id);
    } catch {
      setFailure(MESSAGES.unavailable);
      return;
    }
    if (outcome.ok) {
      onChanged?.();
      onDeleted();
      return;
    }
    if (!onExpired(outcome)) setFailure(problemMessage(outcome));
  }

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
        <div className="flex items-center gap-1">
          {current.url === null ? null : (
            <Button asChild intent="ghost" size="sm" className="w-control-sm justify-center px-0!" aria-label={DETAIL_MESSAGES.openPosting}>
              <a href={current.url} target="_blank" rel="noopener noreferrer">
                <Icon icon={ExternalLink} size="sm" />
              </a>
            </Button>
          )}
          <DetailActions
            application={current}
            api={api}
            onUpdated={(updated) => {
              setCurrent(updated);
              onChanged?.();
            }}
            onDelete={() => deleteButton.current?.click()}
            onExpired={onExpired}
          />
        </div>
      </AppShell.Topbar>
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <DetailPage.Main>
          {current.ghostSuggested ? (
            <GhostAlert
              status={current.status}
              lastActivityAt={current.lastActivityAt}
              now={now}
              onSnooze={() => void save(() => api.snooze(id))}
              onGhost={() => void save(() => api.changeStatus(id, 'ghosted'))}
            />
          ) : null}
          {failure === undefined ? null : <Alert intent="danger">{failure}</Alert>}
          <div className="flex flex-col gap-1">
            <span className="text-text-muted">{current.company}</span>
            <h1 className="text-heading-lg">{current.title}</h1>
          </div>
          <SkillsSection
            skills={current.skills}
            api={api.skills}
            onChange={(body) => void save(() => api.replaceSkills(id, body))}
          />
          <section aria-labelledby="detail-timeline" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 id="detail-timeline" className="text-heading-sm">
                {DETAIL_MESSAGES.timeline}
              </h2>
              <Button ref={stageButton} intent="ghost" size="sm" icon={Plus} onClick={() => {
                  setFailure(undefined);
                  setStaging(true);
                }}>
                {DETAIL_MESSAGES.addStage}
              </Button>
            </div>
            <ApplicationTimeline events={current.events} createdAt={current.createdAt} />
            <NoteComposer onAdd={(note) => record({ kind: 'note', note })} />
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
          footer={<DeleteApplication company={current.company} buttonRef={deleteButton} onConfirm={remove} />}
        />
      </div>
      {staging ? (
        <StageDialog
          now={now}
          failure={failure}
          onSave={(body) => record(body)}
          onClose={() => setStaging(false)}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            stageButton.current?.focus();
          }}
        />
      ) : null}
    </DetailPage.Root>
  );
}
