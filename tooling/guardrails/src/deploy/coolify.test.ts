import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { repoRoot } from '../repo.js';

const script = join(repoRoot, 'infra/deploy/coolify.sh');
const TOKEN = 'tok-secret-value-123';
const UUID = 'res-uuid-1';

interface Recorded {
  method: string;
  url: string;
  authorization: string | undefined;
  body: string;
}

let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

/** A fake Coolify: `answer` picks the status per request, and every request is recorded. */
async function fakeCoolify(answer: (request: Recorded) => number): Promise<{ url: string; calls: Recorded[] }> {
  const calls: Recorded[] = [];
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const recorded = {
        method: request.method ?? '',
        url: request.url ?? '',
        authorization: request.headers.authorization,
        body,
      };
      calls.push(recorded);
      response.writeHead(answer(recorded)).end('{"message":"echo"}');
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls };
}

function coolify(tag: string, env: Record<string, string | undefined>): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [script, tag], {
      env: { PATH: process.env.PATH ?? '', ...Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)) },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => resolve({ code, output }));
  });
}

const base = (url: string) => ({ COOLIFY_URL: url, COOLIFY_TOKEN: TOKEN, COOLIFY_RESOURCE_UUID: UUID });

describe('coolify.sh', () => {
  it('DEPLOY-06 writes IMAGE_TAG and then triggers the deploy, both with the bearer token', async () => {
    const { url, calls } = await fakeCoolify(() => 200);
    const result = await coolify('abc123', base(url));
    expect(result.code).toBe(0);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `PATCH /api/v1/applications/${UUID}/envs`,
      `GET /api/v1/deploy?uuid=${UUID}&force=false`,
    ]);
    expect(JSON.parse(calls[0]!.body)).toMatchObject({ key: 'IMAGE_TAG', value: 'abc123' });
    expect(calls.map((call) => call.authorization)).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`]);
  });

  it('DEPLOY-06 creates the variable with POST when the resource does not have it yet', async () => {
    const { url, calls } = await fakeCoolify((call) => (call.method === 'PATCH' ? 404 : 201));
    const result = await coolify('abc123', base(url));
    expect(result.code).toBe(0);
    expect(calls.map((call) => call.method)).toEqual(['PATCH', 'POST', 'GET']);
    expect(JSON.parse(calls[1]!.body)).toMatchObject({ key: 'IMAGE_TAG', value: 'abc123' });
  });

  it('DEPLOY-06 uses the services routes when COOLIFY_RESOURCE_KIND is services', async () => {
    const { url, calls } = await fakeCoolify(() => 200);
    const result = await coolify('abc123', { ...base(url), COOLIFY_RESOURCE_KIND: 'services' });
    expect(result.code).toBe(0);
    expect(calls[0]!.url).toBe(`/api/v1/services/${UUID}/envs`);
  });

  it.each(['COOLIFY_URL', 'COOLIFY_TOKEN', 'COOLIFY_RESOURCE_UUID'])(
    'DEPLOY-07 exits 2 naming %s when it is missing, without any call and without printing a secret',
    async (missing) => {
      const { url, calls } = await fakeCoolify(() => 200);
      const result = await coolify('abc123', { ...base(url), [missing]: undefined });
      expect(result.code).toBe(2);
      expect(result.output).toContain(missing);
      expect(result.output).not.toContain(TOKEN);
      expect(calls).toEqual([]);
    },
  );

  it('DEPLOY-43 exits 1 with the HTTP status and never triggers the deploy when writing the tag fails', async () => {
    const { url, calls } = await fakeCoolify(() => 401);
    const result = await coolify('abc123', base(url));
    expect(result.code).toBe(1);
    expect(result.output).toContain('HTTP 401');
    expect(result.output).not.toContain(TOKEN);
    expect(calls.some((call) => call.url.startsWith('/api/v1/deploy'))).toBe(false);
  });

  it('DEPLOY-43 exits 1 with the HTTP status when the deploy trigger fails', async () => {
    const { url } = await fakeCoolify((call) => (call.url.startsWith('/api/v1/deploy') ? 500 : 200));
    const result = await coolify('abc123', base(url));
    expect(result.code).toBe(1);
    expect(result.output).toContain('HTTP 500');
  });
});
