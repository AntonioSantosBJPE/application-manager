import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { repoRoot, run, type RunResult } from '../repo.js';

// Rehearses infra/provision/harden.sh in a throwaway Ubuntu 24.04 container (no systemd, no real
// firewall): users, keys, files and the script's own output are checked; what needs a real server
// (services, ufw, iptables) is checked through --dry-run, and the runbook has the live check.

const UBUNTU = 'ubuntu@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852';
const PUBLIC_KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOnlyAnExampleKeyForTestsNotRealXXXXXXXXXXX test@example';
const provisionDir = join(repoRoot, 'infra/provision');

const containers: string[] = [];

interface Server {
  name: string;
  /** Runs harden.sh with `env` and `args`. */
  harden(env: Record<string, string>, args?: string[]): RunResult;
  /** Runs a shell command in the container. */
  sh(command: string): RunResult;
}

function startServer(): Server {
  const name = `am-harden-${randomBytes(4).toString('hex')}`;
  const started = run('docker', ['run', '-d', '--rm', '--name', name, '-v', `${provisionDir}:/provision:ro`, UBUNTU, 'sleep', 'infinity']);
  if (started.status !== 0) throw new Error(`container failed to start:\n${started.output}`);
  containers.push(name);
  return {
    name,
    harden: (env, args = []) =>
      run('docker', [
        'exec', ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
        name, 'bash', '/provision/harden.sh', ...args,
      ]),
    sh: (command) => run('docker', ['exec', name, 'bash', '-c', command]),
  };
}

afterAll(() => {
  if (containers.length > 0) run('docker', ['rm', '-f', ...containers]);
}, 60_000);

const base = { ADMIN_USER: 'deploy', ADMIN_SSH_PUBLIC_KEY: PUBLIC_KEY, HARDEN_CF_IPS_FILE: '' };

/** The first server runs the whole script once; the idempotency test reruns it. */
let main: Server;
let first: RunResult;
beforeAll(() => {
  main = startServer();
  first = main.harden(base);
}, 300_000);

describe('harden.sh', () => {
  it('DEPLOY-24 creates the key-only admin user with sudo and docker, and installs the key', () => {
    expect(first.status, first.output).toBe(0);
    expect(main.sh('id -nG deploy').output.trim().split(' ')).toEqual(expect.arrayContaining(['sudo', 'docker']));
    // No password: the shadow entry is `*`, which blocks password login.
    expect(main.sh("getent shadow deploy | cut -d: -f2").output.trim()).toBe('*');
    expect(main.sh('cat /home/deploy/.ssh/authorized_keys').output.trim()).toBe(PUBLIC_KEY);
    expect(main.sh("stat -c '%a %U' /home/deploy/.ssh /home/deploy/.ssh/authorized_keys").output.trim().split('\n')).toEqual([
      '700 deploy',
      '600 deploy',
    ]);
    expect(main.sh('visudo -cf /etc/sudoers.d/90-deploy').status).toBe(0);
  }, 300_000);

  it.each([
    ['empty', ''],
    ['not a key', 'this is not a key'],
    ['a private key header', '-----BEGIN OPENSSH PRIVATE KEY-----'],
  ])('DEPLOY-25 with a key that is %s it exits non-zero before touching users, packages or the firewall', (_label, key) => {
    const server = startServer();
    const result = server.harden({ ...base, ADMIN_SSH_PUBLIC_KEY: key });
    expect(result.status).toBe(2);
    expect(result.output).toContain('ADMIN_SSH_PUBLIC_KEY');
    expect(server.sh('id deploy').status).not.toBe(0);
    expect(server.sh('dpkg -s sudo').status).not.toBe(0);
    expect(server.sh('ls /etc/sudoers.d').output).not.toContain('90-deploy');
  });

  it('DEPLOY-29 a second run with the same values exits 0, reports unchanged for every step and changes no file', () => {
    const fingerprint = "find /etc /home -xdev -type f -exec sha256sum {} + | sort | sha256sum";
    const before = main.sh(fingerprint).output;
    const second = main.harden(base);
    expect(second.status, second.output).toBe(0);
    const steps = second.output.split('\n').filter((line) => /^\[[a-z-]+\] /.test(line));
    expect(steps.length).toBeGreaterThan(0);
    for (const line of steps) expect(line, line).toMatch(/ unchanged$/);
    expect(main.sh(fingerprint).output).toBe(before);
  }, 300_000);

  it('DEPLOY-30 --dry-run prints the commands it would run and changes nothing', () => {
    const server = startServer();
    const result = server.harden(base, ['--dry-run']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toMatch(/^\+ .*useradd .*deploy/m);
    expect(result.output).toMatch(/^\+ .*apt-get install/m);
    expect(server.sh('id deploy').status).not.toBe(0);
    expect(server.sh('dpkg -s sudo').status).not.toBe(0);
  });

  it('DEPLOY-31 keeps every server-specific value out of infra/provision', () => {
    for (const file of readdirSync(provisionDir, { recursive: true, encoding: 'utf8' })) {
      const text = readFileSync(join(provisionDir, file), 'utf8');
      expect(text, file).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
      expect(text, file).not.toMatch(/AAAA[A-Za-z0-9+/]{20,}/);
      expect(text, file).not.toMatch(/\/home\/[a-z]/);
      expect(text, file).not.toMatch(/ADMIN_USER="?[a-z]/);
    }
  });
});
