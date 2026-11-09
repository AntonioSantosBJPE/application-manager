import { spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { repoRoot } from '../repo.js';

const script = join(repoRoot, 'infra/deploy/smoke.sh');

const page = (api: string) =>
  `<ul><li><div role="group" aria-label="API"><span>API</span><span class="badge">${api}</span></div></li>` +
  `<li><div role="group" aria-label="Banco de dados"><span>Banco de dados</span><span>Operacional</span></div></li></ul>`;

let server: Server | undefined;
afterEach(() => {
  server?.close();
  server = undefined;
});

/** Starts a fake web whose /status answers with `respond`; returns its base URL. */
async function fakeWeb(respond: () => { status: number; body: string; headers?: Record<string, string> }): Promise<string> {
  server = createServer((request, response) => {
    const { status, body, headers } = respond();
    response.writeHead(status, { 'content-type': 'text/html', ...headers }).end(request.url === '/status' ? body : '');
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function smoke(url: string, env: Record<string, string> = {}): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [script, url], {
      env: { ...process.env, SMOKE_INTERVAL: '1', SMOKE_TIMEOUT: '3', ...env },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => resolve({ code, output }));
  });
}

describe('smoke.sh', () => {
  it('DEPLOY-08 succeeds as soon as /status answers 200 with the API operational', async () => {
    const url = await fakeWeb(() => ({ status: 200, body: page('Operacional') }));
    const result = await smoke(url);
    expect(result.code).toBe(0);
  });

  it('DEPLOY-08 keeps polling every interval until the API becomes operational', async () => {
    let calls = 0;
    const url = await fakeWeb(() => {
      calls += 1;
      return calls < 3 ? { status: 503, body: '' } : { status: 200, body: page('Operacional') };
    });
    const result = await smoke(url, { SMOKE_TIMEOUT: '10' });
    expect(result.code).toBe(0);
    expect(calls).toBe(3);
  });

  it('DEPLOY-09 exits 1 and prints the last HTTP status when /status never answers 200', async () => {
    const url = await fakeWeb(() => ({ status: 503, body: '' }));
    const result = await smoke(url);
    expect(result.code).toBe(1);
    expect(result.output).toContain('last HTTP status: 503');
  });

  it('DEPLOY-09 exits 1 when nothing listens at the address', async () => {
    const result = await smoke('http://127.0.0.1:9');
    expect(result.code).toBe(1);
    expect(result.output).toContain('last HTTP status: 000');
  });

  it('DEPLOY-44 fails when /status answers 200 but the API row says Indisponível', async () => {
    const url = await fakeWeb(() => ({ status: 200, body: page('Indisponível') }));
    const result = await smoke(url);
    expect(result.code).toBe(1);
    expect(result.output).toContain('last HTTP status: 200');
  });
});

describe('smoke.sh with an expected version', () => {
  it('DEPLOY-44 fails while the page still comes from the previous version, printing both versions', async () => {
    const url = await fakeWeb(() => ({ status: 200, body: page('Operacional'), headers: { 'x-app-version': 'previous-sha' } }));
    const result = await smoke(url, { SMOKE_EXPECTED_VERSION: 'new-sha' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('version seen: previous-sha');
    expect(result.output).toContain('expected: new-sha');
  });

  it('DEPLOY-44 fails when the page carries no version at all', async () => {
    const url = await fakeWeb(() => ({ status: 200, body: page('Operacional') }));
    const result = await smoke(url, { SMOKE_EXPECTED_VERSION: 'new-sha' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('version seen: none');
  });

  it('DEPLOY-08 succeeds once the page switches to the expected version, however long the old one answered', async () => {
    let calls = 0;
    const url = await fakeWeb(() => {
      calls += 1;
      return { status: 200, body: page('Operacional'), headers: { 'x-app-version': calls < 3 ? 'previous-sha' : 'new-sha' } };
    });
    const result = await smoke(url, { SMOKE_EXPECTED_VERSION: 'new-sha', SMOKE_TIMEOUT: '10' });
    expect(result.code).toBe(0);
    expect(calls).toBe(3);
    expect(result.output).toContain('version new-sha');
  });

  it('DEPLOY-08 does not accept the expected version on a page whose API is unavailable', async () => {
    const url = await fakeWeb(() => ({ status: 200, body: page('Indisponível'), headers: { 'x-app-version': 'new-sha' } }));
    const result = await smoke(url, { SMOKE_EXPECTED_VERSION: 'new-sha' });
    expect(result.code).toBe(1);
  });
});

describe('smoke.sh defaults', () => {
  const source = readFileSync(script, 'utf8');

  it('DEPLOY-08 polls every 10 seconds by default: the first wait between two attempts is 10', async () => {
    // A stub sleep records its argument and stops the script, so the default interval is observed without waiting.
    const bin = mkdtempSync(join(tmpdir(), 'smoke-sleep-'));
    const log = join(bin, 'sleep.log');
    writeFileSync(join(bin, 'sleep'), `#!/usr/bin/env bash\necho "$1" >> "${log}"\nexit 9\n`);
    chmodSync(join(bin, 'sleep'), 0o755);
    const url = await fakeWeb(() => ({ status: 503, body: '' }));
    const result = await new Promise<number | null>((resolve) => {
      const inherited = Object.entries(process.env).filter(([name]) => !name.startsWith('SMOKE_'));
      const env = { ...Object.fromEntries(inherited), PATH: `${bin}:${process.env.PATH ?? ''}` };
      spawn('bash', [script, url], { env }).on('close', resolve);
    });
    expect(result).toBe(9);
    expect(readFileSync(log, 'utf8').trim()).toBe('10');
  });

  it('DEPLOY-09 gives up after 300 seconds by default', () => {
    expect(source).toContain('timeout="${SMOKE_TIMEOUT:-300}"');
    expect(source).toContain('interval="${SMOKE_INTERVAL:-10}"');
  });
});
