import { connect, createServer, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

/**
 * TCP proxy in front of PostgreSQL that holds every byte the database sends back for `delayMs`.
 * The health probe runs a fixed `SELECT 1`, so a slow database is simulated on the wire, not in SQL,
 * and the production code stays untouched.
 */
export async function startDelayProxy(target: { host: string; port: number }) {
  let delayMs = 0;
  const sockets = new Set<Socket>();
  const server = createServer((client) => {
    const upstream = connect(target.port, target.host);
    sockets.add(client).add(upstream);
    const close = () => {
      client.destroy();
      upstream.destroy();
    };
    client.on('error', close).on('close', close);
    upstream.on('error', close).on('close', close);
    client.pipe(upstream);
    // Equal delays keep the chunks in order: timers with the same duration fire in insertion order.
    upstream.on('data', (chunk: Buffer) => {
      setTimeout(() => {
        if (!client.destroyed) client.write(chunk);
      }, delayMs);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    /** Rewrites a connection URI so the client goes through the proxy. */
    proxied(uri: string): string {
      const url = new URL(uri);
      url.hostname = '127.0.0.1';
      url.port = String(port);
      return url.toString();
    },
    setDelay(ms: number): void {
      delayMs = ms;
    },
    close(): Promise<void> {
      for (const socket of sockets) socket.destroy();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
