import { useSavedAt } from '../hooks/saved-at';
import { RESUME_MESSAGES } from '../model/messages';

/**
 * "Salvo às HH:MM" in the topbar, the time of the last save that worked in this browser (RES-44). The
 * region is always there, so a screen reader hears the sentence when it appears.
 */
export function SavedAt() {
  const time = useSavedAt();
  return (
    <span role="status" className="text-caption text-text-muted">
      {time === null ? null : (
        <>
          {RESUME_MESSAGES.savedAt} <span className="font-mono">{time}</span>
        </>
      )}
    </span>
  );
}
