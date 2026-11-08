import {
  LOCATION_MAX_LENGTH,
  URL_MAX_LENGTH,
  applicationStatusSchema,
  type ApplicationDetail,
  type ApplicationStatus,
  type JobLevel,
  type UpdateJobPostingRequest,
  type WorkModel,
} from '@am/contracts';
import { Button, DetailPage, DropdownMenu, InlineEdit, PipelineStatus } from '@am/ui';
import type { ReactNode } from 'react';
import { longDate } from '../model/dates';
import {
  LEVEL_LABELS,
  LEVEL_ORDER,
  NO_WORK_MODEL_LABEL,
  STATUS_LABELS,
  WORK_MODEL_LABELS,
  WORK_MODEL_ORDER,
} from '../model/labels';
import { DETAIL_MESSAGES, propertyLabel } from '../model/messages';

const STATUSES = applicationStatusSchema.options;
const NO_MODEL = 'none';

export interface PropertiesSidebarProps {
  application: ApplicationDetail;
  /** Writes a new status; the screen shows what the api answers (APP-68). */
  onStatus: (status: ApplicationStatus) => void;
  /** Writes some fields of the posting; `null` clears an optional one. */
  onPosting: (body: UpdateJobPostingRequest) => void;
  /** The description block, which owns its own "Ver texto completo". */
  description?: ReactNode;
  /** What closes the column: the "Excluir candidatura" control. */
  footer: ReactNode;
}

/** The trigger of a property menu: a button that reads like the value and fills the row. */
function ValueButton({ name, value, children }: { name: string; value: string; children: ReactNode }) {
  return (
    <DropdownMenu.Trigger asChild>
      <Button
        intent="ghost"
        size="sm"
        aria-label={propertyLabel(name, value)}
        className="w-full justify-start px-0! font-normal hover:bg-transparent!"
      >
        {children}
      </Button>
    </DropdownMenu.Trigger>
  );
}

/**
 * The properties column of the detail (APP-68): status, level and work model change through a menu on
 * the value, local and link in place (`Enter` or leaving the field writes, `Esc` cancels), and the
 * dates are only read. Choosing what is already there, or leaving a field as it was, writes nothing;
 * an emptied field is sent as `null`.
 */
export function PropertiesSidebar({ application, onStatus, onPosting, description, footer }: PropertiesSidebarProps) {
  const { status, level, workModel, location, url } = application;
  const workModelLabel = workModel === null ? NO_WORK_MODEL_LABEL : WORK_MODEL_LABELS[workModel];

  function commit(field: 'location' | 'url', saved: string | null, text: string) {
    const next = text.trim();
    if (next === (saved ?? '')) return;
    onPosting({ [field]: next === '' ? null : next });
  }

  return (
    <DetailPage.Sidebar aria-label={DETAIL_MESSAGES.properties}>
      <DetailPage.Properties>
        <DetailPage.Property name={DETAIL_MESSAGES.status}>
          <DropdownMenu.Root>
            <ValueButton name={DETAIL_MESSAGES.status} value={STATUS_LABELS[status]}>
              <PipelineStatus status={status} label={STATUS_LABELS[status]} />
            </ValueButton>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup
                value={status}
                onValueChange={(value) => {
                  if (value !== status) onStatus(value as ApplicationStatus);
                }}
              >
                {STATUSES.map((item) => (
                  <DropdownMenu.RadioItem key={item} value={item}>
                    {STATUS_LABELS[item]}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </DetailPage.Property>
        <DetailPage.Property name={DETAIL_MESSAGES.level}>
          <DropdownMenu.Root>
            <ValueButton name={DETAIL_MESSAGES.level} value={LEVEL_LABELS[level]}>
              {LEVEL_LABELS[level]}
            </ValueButton>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup
                value={level}
                onValueChange={(value) => {
                  if (value !== level) onPosting({ level: value as JobLevel });
                }}
              >
                {LEVEL_ORDER.map((item) => (
                  <DropdownMenu.RadioItem key={item} value={item}>
                    {LEVEL_LABELS[item]}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </DetailPage.Property>
        <DetailPage.Property name={DETAIL_MESSAGES.workModel}>
          <DropdownMenu.Root>
            <ValueButton name={DETAIL_MESSAGES.workModel} value={workModelLabel}>
              {workModelLabel}
            </ValueButton>
            <DropdownMenu.Content>
              <DropdownMenu.RadioGroup
                value={workModel ?? NO_MODEL}
                onValueChange={(value) => {
                  if (value === (workModel ?? NO_MODEL)) return;
                  onPosting({ workModel: value === NO_MODEL ? null : (value as WorkModel) });
                }}
              >
                <DropdownMenu.RadioItem value={NO_MODEL}>{NO_WORK_MODEL_LABEL}</DropdownMenu.RadioItem>
                {WORK_MODEL_ORDER.map((item) => (
                  <DropdownMenu.RadioItem key={item} value={item}>
                    {WORK_MODEL_LABELS[item]}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </DetailPage.Property>
        <DetailPage.Property name={DETAIL_MESSAGES.location}>
          <InlineEdit
            label={DETAIL_MESSAGES.editLocation}
            value={location ?? ''}
            emptyText={DETAIL_MESSAGES.empty}
            maxLength={LOCATION_MAX_LENGTH}
            onCommit={(text) => commit('location', location, text)}
          />
        </DetailPage.Property>
        <DetailPage.Property name={DETAIL_MESSAGES.posting}>
          <InlineEdit
            label={DETAIL_MESSAGES.editPosting}
            value={url ?? ''}
            emptyText={DETAIL_MESSAGES.empty}
            maxLength={URL_MAX_LENGTH}
            className={url === null ? undefined : 'text-accent-text!'}
            onCommit={(text) => commit('url', url, text)}
          />
        </DetailPage.Property>
        <DetailPage.Property name={DETAIL_MESSAGES.createdAt}>
          <span className="font-mono">{longDate(application.createdAt)}</span>
        </DetailPage.Property>
        <DetailPage.Property name={DETAIL_MESSAGES.activity}>
          <span className={`font-mono${application.ghostSuggested ? ' text-warning' : ''}`}>
            {longDate(application.lastActivityAt)}
          </span>
        </DetailPage.Property>
      </DetailPage.Properties>
      {description === undefined ? null : (
        <>
          <hr className="border-border" />
          {description}
        </>
      )}
      <hr className="border-border" />
      {footer}
    </DetailPage.Sidebar>
  );
}
