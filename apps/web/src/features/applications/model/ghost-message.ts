import type { ApplicationStatus } from '@am/contracts';

/**
 * The text of the "sem retorno" alert: "desde o envio" is true only in "Enviada" (APP-80). Any other
 * status has no suggestion, so there is no text.
 */
export function ghostMessage(status: ApplicationStatus, days: number): string | undefined {
  if (status === 'applied') return `${days} dias sem atividade desde o envio. Marcar como sem retorno?`;
  if (status === 'interviewing') return `${days} dias sem atividade. Marcar como sem retorno?`;
  return undefined;
}
