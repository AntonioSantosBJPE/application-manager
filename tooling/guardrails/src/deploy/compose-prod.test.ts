import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, run } from '../repo.js';

const composeFile = 'infra/compose.prod.yaml';

/** Every variable the file requires, with a placeholder value. */
const required: Record<string, string> = {
  IMAGE_REPOSITORY: 'ghcr.io/owner/app',
  IMAGE_TAG: 'abc123',
  POSTGRES_USER: 'app',
  POSTGRES_PASSWORD: 'not-a-real-password',
  POSTGRES_DB: 'app',
  WEB_PUBLIC_URL: 'https://example.test',
  BACKUP_S3_ENDPOINT: 'https://s3.example.test',
  BACKUP_S3_ACCESS_KEY_ID: 'key-id',
  BACKUP_S3_SECRET_ACCESS_KEY: 'key-secret',
  BACKUP_BUCKET: 'bucket',
};

/** Variables the file reads, so a value in the developer's shell cannot leak into the result. */
const ownedKeys = new Set([...Object.keys(required), 'SESSION_COOKIE_SECURE', 'CLIENT_IP_HEADER', 'LOG_LEVEL']);

interface Service {
  image: string;
  ports?: unknown[];
  restart?: string;
  environment?: Record<string, string>;
  depends_on?: Record<string, { condition: string }>;
  volumes?: { type: string; source: string; target: string }[];
}
interface Config {
  services: Record<string, Service>;
  volumes: Record<string, unknown>;
}

/** `docker compose config` of the production file under `env`, over a clean copy of the environment. */
function compose(env: Record<string, string>) {
  const inherited = Object.entries(process.env).filter(([key]) => !ownedKeys.has(key));
  const result = run('docker', ['compose', '-f', composeFile, 'config', '--format', 'json'], {
    cwd: repoRoot,
    env: { ...Object.fromEntries(inherited), ...env },
  });
  return {
    status: result.status,
    output: result.output,
    config: result.status === 0 ? (JSON.parse(result.output) as Config) : undefined,
  };
}

const ok = compose(required);
const services = ok.config?.services ?? {};

describe('compose.prod.yaml', () => {
  it('DEPLOY-11 declares postgres, migrate, api, web and backup, with the GHCR images on IMAGE_TAG', () => {
    expect(ok.status, ok.output).toBe(0);
    expect(Object.keys(services).sort()).toEqual(['api', 'backup', 'migrate', 'postgres', 'web']);
    expect(services.web?.image).toBe('ghcr.io/owner/app-web:abc123');
    expect(services.api?.image).toBe('ghcr.io/owner/app-api:abc123');
    expect(services.migrate?.image).toBe('ghcr.io/owner/app-api:abc123');
    expect(services.backup?.image).toBe('ghcr.io/owner/app-backup:abc123');
  });

  it.each(Object.keys(required))('DEPLOY-12 fails naming %s when it is missing', (name) => {
    const without = Object.fromEntries(Object.entries(required).filter(([key]) => key !== name));
    const result = compose(without);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain(name);
  });

  it('DEPLOY-13 publishes no host port for postgres, api or web', () => {
    for (const name of ['postgres', 'api', 'web', 'migrate', 'backup']) {
      expect(services[name]?.ports ?? [], name).toEqual([]);
    }
  });

  it('DEPLOY-14 fixes the secure cookie and the Cloudflare client-IP header whatever the environment says', () => {
    const hostile = compose({ ...required, SESSION_COOKIE_SECURE: 'false', CLIENT_IP_HEADER: 'x-forwarded-for' });
    expect(hostile.status, hostile.output).toBe(0);
    expect(hostile.config?.services.api?.environment?.SESSION_COOKIE_SECURE).toBe('true');
    expect(hostile.config?.services.web?.environment?.CLIENT_IP_HEADER).toBe('cf-connecting-ip');
  });

  it('DEPLOY-15 runs migrate to completion before the api and restarts api and web by themselves', () => {
    expect(services.api?.depends_on?.migrate?.condition).toBe('service_completed_successfully');
    expect(services.migrate?.depends_on?.postgres?.condition).toBe('service_healthy');
    expect(services.migrate?.restart).toBe('no');
    for (const name of ['api', 'web', 'postgres', 'backup']) {
      expect(services[name]?.restart, name).toBe('unless-stopped');
    }
  });

  it('DEPLOY-16 keeps the Postgres data in a named volume', () => {
    const mount = services.postgres?.volumes?.find((volume) => volume.target === '/var/lib/postgresql');
    expect(mount).toMatchObject({ type: 'volume', source: 'postgres-data' });
    expect(Object.keys(ok.config?.volumes ?? {})).toContain('postgres-data');
  });

  it('DEPLOY-18 holds no literal address, hostname, password or token, only variable references', () => {
    const text = readFileSync(join(repoRoot, composeFile), 'utf8');
    const code = text
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    // Loopback in the healthchecks is not a server address; any other IPv4 literal is.
    const addresses = code.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) ?? [];
    expect(addresses.filter((address) => address !== '127.0.0.1')).toEqual([]);
    expect(code).not.toMatch(/ghcr\.io\/[a-z0-9]/i);
    for (const line of code.split('\n')) {
      const match = /^\s*[A-Z_]*(PASSWORD|SECRET|TOKEN|ACCESS_KEY_ID|ENDPOINT):\s*(.+)$/.exec(line);
      if (match) expect(match[2], line).toMatch(/^\$\{/);
    }
  });
});
