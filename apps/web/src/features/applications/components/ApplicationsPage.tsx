import type { ApplicationStatus } from '@am/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import { DEFAULT_APPLICATIONS_FILTERS, type ApplicationsFilters } from '../model/filters';
import { ApplicationFormDialog, type ApplicationFormApi } from './ApplicationFormDialog';
import { APPLICATIONS_QUERY_KEY, ApplicationsList, type ApplicationsListApi } from './ApplicationsList';

export type ApplicationsPageApi = ApplicationsListApi & ApplicationFormApi;

export interface ApplicationsPageProps {
  api: ApplicationsPageApi;
  /** The filters the address holds; `new=1` opens the dialog on arrival (APP-83). */
  filters?: ApplicationsFilters;
  now: Date;
  onFiltersChange: (filters: ApplicationsFilters) => void;
  onOpen: (id: string) => void;
  /** Called after an application was created, so the rest of the page (the sidebar total) reads again. */
  onCreated?: () => void;
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

/** The person is typing, or choosing in a menu or dialog: a letter there is not a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  return target.closest('[role="menu"], [role="dialog"], [role="listbox"]') !== null;
}

/**
 * The applications page: the list and, over it, the dialog of a new application. The dialog opens from
 * "Nova candidatura", from the "+" of a group (in that status), from the `C` key when the focus is not in
 * a field, and on arrival when the address has `new=1`, which leaves the address when the dialog closes
 * (APP-57, APP-58, APP-83).
 */
export function ApplicationsPage({
  api,
  filters = DEFAULT_APPLICATIONS_FILTERS,
  now,
  onFiltersChange,
  onOpen,
  onCreated,
  onExpired,
}: ApplicationsPageProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState<{ status?: ApplicationStatus } | null>(
    filters.newApplication ? {} : null,
  );

  // `new=1` can also arrive while the page is already open: the dialog opens when the address changes to it.
  const [sawNew, setSawNew] = useState(filters.newApplication);
  if (filters.newApplication !== sawNew) {
    setSawNew(filters.newApplication);
    if (filters.newApplication && creating === null) setCreating({});
  }

  useEffect(() => {
    if (creating !== null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'c' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (event.defaultPrevented || event.isComposing || isTyping(event.target)) return;
      event.preventDefault();
      setCreating({});
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [creating]);

  function closeDialog() {
    setCreating(null);
    if (filters.newApplication) onFiltersChange({ ...filters, newApplication: false });
  }

  return (
    <>
      <ApplicationsList
        api={api}
        filters={filters}
        now={now}
        onFiltersChange={onFiltersChange}
        onNew={(status) => setCreating({ status })}
        onOpen={onOpen}
        onExpired={onExpired}
      />
      {creating === null ? null : (
        <ApplicationFormDialog
          status={creating.status}
          api={api}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
            onCreated?.();
          }}
          onClose={closeDialog}
          onExpired={onExpired}
        />
      )}
    </>
  );
}
