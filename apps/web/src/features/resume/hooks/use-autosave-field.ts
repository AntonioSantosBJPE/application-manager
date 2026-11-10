import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import { RESUME_MESSAGES } from '../model/messages';
import { SavedAtContext } from './saved-at';

export interface AutosaveOptions<T> {
  /** The value saved so far. The caller owns it and updates it from what `save` writes. */
  saved: T;
  /** The message to show for a value that must not be sent, or `null` when it may be (RES-47). */
  validate?: (value: T) => string | null;
  /** Writes the value and answers how it went. A call that throws counts as a failure. */
  save: (value: T) => Promise<Outcome<unknown>>;
  /** Whether two values are the same one; `Object.is` by default. */
  equals?: (a: T, b: T) => boolean;
}

export interface AutosaveField<T> {
  /** What the field shows: what was typed, or the saved value while nothing was typed. */
  value: T;
  setValue: (next: T) => void;
  /** The message under the field, or `null`. It stays until the next attempt works or the value goes back to the saved one. */
  error: string | null;
  /** A save is in flight. */
  saving: boolean;
  /** The field was left (or confirmed): saves `next`, or the value in the field when none is given (RES-44). */
  commit: (next?: T) => Promise<void>;
}

/**
 * The save of one field, on leaving it (AD of the spec: "salva ao sair do campo"). A value equal to the
 * saved one sends nothing (RES-45); an invalid one shows its error and sends nothing (RES-47); a save that
 * works tells `SavedAtContext` (RES-44); one that fails keeps the value in the field and says so, and leaving
 * the field again tries again (RES-48). While a save is in flight a second one waits for it and then sends
 * only the last value, so two quick blurs never race.
 */
export function useAutosaveField<T>({ saved, validate, save, equals = Object.is }: AutosaveOptions<T>): AutosaveField<T> {
  const { markSaved } = useContext(SavedAtContext);
  const [state, setState] = useState({ saved, draft: saved });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The saved value the caller gives follows into the field while nothing was typed over it.
  if (!equals(state.saved, saved)) {
    setState({ saved, draft: equals(state.draft, state.saved) ? saved : state.draft });
  }

  const latest = useRef({ draft: state.draft, saved, validate, save, equals, markSaved });
  const inFlight = useRef<Promise<void> | null>(null);
  const waiting = useRef<{ value: T } | null>(null);

  useEffect(() => {
    latest.current = { ...latest.current, draft: state.draft, validate, save, equals, markSaved };
  });
  useEffect(() => {
    latest.current.saved = saved;
  }, [saved]);

  const setValue = useCallback((next: T) => {
    latest.current.draft = next;
    setState((current) => ({ ...current, draft: next }));
  }, []);

  const run = useCallback(async (first: T) => {
    let value = first;
    setSaving(true);
    for (;;) {
      let outcome: Outcome<unknown>;
      try {
        outcome = await latest.current.save(value);
      } catch {
        outcome = { ok: false, status: 503 };
      }
      if (outcome.ok) {
        latest.current.saved = value;
        setError(null);
        latest.current.markSaved();
      } else {
        // Whatever the failure, the field says the same pt-BR phrase; the api's English `detail` is never shown (RES-48).
        setError(RESUME_MESSAGES.saveFailed);
      }
      const next = waiting.current;
      waiting.current = null;
      if (next === null) break;
      // What waited is the last value typed; it goes out only if it differs from what is saved and is valid.
      if (latest.current.equals(next.value, latest.current.saved)) {
        if (outcome.ok) break;
        setError(null);
        break;
      }
      const invalid = latest.current.validate?.(next.value) ?? null;
      if (invalid !== null) {
        setError(invalid);
        break;
      }
      value = next.value;
    }
    setSaving(false);
    inFlight.current = null;
  }, []);

  const commit = useCallback(
    async (next?: T) => {
      const value = next === undefined ? latest.current.draft : next;
      latest.current.draft = value;
      if (inFlight.current !== null) {
        waiting.current = { value };
        return inFlight.current;
      }
      if (latest.current.equals(value, latest.current.saved)) {
        setError(null);
        return;
      }
      const invalid = latest.current.validate?.(value) ?? null;
      if (invalid !== null) {
        setError(invalid);
        return;
      }
      inFlight.current = run(value);
      return inFlight.current;
    },
    [run],
  );

  return { value: state.draft, setValue, error, saving, commit };
}
