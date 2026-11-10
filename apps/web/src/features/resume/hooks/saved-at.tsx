import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

/** The time of day as `HH:MM`, read in the zone of the browser that saved (RES-44). */
export function formatClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface SavedAtValue {
  /** `HH:MM` of the last save that worked, or `null` until one did in this browser. */
  time: string | null;
  /** Records now as the time of the last save that worked. */
  markSaved: () => void;
}

/** Without a provider nothing is shown and nothing is recorded, so a field works alone in a test. */
export const SavedAtContext = createContext<SavedAtValue>({ time: null, markSaved: () => {} });

/**
 * Holds the time of the last save that worked. It starts empty on the server and on the first render of
 * the client, and only a save made in this browser fills it, so the time is never the server's (RES-44).
 */
export function SavedAtProvider({ children }: { children: ReactNode }) {
  const [time, setTime] = useState<string | null>(null);
  const markSaved = useCallback(() => setTime(formatClock(new Date())), []);
  const value = useMemo(() => ({ time, markSaved }), [time, markSaved]);
  return <SavedAtContext.Provider value={value}>{children}</SavedAtContext.Provider>;
}

/** The `HH:MM` of the last save that worked, or `null` (RES-44). */
export function useSavedAt(): string | null {
  return useContext(SavedAtContext).time;
}
