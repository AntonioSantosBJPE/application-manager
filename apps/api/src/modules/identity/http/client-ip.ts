import type { IncomingMessage } from 'node:http';

/** The header the web fills with the address it resolved; anything the client sends is overwritten (LOCK-09, LOCK-10). */
export const CLIENT_IP_HEADER = 'x-am-client-ip';

/**
 * The address the login counters are keyed by: the header the web set when it is there, otherwise
 * the socket the request came from, which is what a direct caller can offer (LOCK-09).
 */
export function clientIpOf(request: IncomingMessage): string {
  const forwarded = request.headers[CLIENT_IP_HEADER];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (value !== undefined && value.trim() !== '') return value.trim();
  return request.socket.remoteAddress ?? '';
}
