import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { repoRoot } from '../repo.js';

const script = join(repoRoot, 'infra/deploy/check-tag.sh');

let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

/** A fake registry that hands out a pull token and knows which `<image>:<tag>` pairs exist. */
async function fakeRegistry(existing: string[]): Promise<string> {
  server = createServer((request, response) => {
    const url = request.url ?? '';
    if (url.startsWith('/token')) {
      response.writeHead(200).end('{"token":"anon-pull-token"}');
      return;
    }
    const match = /^\/v2\/(.+)\/manifests\/(.+)$/.exec(url);
    const authorized = request.headers.authorization === 'Bearer anon-pull-token';
    const found = match !== null && existing.includes(`${match[1]}:${match[2]}`);
    response.writeHead(authorized && found ? 200 : authorized ? 404 : 401).end();
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function checkTag(tag: string, registry: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [script, tag], {
      env: { PATH: process.env.PATH ?? '', IMAGE_REPOSITORY: 'ghcr.io/owner/app', REGISTRY_URL: registry },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => resolve({ code, output }));
  });
}

describe('check-tag.sh', () => {
  it('DEPLOY-45 exits 0 when api, web and backup all have the tag', async () => {
    const registry = await fakeRegistry(['owner/app-api:t1', 'owner/app-web:t1', 'owner/app-backup:t1']);
    const result = await checkTag('t1', registry);
    expect(result.code).toBe(0);
  });

  it('DEPLOY-45 exits 1 naming the image that lacks the tag', async () => {
    const registry = await fakeRegistry(['owner/app-api:t1', 'owner/app-web:t1']);
    const result = await checkTag('t1', registry);
    expect(result.code).toBe(1);
    expect(result.output).toContain('owner/app-backup');
    expect(result.output).not.toContain('owner/app-api');
  });

  it('DEPLOY-45 exits 1 when the tag does not exist for any image', async () => {
    const registry = await fakeRegistry(['owner/app-api:other']);
    const result = await checkTag('t1', registry);
    expect(result.code).toBe(1);
    expect(result.output).toContain('owner/app-api');
    expect(result.output).toContain('owner/app-web');
    expect(result.output).toContain('owner/app-backup');
  });
});
