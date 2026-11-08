/** The time zone of the person: one app in pt-BR, fixed so the server and the browser print the same text. */
const TIME_ZONE = 'America/Sao_Paulo';

const dateParts = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/**
 * "15 nov 2026": the day an instant falls on in São Paulo, with the month cut to three letters. An
 * instant that is not a date gives `undefined`, so a screen can leave the line out instead of
 * printing "Invalid Date".
 */
export function formatDate(iso: string): string | undefined {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return undefined;

  const parts = Object.fromEntries(
    dateParts.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return `${parts.day} ${parts.month?.replace('.', '')} ${parts.year}`;
}
