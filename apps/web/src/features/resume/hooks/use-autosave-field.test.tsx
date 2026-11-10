// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Outcome } from '../../../lib/bff';
import { SavedAtProvider, useSavedAt } from './saved-at';
import { useAutosaveField } from './use-autosave-field';

const wrapper = ({ children }: { children: ReactNode }) => <SavedAtProvider>{children}</SavedAtProvider>;
const ok: Outcome<unknown> = { ok: true, data: undefined };
const failed = (status: number, detail?: string): Outcome<unknown> => ({
  ok: false,
  status,
  ...(detail === undefined ? {} : { problem: { type: 'about:blank', title: 'x', status, detail } }),
});

/** A save that waits until the test settles it, so a second blur can arrive while the first is in flight. */
function deferred() {
  const settle: { current: (outcome: Outcome<unknown>) => void } = { current: () => {} };
  const promise = new Promise<Outcome<unknown>>((resolve) => {
    settle.current = resolve;
  });
  return { promise, settle: (outcome: Outcome<unknown> = ok) => settle.current(outcome) };
}

function setup(options: {
  saved?: string;
  save?: (value: string) => Promise<Outcome<unknown>>;
  validate?: (value: string) => string | null;
}) {
  const save = vi.fn(options.save ?? (() => Promise.resolve(ok)));
  const hook = renderHook(
    ({ saved }: { saved: string }) => ({
      field: useAutosaveField({ saved, save, validate: options.validate }),
      time: useSavedAt(),
    }),
    { wrapper, initialProps: { saved: options.saved ?? 'Pessoa Fictícia Alfa' } },
  );
  return { ...hook, save };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutosaveField', () => {
  it('RES-45 sends nothing when the field is left with the saved value', async () => {
    const { result, save } = setup({});

    await act(() => result.current.field.commit());

    expect(save).not.toHaveBeenCalled();
    expect(result.current.time).toBeNull();
    expect(result.current.field.error).toBeNull();
  });

  it('RES-45 sends nothing when the value is typed back to the saved one', async () => {
    const { result, save } = setup({});

    act(() => result.current.field.setValue('Outro nome'));
    act(() => result.current.field.setValue('Pessoa Fictícia Alfa'));
    await act(() => result.current.field.commit());

    expect(save).not.toHaveBeenCalled();
  });

  it('RES-47 shows the error of an invalid value and sends nothing', async () => {
    const { result, save } = setup({ validate: (value) => (value.includes('@') ? null : 'E-mail inválido.') });

    act(() => result.current.field.setValue('sem-arroba'));
    await act(() => result.current.field.commit());

    expect(save).not.toHaveBeenCalled();
    expect(result.current.field.error).toBe('E-mail inválido.');
    expect(result.current.field.value).toBe('sem-arroba');
  });

  it('RES-44 saves a changed value once, clears the error and tells the context the time of the browser', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 10, 14, 32, 5) });
    const { result, save } = setup({ validate: () => null });

    act(() => result.current.field.setValue('Pessoa Fictícia Beta'));
    await act(() => result.current.field.commit());

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('Pessoa Fictícia Beta');
    expect(result.current.time).toBe('14:32');
    expect(result.current.field.error).toBeNull();
    expect(result.current.field.saving).toBe(false);
  });

  it('RES-44 saves the value passed to commit, as a field that confirms with Enter does', async () => {
    const { result, save } = setup({});

    await act(() => result.current.field.commit('Pessoa Fictícia Gama'));

    expect(save).toHaveBeenCalledWith('Pessoa Fictícia Gama');
    expect(result.current.field.value).toBe('Pessoa Fictícia Alfa');
  });

  it('RES-45 does not send again a value that was just saved, even before the caller updates the saved one', async () => {
    const { result, save } = setup({});

    act(() => result.current.field.setValue('Pessoa Fictícia Beta'));
    await act(() => result.current.field.commit());
    await act(() => result.current.field.commit());

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('RES-48 keeps the value, says the save failed and leaves the time as it was', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 10, 14, 32) });
    const { result, save } = setup({
      save: vi.fn().mockResolvedValueOnce(ok).mockResolvedValueOnce(failed(503)),
    });
    act(() => result.current.field.setValue('Pessoa Fictícia Beta'));
    await act(() => result.current.field.commit());
    expect(result.current.time).toBe('14:32');

    vi.setSystemTime(new Date(2026, 10, 10, 15, 10));
    act(() => result.current.field.setValue('Pessoa Fictícia Gama'));
    await act(() => result.current.field.commit());

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.field.error).toBe('Não foi possível salvar. Tente de novo.');
    expect(result.current.field.value).toBe('Pessoa Fictícia Gama');
    expect(result.current.time).toBe('14:32');
  });

  it('RES-48 treats a call that throws as a failure', async () => {
    const { result } = setup({ save: () => Promise.reject(new Error('rede')) });

    act(() => result.current.field.setValue('Pessoa Fictícia Beta'));
    await act(() => result.current.field.commit());

    expect(result.current.field.error).toBe('Não foi possível salvar. Tente de novo.');
    expect(result.current.field.value).toBe('Pessoa Fictícia Beta');
    expect(result.current.field.saving).toBe(false);
  });

  it('RES-48 leaving the field again tries again, and a save that works clears the error', async () => {
    const { result, save } = setup({
      save: vi.fn().mockResolvedValueOnce(failed(500)).mockResolvedValueOnce(ok),
    });
    act(() => result.current.field.setValue('Pessoa Fictícia Beta'));
    await act(() => result.current.field.commit());
    expect(result.current.field.error).not.toBeNull();

    await act(() => result.current.field.commit());

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('Pessoa Fictícia Beta');
    expect(result.current.field.error).toBeNull();
    expect(result.current.time).not.toBeNull();
  });

  it.each([400, 422])('RES-48 shows the pt-BR phrase, never the api detail, when the api refuses with %i', async (status) => {
    const { result } = setup({ save: () => Promise.resolve(failed(status, 'Invalid request body')) });

    act(() => result.current.field.setValue('Pessoa Fictícia Beta'));
    await act(() => result.current.field.commit());

    expect(result.current.field.error).toBe('Não foi possível salvar. Tente de novo.');
    expect(result.current.field.value).toBe('Pessoa Fictícia Beta');
    expect(result.current.time).toBeNull();
  });

  it('RES-48 clears the error when the value goes back to the saved one and the field is left', async () => {
    const { result } = setup({ save: () => Promise.resolve(failed(500)) });
    act(() => result.current.field.setValue('Pessoa Fictícia Beta'));
    await act(() => result.current.field.commit());
    expect(result.current.field.error).not.toBeNull();

    act(() => result.current.field.setValue('Pessoa Fictícia Alfa'));
    await act(() => result.current.field.commit());

    expect(result.current.field.error).toBeNull();
  });

  it('RES-44 a second send waits for the first and then sends only the last value', async () => {
    const first = deferred();
    const save = vi.fn((value: string) => (value === 'um' ? first.promise : Promise.resolve(ok)));
    const { result } = setup({ save });

    let pending: Promise<void>[] = [];
    act(() => {
      pending = [result.current.field.commit('um')];
    });
    act(() => {
      pending.push(result.current.field.commit('dois'));
      pending.push(result.current.field.commit('tres'));
    });
    expect(save.mock.calls).toEqual([['um']]);
    expect(result.current.field.saving).toBe(true);

    await act(async () => {
      first.settle();
      await Promise.all(pending);
    });

    expect(save.mock.calls).toEqual([['um'], ['tres']]);
    expect(result.current.field.saving).toBe(false);
  });

  it('RES-44 does not send a waiting value that turned out to be the one just saved', async () => {
    const first = deferred();
    const save = vi.fn(() => first.promise);
    const { result } = setup({ save });

    let pending: Promise<void>[] = [];
    act(() => {
      pending = [result.current.field.commit('um'), result.current.field.commit('um')];
    });
    await act(async () => {
      first.settle();
      await Promise.all(pending);
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('RES-47 does not send a waiting value that is invalid', async () => {
    const first = deferred();
    const save = vi.fn((value: string) => (value === 'valido' ? first.promise : Promise.resolve(ok)));
    const { result } = setup({ save, validate: (value) => (value === 'invalido' ? 'Inválido.' : null) });

    let pending: Promise<void>[] = [];
    act(() => {
      pending = [result.current.field.commit('valido'), result.current.field.commit('invalido')];
    });
    await act(async () => {
      first.settle();
      await Promise.all(pending);
    });

    expect(save.mock.calls).toEqual([['valido']]);
    expect(result.current.field.error).toBe('Inválido.');
  });

  it('RES-43 shows the saved value the caller gives, and follows it while nothing was typed over it', () => {
    const { result, rerender } = setup({ saved: 'Pessoa Fictícia Alfa' });
    expect(result.current.field.value).toBe('Pessoa Fictícia Alfa');

    rerender({ saved: 'Pessoa Fictícia Beta' });

    expect(result.current.field.value).toBe('Pessoa Fictícia Beta');
  });

  it('RES-48 keeps what was typed when the saved value changes under it', () => {
    const { result, rerender } = setup({ saved: 'Pessoa Fictícia Alfa' });
    act(() => result.current.field.setValue('digitando'));

    rerender({ saved: 'Pessoa Fictícia Beta' });

    expect(result.current.field.value).toBe('digitando');
  });

  it('RES-44 compares a changed value with the new saved one after the caller updates it', async () => {
    const { result, rerender, save } = setup({ saved: 'Pessoa Fictícia Alfa' });
    rerender({ saved: 'Pessoa Fictícia Beta' });

    await act(() => result.current.field.commit('Pessoa Fictícia Beta'));

    expect(save).not.toHaveBeenCalled();
  });
});

describe('SavedAtProvider', () => {
  it('RES-44 shows no time until a save worked in this browser, and writes it as HH:MM with two digits', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 10, 9, 5) });
    const { result } = setup({});
    expect(result.current.time).toBeNull();

    await act(() => result.current.field.commit('Pessoa Fictícia Beta'));

    expect(result.current.time).toBe('09:05');
  });
});
