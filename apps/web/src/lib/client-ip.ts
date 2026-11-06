import { getRequestHeader, getRequestIP } from '@tanstack/react-start/server';

/** The variable that names the header the proxy in front of the web fills with the browser address. */
export const CLIENT_IP_HEADER_VARIABLE = 'CLIENT_IP_HEADER';

/** What the BFF can read from the browser request without depending on the framework. */
export interface BrowserRequest {
  /** A request header by lowercase name, or undefined when it is absent. */
  header: (name: string) => string | undefined;
  /** Address of the connection itself, as the runtime reports it without trusting any client header. */
  socketAddress: string | undefined;
}

/**
 * The address the BFF forwards to the api. The header named by `CLIENT_IP_HEADER` wins because a reverse
 * proxy sits in front of the web and overwrites it; without that variable the connection address is used.
 * `X-Forwarded-For` is never read: a browser sends it itself, so trusting it would let anyone dodge the
 * lockout by naming a fresh address on every attempt (LOCK-09, LOCK-10).
 */
export function clientIpOf(request: BrowserRequest, configuredHeader: string | undefined): string | undefined {
  const name = configuredHeader?.trim();
  if (name !== undefined && name !== '') {
    const fromProxy = request.header(name.toLowerCase())?.trim() ?? '';
    if (fromProxy !== '') return fromProxy;
  }
  const socket = request.socketAddress?.trim() ?? '';
  return socket === '' ? undefined : socket;
}

/** `clientIpOf` over the request being served; the address the request carries never comes from a client header. */
export function clientIpOfServerRequest(env: Record<string, string | undefined> = process.env): string | undefined {
  return clientIpOf(
    { header: (name) => getRequestHeader(name), socketAddress: getRequestIP() },
    env[CLIENT_IP_HEADER_VARIABLE],
  );
}
