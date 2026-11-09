// @vitest-environment jsdom
import type { ApplicationEvent } from '@am/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { uuid } from '../testing/fixtures';
import { ApplicationTimeline } from './ApplicationTimeline';

const event = (n: number, overrides: Partial<ApplicationEvent>): ApplicationEvent => ({
  id: uuid(7000 + n),
  kind: 'note',
  fromStatus: null,
  toStatus: null,
  stage: null,
  note: null,
  occurredAt: '2026-10-20T15:00:00.000Z',
  ...overrides,
});

/** What each entry of the list says and its date, from the text and date columns of the item. */
const entries = () =>
  screen.getAllByRole('listitem').map((item) => ({
    text: item.children[1]?.textContent,
    date: item.children[2]?.textContent,
    icon: item.querySelector('[data-status-icon]')?.getAttribute('data-status-icon') ?? null,
  }));

describe('ApplicationTimeline', () => {
  it('APP-70 shows each event as its sentence and its date as "dd mmm", with "Vaga cadastrada" last', () => {
    render(
      <ApplicationTimeline
        createdAt="2026-10-14T15:00:00.000Z"
        events={[
          event(1, { kind: 'note', note: 'recrutadora retorna em duas semanas', occurredAt: '2026-10-20T15:00:00.000Z' }),
          event(2, { kind: 'stage', stage: 'hr', note: 'conversa com a pessoa de RH', occurredAt: '2026-10-18T15:00:00.000Z' }),
          event(3, { kind: 'stage', stage: 'technical', occurredAt: '2026-10-17T15:00:00.000Z' }),
          event(4, { kind: 'status_changed', fromStatus: 'saved', toStatus: 'applied', occurredAt: '2026-10-16T15:00:00.000Z' }),
          event(5, { kind: 'status_changed', toStatus: 'interviewing', occurredAt: '2026-10-15T15:00:00.000Z' }),
        ]}
      />,
    );

    expect(entries().map(({ text, date }) => ({ text, date }))).toEqual([
      { text: 'Nota · recrutadora retorna em duas semanas', date: '20 out' },
      { text: 'Etapa RH · conversa com a pessoa de RH', date: '18 out' },
      { text: 'Etapa Técnica', date: '17 out' },
      { text: 'Status Salva → Enviada', date: '16 out' },
      { text: 'Status → Em entrevistas', date: '15 out' },
      { text: 'Vaga cadastrada', date: '14 out' },
    ]);
  });

  it('APP-70 never shows a separator without text for a stage whose note is blank', () => {
    render(
      <ApplicationTimeline
        createdAt="2026-10-14T15:00:00.000Z"
        events={[
          event(1, { kind: 'stage', stage: 'hr', note: '', occurredAt: '2026-10-18T15:00:00.000Z' }),
          event(2, { kind: 'stage', stage: 'case', note: '   ', occurredAt: '2026-10-17T15:00:00.000Z' }),
        ]}
      />,
    );

    expect(entries().map((entry) => entry.text)).toEqual(['Etapa RH', 'Etapa Case', 'Vaga cadastrada']);
  });

  it('APP-70 keeps the order the api gave, whatever the dates are', () => {
    render(
      <ApplicationTimeline
        createdAt="2026-10-14T15:00:00.000Z"
        events={[
          event(1, { note: 'segunda', occurredAt: '2026-10-16T15:00:00.000Z' }),
          event(2, { note: 'primeira', occurredAt: '2026-10-19T15:00:00.000Z' }),
        ]}
      />,
    );

    expect(entries().map((entry) => entry.text)).toEqual(['Nota · segunda', 'Nota · primeira', 'Vaga cadastrada']);
  });

  it('APP-69 leads a status change with the ring of the status it went to, and the registration with the ring of "Salva"', () => {
    render(
      <ApplicationTimeline
        createdAt="2026-10-14T15:00:00.000Z"
        events={[event(1, { kind: 'status_changed', fromStatus: 'applied', toStatus: 'interviewing' })]}
      />,
    );

    expect(entries().map((entry) => entry.icon)).toEqual(['interviewing', 'saved']);
  });

  it('APP-70 shows only "Vaga cadastrada" when there are no events', () => {
    render(<ApplicationTimeline createdAt="2026-10-14T15:00:00.000Z" events={[]} />);

    expect(entries().map(({ text, date }) => ({ text, date }))).toEqual([{ text: 'Vaga cadastrada', date: '14 out' }]);
  });
});
