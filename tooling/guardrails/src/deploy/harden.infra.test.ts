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

function startServer(options: { netAdmin?: boolean; noNetwork?: boolean } = {}): Server {
  const name = `am-harden-${randomBytes(4).toString('hex')}`;
  const started = run('docker', [
    'run', '-d', '--rm', '--name', name, ...(options.netAdmin ? ['--cap-add', 'NET_ADMIN'] : []), ...(options.noNetwork ? ['--network', 'none'] : []),
    '-v', `${provisionDir}:/provision:ro`, UBUNTU, 'sleep', 'infinity',
  ]);
  if (started.status !== 0) throw new Error(`container failed to start:\n${started.output}`);
  containers.push(name);
  run('docker', ['exec', name, 'bash', '-c', `printf '%s\\n' ${CF_FIXTURE.join(' ')} > ${CF_FILE}`]);
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

/** Documentation ranges standing in for Cloudflare's, in the file the script reads when HARDEN_CF_IPS_FILE is set. */
const CF_FILE = '/tmp/cf-ips.txt';
const CF_FIXTURE = ['203.0.113.0/24', '198.51.100.0/24', '2001:db8::/32'];
const base = { ADMIN_USER: 'deploy', ADMIN_SSH_PUBLIC_KEY: PUBLIC_KEY, HARDEN_CF_IPS_FILE: CF_FILE };

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

  it('DEPLOY-26 the sshd drop-in turns off root and password login, and beats a cloud-init file that turns passwords on', () => {
    const server = startServer();
    server.sh("mkdir -p /etc/ssh/sshd_config.d && echo 'PasswordAuthentication yes' > /etc/ssh/sshd_config.d/50-cloud-init.conf");
    const result = server.harden(base);
    expect(result.status, result.output).toBe(0);
    expect(server.sh('cat /etc/ssh/sshd_config.d/00-hardening.conf').output).toMatch(
      /PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\nPubkeyAuthentication yes/,
    );
    const effective = server.sh('sshd -T | grep -E "^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication) "').output;
    expect(effective).toContain('permitrootlogin no');
    expect(effective).toContain('passwordauthentication no');
    expect(effective).toContain('kbdinteractiveauthentication no');
  }, 300_000);

  it('DEPLOY-26 when sshd -t rejects the configuration it restores the previous file, or removes the new one, and exits non-zero', () => {
    const server = startServer();
    expect(server.harden(base).status).toBe(0);
    const file = '/etc/ssh/sshd_config.d/00-hardening.conf';
    // Something outside the script's file breaks the configuration, so any new write must be rolled back.
    server.sh("echo 'NotADirective yes' > /etc/ssh/sshd_config.d/99-broken.conf");

    server.sh(`echo 'PermitRootLogin yes' > ${file}`);
    const withPrevious = server.harden(base);
    expect(withPrevious.status).toBe(1);
    expect(withPrevious.output).toContain('previous one was restored');
    expect(server.sh(`cat ${file}`).output.trim()).toBe('PermitRootLogin yes');

    server.sh(`rm ${file}`);
    const withoutPrevious = server.harden(base);
    expect(withoutPrevious.status).toBe(1);
    expect(server.sh(`test -e ${file}`).status).not.toBe(0);
  }, 300_000);

  it('DEPLOY-26 validates with sshd -t before it reloads the service', () => {
    const server = startServer();
    const result = server.harden({ ...base, HARDEN_FORCE_SYSTEMD: '1' }, ['--dry-run']);
    expect(result.status, result.output).toBe(0);
    const test = result.output.indexOf('+ sshd -t');
    const reload = result.output.indexOf('+ systemctl reload ssh');
    expect(test).toBeGreaterThan(-1);
    expect(reload).toBeGreaterThan(test);
  });

  it('DEPLOY-28 installs and enables fail2ban for SSH and the automatic security updates', () => {
    expect(main.sh('dpkg -s fail2ban unattended-upgrades').status).toBe(0);
    const jail = main.sh('cat /etc/fail2ban/jail.d/sshd.local').output;
    expect(jail).toMatch(/\[sshd\]\nenabled = true\nport = 22\n/);
    const periodic = main.sh('cat /etc/apt/apt.conf.d/20auto-upgrades').output;
    expect(periodic).toContain('APT::Periodic::Update-Package-Lists "1";');
    expect(periodic).toContain('APT::Periodic::Unattended-Upgrade "1";');
    const dry = startServer().harden({ ...base, HARDEN_FORCE_SYSTEMD: '1' }, ['--dry-run']).output;
    expect(dry).toContain('+ systemctl enable --now fail2ban');
    expect(dry).toContain('+ systemctl enable --now apt-daily.timer apt-daily-upgrade.timer');
  });

  it('DEPLOY-27 prints a firewall that denies by default and opens SSH, the extra ports and 80/443 only to Cloudflare, in ufw and in DOCKER-USER', () => {
    const server = startServer();
    const result = server.harden({ ...base, EXTRA_ALLOW_TCP: '8000,9000' }, ['--dry-run']);
    expect(result.status, result.output).toBe(0);
    const lines = result.output.split('\n').filter((line) => line.startsWith('+ '));
    const has = (text: string) => expect(lines, text).toContain(`+ ${text}`);

    has('ufw default deny incoming');
    has('ufw allow 22/tcp');
    has('ufw allow 8000/tcp');
    has('ufw allow 9000/tcp');
    for (const cidr of CF_FIXTURE) {
      for (const port of [80, 443]) has(`ufw allow from ${cidr} to any port ${port} proto tcp`);
    }
    // DOCKER-USER: a chain of ours, per address family, that lets Cloudflare in and drops the rest.
    for (const cidr of CF_FIXTURE.slice(0, 2)) {
      for (const port of [80, 443]) {
        has(`iptables -w -A HARDEN-WEB -s ${cidr} -p tcp -m conntrack --ctorigdstport ${port} -j RETURN`);
      }
    }
    for (const port of [80, 443]) {
      has(`ip6tables -w -A HARDEN-WEB -s 2001:db8::/32 -p tcp -m conntrack --ctorigdstport ${port} -j RETURN`);
    }
    has('iptables -w -A HARDEN-WEB -p tcp -m conntrack --ctorigdstport 8000 -j RETURN');
    has('iptables -w -A HARDEN-WEB -j DROP');
    has('ip6tables -w -A HARDEN-WEB -j DROP');
    expect(lines.some((line) => /iptables -w -I DOCKER-USER 1 -i \S+ -j HARDEN-WEB/.test(line))).toBe(true);

    // No rule opens 80 or 443 to everyone: each one names a source range.
    for (const line of lines.filter((entry) => /(port|ctorigdstport) (80|443)\b/.test(entry) && !entry.includes('-j DROP'))) {
      expect(line, line).toMatch(/ (from|-s) [0-9a-f:.]+\/(?!0\b)\d+/);
    }
    expect(result.output).not.toMatch(/\/0\b/);
  });

  it('DEPLOY-27 the DOCKER-USER rules it prints are accepted by iptables and end in a drop for the public interface', () => {
    const server = startServer({ netAdmin: true });
    const install = server.sh('apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends iptables');
    expect(install.status, install.output).toBe(0);
    const dry = server.harden({ ...base, EXTRA_ALLOW_TCP: '8000', HARDEN_PUBLIC_IFACE: 'eth0' }, ['--dry-run']);
    const commands = dry.output.split('\n').filter((line) => /^\+ ip6?tables /.test(line)).map((line) => line.slice(2));
    expect(commands.length).toBeGreaterThan(10);
    // The script's own lines are shell (`a 2>/dev/null || b`), so they run through bash, twice: reapplying must not stack rules.
    for (let round = 0; round < 2; round += 1) {
      const applied = server.sh(`set -e\n${commands.join('\n')}`);
      expect(applied.status, applied.output).toBe(0);
    }
    const v4 = server.sh('iptables -S HARDEN-WEB; iptables -S DOCKER-USER').output;
    expect(v4.split('\n').filter((line) => line.includes('-s 203.0.113.0/24') && line.includes('--ctorigdstport 443'))).toHaveLength(1);
    expect(v4).toContain('-A HARDEN-WEB -j DROP');
    expect(v4.match(/-A DOCKER-USER -i eth0 -j HARDEN-WEB/g)).toHaveLength(1);
    expect(server.sh('ip6tables -S HARDEN-WEB').output).toContain('-s 2001:db8::/32');
  }, 300_000);

  it('DEPLOY-27 refuses a Cloudflare list that would open the ports to every address, before touching the firewall', () => {
    const server = startServer();
    server.sh(`printf '%s\\n' 203.0.113.0/24 2001:db8::/32 0.0.0.0/0 > ${CF_FILE}`);
    const result = server.harden(base, ['--dry-run']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('refusing the Cloudflare range');
    expect(result.output).not.toMatch(/^\+ ufw/m);
  });

  it('DEPLOY-27 refuses a Cloudflare list without an IPv6 range', () => {
    const server = startServer();
    server.sh(`printf '%s\\n' 203.0.113.0/24 > ${CF_FILE}`);
    const result = server.harden(base, ['--dry-run']);
    expect(result.status).toBe(1);
    expect(result.output).toContain('no IPv4 or no IPv6 range');
  });

  it.each([
    ['SSH_PORT', '99999999999999999999'],
    ['SSH_PORT', '0'],
    ['SSH_PORT', '65536'],
    ['SSH_PORT', 'ssh'],
    ['EXTRA_ALLOW_TCP', '70000'],
    ['EXTRA_ALLOW_TCP', '8000,0'],
    ['EXTRA_ALLOW_TCP', '22,abc'],
    ['EXTRA_ALLOW_TCP', '8000, 9000'],
    ['EXTRA_ALLOW_TCP', '443'],
    ['EXTRA_ALLOW_TCP', '8000,80'],
    ['EXTRA_ALLOW_TCP', '0443'],
  ])('DEPLOY-27 refuses %s=%s before touching anything', (name, value) => {
    const server = startServer();
    const result = server.harden({ ...base, [name]: value });
    expect(result.status).toBe(2);
    expect(result.output).toContain(name);
    expect(server.sh('id deploy').status).not.toBe(0);
    expect(server.sh('dpkg -s sudo').status).not.toBe(0);
  });

  it('DEPLOY-27 writes ports without leading zeros', () => {
    const result = startServer().harden({ ...base, SSH_PORT: '0022', EXTRA_ALLOW_TCP: '08000' }, ['--dry-run']);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('+ ufw allow 22/tcp');
    expect(result.output).toContain('+ ufw allow 8000/tcp');
    expect(result.output).not.toContain('0022');
  });

  it('DEPLOY-24 a failed package install stops the script: no step reports changed, no user and no sudoers file appear', () => {
    const server = startServer({ noNetwork: true });
    const result = server.harden(base);
    expect(result.status).not.toBe(0);
    expect(result.output).not.toMatch(/^\[[a-z0-9-]+\] changed$/m);
    expect(server.sh('id deploy').status).not.toBe(0);
    expect(server.sh('ls /etc/sudoers.d').output).not.toContain('90-deploy');
    expect(server.sh('test -e /etc/ssh/sshd_config.d/00-hardening.conf').status).not.toBe(0);
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

  it('DEPLOY-29 the firewall step is idempotent too: a second run rewrites no rule file, script or unit', () => {
    // Where systemd would run, ufw and systemctl are stubbed: the script then really writes its files.
    const server = startServer();
    server.sh(
      `printf '#!/bin/sh\\ncase "$1" in status) echo "Status: active";; esac\\nexit 0\\n' > /usr/local/bin/ufw && ` +
        `printf '#!/bin/sh\\nexit 0\\n' > /usr/local/bin/systemctl && chmod +x /usr/local/bin/ufw /usr/local/bin/systemctl`,
    );
    const env = { ...base, HARDEN_FORCE_SYSTEMD: '1', HARDEN_PUBLIC_IFACE: 'eth0' };
    const first = server.harden(env);
    expect(first.status, first.output).toBe(0);
    expect(first.output).toMatch(/^\[firewall\] changed$/m);
    expect(server.sh('cat /etc/harden/ufw.rules').output).toContain('ufw allow from 203.0.113.0/24 to any port 443 proto tcp');
    expect(server.sh('cat /usr/local/sbin/harden-docker-user.sh').output).toContain('HARDEN-WEB');
    expect(server.sh('test -f /etc/systemd/system/harden-docker-user.service').status).toBe(0);

    const fingerprint = 'find /etc /home /usr/local -xdev -type f -exec sha256sum {} + | sort | sha256sum';
    const before = server.sh(fingerprint).output;
    const second = server.harden(env);
    expect(second.status, second.output).toBe(0);
    for (const line of second.output.split('\n').filter((entry) => /^\[[a-z0-9-]+\] /.test(entry))) expect(line).toMatch(/ unchanged$/);
    expect(second.output).toMatch(/^\[firewall\] unchanged$/m);
    expect(server.sh(fingerprint).output).toBe(before);
  }, 300_000);

  it('DEPLOY-30 --dry-run changes no file under /etc, /home, /usr/local, /root or the package database', () => {
    const server = startServer();
    const fingerprint = 'find /etc /home /usr/local /root /var/lib/dpkg -xdev -type f -exec sha256sum {} + | sort | sha256sum';
    const before = server.sh(fingerprint).output;
    const result = server.harden({ ...base, HARDEN_FORCE_SYSTEMD: '1', HARDEN_PUBLIC_IFACE: 'eth0' }, ['--dry-run']);
    expect(result.status, result.output).toBe(0);
    expect(server.sh(fingerprint).output).toBe(before);
  });

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
