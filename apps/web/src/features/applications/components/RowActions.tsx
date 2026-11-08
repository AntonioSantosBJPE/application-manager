import { applicationStatusSchema, type ApplicationStatus, type ApplicationSummary, type JobLevel } from '@am/contracts';
import { Button, ContextMenu, DropdownMenu } from '@am/ui';
import { Ellipsis } from 'lucide-react';
import { LEVEL_LABELS, LEVEL_ORDER, STATUS_LABELS } from '../model/labels';
import { rowActionsLabel } from '../model/messages';
import { ApplicationRow, type ApplicationRowProps } from './ApplicationRow';

/** What both menus share: submenus, the radio group and its items have the same parts in either kit. */
type MenuKit = Pick<typeof DropdownMenu, 'Sub' | 'SubTrigger' | 'SubContent' | 'RadioGroup' | 'RadioItem'>;

const STATUSES = applicationStatusSchema.options;

interface RowMenuItemsProps {
  kit: MenuKit;
  application: ApplicationSummary;
  onStatus: (status: ApplicationStatus) => void;
  onLevel: (level: JobLevel) => void;
}

/**
 * The content of the row menu, the same in the "⋯" button and in the right click (APP-50): the submenus
 * "Status" (the eight statuses by their singular label) and "Nível" (the five levels), each with the
 * current value marked. Choosing the value already on the row writes nothing.
 */
function RowMenuItems({ kit, application, onStatus, onLevel }: RowMenuItemsProps) {
  return (
    <>
      <kit.Sub>
        <kit.SubTrigger>Status</kit.SubTrigger>
        <kit.SubContent>
          <kit.RadioGroup
            value={application.status}
            onValueChange={(value) => {
              if (value !== application.status) onStatus(value as ApplicationStatus);
            }}
          >
            {STATUSES.map((status) => (
              <kit.RadioItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </kit.RadioItem>
            ))}
          </kit.RadioGroup>
        </kit.SubContent>
      </kit.Sub>
      <kit.Sub>
        <kit.SubTrigger>Nível</kit.SubTrigger>
        <kit.SubContent>
          <kit.RadioGroup
            value={application.level}
            onValueChange={(value) => {
              if (value !== application.level) onLevel(value as JobLevel);
            }}
          >
            {LEVEL_ORDER.map((level) => (
              <kit.RadioItem key={level} value={level}>
                {LEVEL_LABELS[level]}
              </kit.RadioItem>
            ))}
          </kit.RadioGroup>
        </kit.SubContent>
      </kit.Sub>
    </>
  );
}

export interface RowActionsProps extends Omit<ApplicationRowProps, 'actions'> {
  /** Writes a new status for the application; the list shows the answer of the api (APP-50). */
  onStatus: (application: ApplicationSummary, status: ApplicationStatus) => void;
  /** Writes a new level for the application. */
  onLevel: (application: ApplicationSummary, level: JobLevel) => void;
}

/**
 * A row of the list with its menu (APP-50): the "⋯" button named "Ações de {empresa}" and the right
 * click on the row open the same content, so status and level change without leaving the list.
 */
export function RowActions({ application, onStatus, onLevel, ...row }: RowActionsProps) {
  const items = {
    application,
    onStatus: (status: ApplicationStatus) => onStatus(application, status),
    onLevel: (level: JobLevel) => onLevel(application, level),
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <ApplicationRow
          application={application}
          actions={
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button intent="ghost" size="sm" icon={Ellipsis} aria-label={rowActionsLabel(application.company)} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <RowMenuItems kit={DropdownMenu} {...items} />
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          }
          {...row}
        />
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <RowMenuItems kit={ContextMenu} {...items} />
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
