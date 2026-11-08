import { AppShell, DetailPage, EmptyState } from '@am/ui';
import { DETAIL_MESSAGES } from '../model/messages';
import { ListLink } from './ApplicationDetail';

export interface ApplicationNotFoundProps {
  listHref?: string;
  onOpenList?: () => void;
}

/**
 * What `/applications/$id` shows when the application does not exist or belongs to someone else: the api
 * answers `404` for both, so the screen cannot tell them apart and does not try (APP-77).
 */
export function ApplicationNotFound({ listHref, onOpenList }: ApplicationNotFoundProps) {
  return (
    <DetailPage.Root className="md:flex-col!">
      <AppShell.Topbar>
        <ListLink href={listHref} onOpenList={onOpenList}>
          {DETAIL_MESSAGES.list}
        </ListLink>
      </AppShell.Topbar>
      <div className="p-6">
        <EmptyState.Root>
          <h1 className="text-body">{DETAIL_MESSAGES.notFound}</h1>
          <EmptyState.Action>
            <ListLink href={listHref} onOpenList={onOpenList}>
              {DETAIL_MESSAGES.backToList}
            </ListLink>
          </EmptyState.Action>
        </EmptyState.Root>
      </div>
    </DetailPage.Root>
  );
}
