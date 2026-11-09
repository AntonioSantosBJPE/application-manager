import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { repoRoot } from '../repo.js';

const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');
const runbook = read('docs/runbooks/production-deploy.md');

/** The names in the first column of the runbook's variables table. */
const tableNames = new Set([...runbook.matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gm)].map((match) => match[1]!));

/** Variables each script documents and reads, so a rename in a script breaks this test. */
const scriptVariables: Record<string, string[]> = {
  'infra/deploy/coolify.sh': ['COOLIFY_URL', 'COOLIFY_TOKEN', 'COOLIFY_RESOURCE_UUID', 'COOLIFY_RESOURCE_KIND'],
  'infra/provision/harden.sh': ['ADMIN_USER', 'ADMIN_SSH_PUBLIC_KEY', 'SSH_PORT', 'EXTRA_ALLOW_TCP', 'HARDEN_CF_IPS_FILE', 'HARDEN_PUBLIC_IFACE'],
  'infra/backup/restore.sh': ['TARGET_DATABASE_URL'],
  'infra/backup/verify-restore.sh': ['MIGRATIONS_JOURNAL'],
};

/** Every `${NAME` the compose file reads (not the `$${NAME}` escaped for a shell inside a container). */
const composeVariables = [...read('infra/compose.prod.yaml').matchAll(/(?<!\$)\$\{([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]!);
const workflowText = read('.github/workflows/deploy.yml');
const workflowNames = [...workflowText.matchAll(/\b(?:secrets|vars)\.([A-Z][A-Z0-9_]*)/g)]
  .map((match) => match[1]!)
  .filter((name) => name !== 'GITHUB_TOKEN');

/** Headings in the order the spec asks for (DEPLOY-19). */
const sections = [
  /^## 1\. Preparar o servidor \(hardening\)$/m,
  /^## 2\. DNS e Cloudflare$/m,
  /^## 3\. Recurso no Coolify$/m,
  /^## 4\. Secrets do GitHub$/m,
  /^## 5\. Primeiro deploy$/m,
  /^## 6\. Criar o primeiro admin$/m,
  /^## 7\. Verificar e reverter$/m,
];

/** The text of one `## N.` section. */
function section(number: number): string {
  const start = runbook.search(sections[number - 1]!);
  const rest = runbook.slice(start + 1);
  const next = rest.search(/^## /m);
  return runbook.slice(start, next === -1 ? undefined : start + 1 + next);
}

describe('production deploy runbook', () => {
  it('DEPLOY-19 has the sections in order: server, DNS and Cloudflare, Coolify, GitHub secrets, first deploy, admin, verify and roll back', () => {
    const positions = sections.map((pattern) => runbook.search(pattern));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(section(2)).toContain('Full (strict)');
    expect(section(2)).toContain('Origin Certificate');
    expect(section(3)).toContain('infra/compose.prod.yaml');
    expect(section(3)).toContain('Docker Compose');
  });

  it('DEPLOY-20 lists every variable and secret the compose file, the workflow and the scripts read, and nothing that no one reads', () => {
    const expected = new Set([...composeVariables, ...workflowNames, ...Object.values(scriptVariables).flat()]);
    for (const name of expected) expect(tableNames, `${name} is read but missing from the runbook table`).toContain(name);
    for (const name of tableNames) expect(expected, `${name} is in the runbook table but nothing reads it`).toContain(name);
    // The script lists are not stale: each name is still in its script.
    for (const [file, names] of Object.entries(scriptVariables)) {
      for (const name of names) expect(read(file), `${name} in ${file}`).toContain(name);
    }
  });

  it('DEPLOY-20 uses, for the names it shares with .env.example, the very same spelling', () => {
    const example = new Set([...read('.env.example').matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]!));
    const shared = composeVariables.filter((name) => example.has(name));
    // POSTGRES_*, WEB_PUBLIC_URL and LOG_LEVEL exist in both files and in the runbook table.
    expect(shared).toEqual(expect.arrayContaining(['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'WEB_PUBLIC_URL', 'LOG_LEVEL']));
    for (const name of shared) expect(tableNames, `${name} is in .env.example and compose.prod.yaml but not in the runbook table`).toContain(name);
  });

  it('DEPLOY-20 asks for a database password the URL can carry, and the runbook does not suggest one with reserved characters', () => {
    expect(runbook).toContain('openssl rand -hex 32');
    expect(runbook).not.toContain('openssl rand -base64');
  });

  it('DEPLOY-21 describes the rollback as a manual run of the workflow with the previous SHA, which builds nothing', () => {
    const rollback = runbook.slice(runbook.indexOf('**Reverter (rollback)**'));
    expect(rollback).toContain('Run workflow');
    expect(rollback).toContain('`tag`');
    expect(rollback).toContain('SHA anterior');
    expect(rollback).toMatch(/pula os gates e a construção/);
    // A failed migration is an outage, and the runbook says so and sends the author to the rollback.
    expect(rollback).toContain('Uma migration que falha derruba o site');
    const dispatch = (parse(workflowText) as { on: { workflow_dispatch: { inputs: Record<string, unknown> } } }).on.workflow_dispatch;
    expect(Object.keys(dispatch.inputs)).toContain('tag');
  });

  it('DEPLOY-23 creates the first admin with create-admin reading the password from stdin, never as an argument', () => {
    const admin = section(6);
    expect(admin).toMatch(/create-admin --email \S+ --name "[^"]*" --password-stdin/);
    expect(admin).toMatch(/printf '%s' "\$ADMIN_PASSWORD" \| docker exec -i/);
    // No flag carries the password itself.
    expect(admin).not.toMatch(/--password[= ](?!-?stdin)/);
    // And the flags are the ones the CLI accepts.
    const cli = read('apps/api/src/modules/identity/cli/run-identity-cli.ts');
    for (const flag of ['create-admin', '--email', '--name', '--password-stdin']) expect(cli).toContain(flag);
  });

  it('DEPLOY-32 tells the author to keep an SSH session open and explains how to reach the Coolify panel afterwards', () => {
    const hardening = section(1);
    expect(hardening).toMatch(/Mantenha uma sessão SSH aberta/);
    expect(hardening).toMatch(/sessão nova/);
    expect(hardening).toContain('Túnel SSH');
    expect(hardening).toMatch(/ssh .* -L 8000:127\.0\.0\.1:8000/);
    expect(hardening).toContain('painel do Coolify');
    expect(hardening).toContain('EXTRA_ALLOW_TCP');
  });
});
