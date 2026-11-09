# Production Deploy Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/production-deploy/design.md`
**Status**: Approved
**Approved**: 2026-11-09 - user: "Pode seguir com as tasks, porem quero ir adiantando tudo que for possivel"
**Build**: `pnpm typecheck; pnpm lint`

**Run deploy**: `pnpm --filter @am/guardrails exec vitest run src/deploy --exclude "**/*.infra.test.ts" --reporter=verbose`

**Run infra**: `pnpm --filter @am/guardrails exec vitest run .infra.test.ts --reporter=verbose`


---

## Test Coverage Matrix

> Generated from codebase, project guidelines and spec - confirm before Execute. Guidelines found: `AGENTS.md`, `docs/workflow.md` (gates e tempo), `docs/engineering-guidelines.md`, `tooling/guardrails/vitest.config.ts`, `.github/workflows/ci.yml`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Scripts de deploy (`infra/deploy/*.sh`) | unit | Todo ramo e todo critério DEPLOY-06 a 09, 43 a 45, contra servidor HTTP falso | `tooling/guardrails/src/deploy/*.test.ts` | `pnpm --filter @am/guardrails test:deploy` |
| Workflow e compose (YAML) | unit | Cada propriedade do spec lida do YAML ou de `docker compose config` | `tooling/guardrails/src/deploy/*.test.ts` | `pnpm --filter @am/guardrails test:deploy` |
| Backup e restore (`infra/backup`) | integration | Caminho feliz, retenção, falha, não vazio, forçado, contra Postgres 18 e MinIO | `tooling/guardrails/src/deploy/*.infra.test.ts` | `pnpm --filter @am/guardrails test:infra` |
| Hardening (`infra/provision`) | integration | Duas execuções num container Debian, `--dry-run`, entradas inválidas | `tooling/guardrails/src/deploy/*.infra.test.ts` | `pnpm --filter @am/guardrails test:infra` |
| Compose de produção rodando | integration | Sobe com imagens locais, `/status`, migration que falha | `tooling/guardrails/src/deploy/*.infra.test.ts` | `pnpm --filter @am/guardrails test:infra` |
| Runbook (Markdown) | unit | Seções e nomes comparados com os arquivos | `tooling/guardrails/src/deploy/runbook.test.ts` | `pnpm --filter @am/guardrails test:deploy` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unitários | `pnpm --filter @am/guardrails test:deploy` |
| Full | Tasks com Docker (compose, MinIO, container Debian) | `pnpm --filter @am/guardrails test:deploy && pnpm --filter @am/guardrails test:infra` |
| Build | Fim de fase, workflow e config | `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration` |

---

## Execution Plan

Phases run in order; tasks run in order within a phase.


### Phase 1: Pipeline de deploy

```
T1 → T2 → T3 → T4
```

### Phase 2: Compose de produção

```
T5 → T6
```

### Phase 3: Backup e restore

```
T7 → T8 → T9
```

### Phase 4: Hardening da VPS

```
T10 → T11 → T12
```

### Phase 5: Runbook e CI

```
T13 → T14
```

---

## Task Breakdown

### T1: Smoke test script

**What**: `smoke.sh <url>` consulta `/status` até a API aparecer operacional, e o script `test:deploy`/`test:infra` no workspace guardrails separa os testes por Docker.
**Where**: `infra/deploy/smoke.sh`
**Depends on**: None
**Reuses**: `apps/web` StatusPanel (texto `API` + `Operacional`)
**Requirement**: DEPLOY-08, DEPLOY-09, DEPLOY-44

**Done when**:

- [x] Servidor HTTP falso: 200 com API Operacional passa; 200 com API Indisponível, 503 e conexão recusada falham depois do timeout, imprimindo o último status
- [x] `package.json` do guardrails ganha `test:deploy` (exclui `*.infra.test.ts`) e `test:infra`; o `test` existente exclui `*.infra.test.ts`
- [x] Gate passa: `pnpm --filter @am/guardrails test:deploy`
- [x] Testes novos: 5, sem apagar nenhum

**Tests**: unit
**Gate**: quick

**Commit**: `feat(infra): smoke test script`

---

### T2: Script do Coolify

**What**: `coolify.sh <tag>` grava `IMAGE_TAG` e dispara o deploy, na ordem, com os erros do design.
**Where**: `infra/deploy/coolify.sh`
**Depends on**: T1
**Reuses**: Servidor falso de T1
**Requirement**: DEPLOY-06, DEPLOY-07, DEPLOY-43

**Done when**:

- [x] Servidor falso recebe, nessa ordem, a gravação de `IMAGE_TAG=<tag>` e o disparo, ambos com `Authorization: Bearer`
- [x] Secret ausente: sai 2 nomeando a variável e não faz nenhuma chamada; o valor do token nunca aparece na saída
- [x] Resposta 4xx/5xx na gravação ou no disparo: sai 1 com o status HTTP e não chama o disparo quando a gravação falhou
- [x] `COOLIFY_RESOURCE_KIND=services` troca o caminho das rotas
- [x] Gate passa: `pnpm --filter @am/guardrails test:deploy`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(infra): script do coolify`

---

### T3: Verificação de tag no GHCR

**What**: `check-tag.sh <tag>` confirma que as três imagens têm a tag antes do rollback.
**Where**: `infra/deploy/check-tag.sh`
**Depends on**: T2
**Reuses**: Servidor falso de T1
**Requirement**: DEPLOY-45

**Done when**:

- [x] Registry falso com as três imagens: sai 0; faltando uma: sai 1 listando qual
- [x] Gate passa: `pnpm --filter @am/guardrails test:deploy`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(infra): verificação de tag no ghcr`

---

### T4: Workflow de deploy

**What**: `deploy.yml` com `gates` (workflow_call do `ci.yml`), `build`, `publish` e `release`, mais o rollback manual; `ci.yml` ganha `workflow_call`.
**Where**: `.github/workflows/deploy.yml`
**Depends on**: T3
**Reuses**: `.github/workflows/ci.yml`, `ci-workflow.test.ts`
**Requirement**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-10, DEPLOY-22, DEPLOY-42

**Done when**:

- [x] Teste lê o YAML: triggers só `push` em `main` e `workflow_dispatch`; `build` e `publish` dependem de `gates`; `publish` depende de `build`, e `build` usa `push: false`; `release` roda `check-tag.sh` e `coolify.sh` e depois `smoke.sh`
- [x] Matrix constrói `api`, `web` e `backup` e publica com a tag igual a `github.sha`
- [x] `permissions` mínimas, `packages: write` só em `publish`, toda action por SHA, `concurrency` sem `cancel-in-progress`
- [x] Com `tag` informada os jobs `gates`, `build` e `publish` são pulados
- [x] O teste `ci-workflow.test.ts` muda só a lista de triggers (acrescenta `workflow_call`), sem enfraquecer nenhuma outra asserção; actionlint do CI continua verde
- [x] Gate passa: `pnpm --filter @am/guardrails test:deploy` e `pnpm --filter @am/guardrails test`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(infra): workflow de deploy`

---

### T5: Compose de produção

**What**: `infra/compose.prod.yaml` com os cinco serviços.
**Where**: `infra/compose.prod.yaml`
**Depends on**: None
**Reuses**: `compose.yaml`
**Requirement**: DEPLOY-11, DEPLOY-12, DEPLOY-13, DEPLOY-14, DEPLOY-15, DEPLOY-16, DEPLOY-18

**Done when**:

- [x] Teste roda `docker compose config` com todas as variáveis (ok) e sem `IMAGE_TAG`, `POSTGRES_PASSWORD` ou `WEB_PUBLIC_URL` (falha nomeando cada uma)
- [x] Teste lê o resultado: imagens `${IMAGE_REPOSITORY}-web|-api|-backup:${IMAGE_TAG}`, `postgres` e `api` sem `ports`, `SESSION_COOKIE_SECURE=true`, `CLIENT_IP_HEADER=cf-connecting-ip` mesmo com valores diferentes no ambiente, `restart: unless-stopped`, `migrate` antes da `api`, volume nomeado do Postgres
- [x] Nenhum IP, hostname, senha ou token literal no arquivo
- [x] Gate passa: `pnpm --filter @am/guardrails test:deploy`

**Tests**: integration
**Gate**: quick

**Commit**: `feat(infra): compose de produção`

---

### T6: Stack de produção local

**What**: Teste de infraestrutura que constrói as imagens dos Dockerfiles, sobe o compose de produção e lê `/status`.
**Where**: `tooling/guardrails/src/deploy/compose-prod.infra.test.ts`
**Depends on**: T5
**Reuses**: `tests/e2e` (padrão de subir compose), `smoke.sh`
**Requirement**: DEPLOY-17, DEPLOY-44

**Done when**:

- [x] Com imagens locais (`IMAGE_REPOSITORY`/`IMAGE_TAG` locais) e sem rede para o GHCR, `GET /status` do `web` responde 200 com API e Banco operacionais, e `smoke.sh` sai 0
- [x] Com `migrate` substituído por um comando que falha (override só do teste), a `api` não inicia e `smoke.sh` sai 1
- [x] Gate passa: `pnpm --filter @am/guardrails test:infra`

**Tests**: integration
**Gate**: full

**Commit**: `feat(infra): stack de produção local`

---

### T7: Backup: ciclo, retenção e agendamento

**What**: Imagem do backup e `backup.sh`.
**Where**: `infra/backup/backup.sh`
**Depends on**: None
**Reuses**: `apps/api` (campos do log estruturado), digest do Postgres do compose
**Requirement**: DEPLOY-33, DEPLOY-34, DEPLOY-35, DEPLOY-36, DEPLOY-37, DEPLOY-38

**Done when**:

- [x] `infra/backup/Dockerfile` (base por digest, `aws-cli` e `jq` com versão fixada) constrói
- [x] Com Postgres e MinIO (Testcontainers): `--once` grava `<prefixo>/<ISO UTC>.dump` que `pg_restore --list` lê
- [x] Objetos mais velhos que `BACKUP_RETENTION_DAYS` somem só depois de um envio bem-sucedido; envio falho (bucket inexistente) sai ≠ 0, loga o erro e deixa os antigos
- [x] A espera até `BACKUP_SCHEDULE_UTC_HOUR` é calculada por função testada para antes, depois e igual à hora atual
- [x] Nenhuma saída contém a senha do banco, a chave ou o segredo S3
- [x] Gate passa: `pnpm --filter @am/guardrails test:infra`

**Tests**: integration
**Gate**: full

**Commit**: `feat(infra): backup: ciclo, retenção e agendamento`

---

### T8: Backup: restore

**What**: `restore.sh` restaura um backup num banco vazio.
**Where**: `infra/backup/restore.sh`
**Depends on**: T7
**Reuses**: MinIO e Postgres de T7
**Requirement**: DEPLOY-39, DEPLOY-40

**Done when**:

- [x] Restaura por chave e por `--latest` num banco vazio e imprime `migrations=<n>` igual ao do original
- [x] Destino não vazio: sai ≠ 0 sem alterar nada; com `--force` restaura
- [x] Gate passa: `pnpm --filter @am/guardrails test:infra`

**Tests**: integration
**Gate**: full

**Commit**: `feat(infra): backup: restore`

---

### T9: Backup: verificação de restore

**What**: `verify-restore.sh` prova que o último backup restaura.
**Where**: `infra/backup/verify-restore.sh`
**Depends on**: T8
**Reuses**: `apps/api/drizzle/meta/_journal.json`
**Requirement**: DEPLOY-41

**Done when**:

- [x] Backup do banco migrado: sai 0 e remove o banco descartável
- [x] Backup de banco sem a última migration: sai ≠ 0 mostrando as duas contagens
- [x] Gate passa: `pnpm --filter @am/guardrails test:infra`

**Tests**: integration
**Gate**: full

**Commit**: `feat(infra): backup: verificação de restore`

---

### T10: Hardening: entradas, usuário, idempotência e dry-run

**What**: `harden.sh` com validação das entradas, usuário, chave e `--dry-run`.
**Where**: `infra/provision/harden.sh`
**Depends on**: None
**Reuses**: Nada
**Requirement**: DEPLOY-24, DEPLOY-25, DEPLOY-29, DEPLOY-30, DEPLOY-31

**Done when**:

- [x] Em container Debian descartável: cria o usuário sem senha, com `sudo` e grupo `docker`, e instala a chave
- [x] Chave vazia ou inválida: sai ≠ 0 antes de alterar usuário, sshd ou firewall
- [x] Segunda execução idêntica: sai 0 e reporta `unchanged` em todo passo, sem mudar arquivo
- [x] `--dry-run` imprime os comandos e não altera o container
- [x] Nenhum IP, usuário ou chave literal em `infra/provision/`
- [x] Gate passa: `pnpm --filter @am/guardrails test:infra`

**Tests**: integration
**Gate**: full

**Commit**: `feat(infra): hardening: entradas, usuário, idempotência e dry-run`

---

### T11: Hardening: SSH, fail2ban e atualizações

**What**: Passos de `sshd`, `fail2ban` e `unattended-upgrades`.
**Where**: `infra/provision/harden.sh` (modify)
**Depends on**: T10
**Reuses**: T10
**Requirement**: DEPLOY-26, DEPLOY-28

**Done when**:

- [x] Drop-in `sshd_config.d` desabilita root e senha; `sshd -t` roda antes do recarregamento
- [x] Drop-in inválido: removido e configuração anterior preservada, sai ≠ 0
- [x] `fail2ban` com jail do SSH e `unattended-upgrades` configurados e habilitados
- [x] Gate passa: `pnpm --filter @am/guardrails test:infra`

**Tests**: integration
**Gate**: full

**Commit**: `feat(infra): hardening: ssh, fail2ban e atualizações`

---

### T12: Hardening: firewall

**What**: Passo `ufw` e `DOCKER-USER` com as faixas da Cloudflare.
**Where**: `infra/provision/harden.sh` (modify)
**Depends on**: T11
**Reuses**: T10
**Requirement**: DEPLOY-27

**Done when**:

- [x] `--dry-run` mostra: entrada negada por padrão, porta SSH e `EXTRA_ALLOW_TCP` permitidas, 80/443 só para cada faixa IPv4 e IPv6 do arquivo `HARDEN_CF_IPS_FILE`, e as mesmas regras na chain `DOCKER-USER`
- [x] Nenhuma regra libera 80/443 para `0.0.0.0/0` ou `::/0`
- [x] Gate passa: `pnpm --filter @am/guardrails test:infra`

**Tests**: integration
**Gate**: full

**Commit**: `feat(infra): hardening: firewall`

---

### T13: Runbook do primeiro deploy

**What**: Runbook com seções, tabela de variáveis, rollback, admin, hardening seguro.
**Where**: `docs/runbooks/production-deploy.md`
**Depends on**: None
**Reuses**: `docs/guia-teste-manual.md` (estilo)
**Requirement**: DEPLOY-19, DEPLOY-20, DEPLOY-21, DEPLOY-23, DEPLOY-32

**Done when**:

- [x] Teste confere as seções na ordem do spec
- [x] Teste compara os nomes da tabela de variáveis com `infra/compose.prod.yaml`, `deploy.yml` e os scripts: nome faltando ou sobrando falha
- [x] Rollback aciona o workflow com a tag anterior; admin com `create-admin --password-stdin`; sessão SSH aberta e acesso ao painel do Coolify descritos
- [x] O runbook manda tornar os três pacotes do GHCR públicos e conferir a API do Coolify na instância
- [x] Gate passa: `pnpm --filter @am/guardrails test:deploy`

**Tests**: unit
**Gate**: quick

**Commit**: `docs: runbook do primeiro deploy`

---

### T14: Testes de infraestrutura no CI

**What**: Passo `test:infra` no job `integration` do `ci.yml`.
**Where**: `.github/workflows/ci.yml`
**Depends on**: T13
**Reuses**: `ci-workflow.test.ts`
**Requirement**: DEPLOY-17

**Done when**:

- [ ] O job `integration` roda `pnpm --filter @am/guardrails test:infra` e o teste de workflow confere
- [ ] Gate passa: `pnpm lint; pnpm typecheck; pnpm test`

**Tests**: unit
**Gate**: build

**Commit**: `feat(infra): testes de infraestrutura no ci`

---

## Checks

**C1** - Um push na `main` roda lint, typecheck, testes e scan de segredos antes de qualquer build (DEPLOY-01)
Proof: run deploy | ✓ DEPLOY-01

**C2** - Gate vermelho impede build, publicação e chamada ao Coolify (DEPLOY-02)
Proof: run deploy | ✓ DEPLOY-02

**C3** - As imagens web, api e backup são publicadas com a tag igual ao SHA do commit (DEPLOY-03)
Proof: run deploy | ✓ DEPLOY-03

**C4** - `permissions` mínimas, `packages: write` só em `publish`, actions por SHA (DEPLOY-04)
Proof: run deploy | ✓ DEPLOY-04

**C5** - O workflow dispara só em push na `main` e `workflow_dispatch` (DEPLOY-05)
Proof: run deploy | ✓ DEPLOY-05

**C6** - O Coolify recebe `IMAGE_TAG=<sha>` e depois o disparo do deploy, com bearer (DEPLOY-06)
Proof: run deploy | ✓ DEPLOY-06

**C7** - Secret ausente sai 2 nomeando a variável, sem imprimir valor (DEPLOY-07)
Proof: run deploy | ✓ DEPLOY-07

**C8** - O smoke consulta `/status` até 200 com API Operacional (DEPLOY-08)
Proof: run deploy | ✓ DEPLOY-08

**C9** - Sem 200 em 300 s o smoke sai 1 com o último status HTTP (DEPLOY-09)
Proof: run deploy | ✓ DEPLOY-09

**C10** - Dois pushes serializam sem cancelar o deploy em curso (DEPLOY-10)
Proof: run deploy | ✓ DEPLOY-10

**C11** - O compose de produção tem os cinco serviços e as imagens pela tag (DEPLOY-11)
Proof: run deploy | ✓ DEPLOY-11

**C12** - Variável obrigatória ausente faz `docker compose config` falhar nomeando-a (DEPLOY-12)
Proof: run deploy | ✓ DEPLOY-12

**C13** - `postgres` e `api` não publicam porta (DEPLOY-13)
Proof: run deploy | ✓ DEPLOY-13

**C14** - Cookie Secure e `cf-connecting-ip` fixos no compose (DEPLOY-14)
Proof: run deploy | ✓ DEPLOY-14

**C15** - `migrate` roda antes da `api` e os serviços reiniciam sozinhos (DEPLOY-15)
Proof: run deploy | ✓ DEPLOY-15

**C16** - Os dados do Postgres ficam em volume nomeado (DEPLOY-16)
Proof: run deploy | ✓ DEPLOY-16

**C17** - O compose de produção sobe localmente e `/status` mostra API e banco operacionais (DEPLOY-17)
Proof: run infra | ✓ DEPLOY-17

**C18** - O compose não contém IP, hostname, senha ou token literal (DEPLOY-18)
Proof: run deploy | ✓ DEPLOY-18

**C19** - O runbook tem as seções na ordem do spec (DEPLOY-19)
Proof: run deploy | ✓ DEPLOY-19

**C20** - Os nomes de variáveis do runbook coincidem com compose, workflow e scripts (DEPLOY-20)
Proof: run deploy | ✓ DEPLOY-20

**C21** - O runbook descreve o rollback por SHA anterior (DEPLOY-21)
Proof: run deploy | ✓ DEPLOY-21

**C22** - O acionamento manual com tag pula o build e reimplanta a tag (DEPLOY-22)
Proof: run deploy | ✓ DEPLOY-22

**C23** - O runbook cria o admin com `--password-stdin` (DEPLOY-23)
Proof: run deploy | ✓ DEPLOY-23

**C24** - `harden.sh` cria o usuário e instala a chave (DEPLOY-24)
Proof: run infra | ✓ DEPLOY-24

**C25** - Chave ausente ou inválida aborta antes de alterar o servidor (DEPLOY-25)
Proof: run infra | ✓ DEPLOY-25

**C26** - O drop-in do sshd é validado com `sshd -t` e revertido se falha (DEPLOY-26)
Proof: run infra | ✓ DEPLOY-26

**C27** - 80/443 só para as faixas da Cloudflare, no ufw e no DOCKER-USER (DEPLOY-27)
Proof: run infra | ✓ DEPLOY-27

**C28** - `fail2ban` e atualizações automáticas ficam habilitados (DEPLOY-28)
Proof: run infra | ✓ DEPLOY-28

**C29** - A segunda execução do hardening não muda nada (DEPLOY-29)
Proof: run infra | ✓ DEPLOY-29

**C30** - `--dry-run` imprime os comandos sem alterar o sistema (DEPLOY-30)
Proof: run infra | ✓ DEPLOY-30

**C31** - Nenhum valor específico de servidor no script de hardening (DEPLOY-31)
Proof: run infra | ✓ DEPLOY-31

**C32** - O runbook exige sessão SSH aberta e explica o acesso ao painel do Coolify (DEPLOY-32)
Proof: run deploy | ✓ DEPLOY-32

**C33** - O backup grava um `pg_dump` custom em `<prefixo>/<ISO UTC>.dump` (DEPLOY-33)
Proof: run infra | ✓ DEPLOY-33

**C34** - O backup roda por dia na hora configurada e com `--once` na hora (DEPLOY-34)
Proof: run infra | ✓ DEPLOY-34

**C35** - Falha no dump ou envio sai ≠ 0, loga o erro e preserva os antigos (DEPLOY-35)
Proof: run infra | ✓ DEPLOY-35

**C36** - Depois de um envio bem-sucedido, o que passa da retenção é apagado (DEPLOY-36)
Proof: run infra | ✓ DEPLOY-36

**C37** - O backup usa só API S3 genérica por endpoint configurável (DEPLOY-37)
Proof: run infra | ✓ DEPLOY-37

**C38** - Nenhuma credencial aparece nos logs do backup (DEPLOY-38)
Proof: run infra | ✓ DEPLOY-38

**C39** - O restore recupera um backup num banco vazio e imprime a contagem de migrations (DEPLOY-39)
Proof: run infra | ✓ DEPLOY-39

**C40** - Destino não vazio recusa o restore, exceto com `--force` (DEPLOY-40)
Proof: run infra | ✓ DEPLOY-40

**C41** - `verify-restore.sh` sai 0 só quando as migrations coincidem com o repositório (DEPLOY-41)
Proof: run infra | ✓ DEPLOY-41

**C42** - Uma imagem que falha no build impede a publicação das outras (DEPLOY-42)
Proof: run deploy | ✓ DEPLOY-42

**C43** - Erro da API do Coolify falha o workflow com o status HTTP e sem smoke (DEPLOY-43)
Proof: run deploy | ✓ DEPLOY-43

**C44** - Migration que falha impede a `api` e reprova o smoke (DEPLOY-44)
Proof: run infra | ✓ DEPLOY-44

**C45** - Tag inexistente no GHCR falha antes do Coolify (DEPLOY-45)
Proof: run deploy | ✓ DEPLOY-45

---

## Handoff

**Settled mid-build:** none
**Dispatched:** none
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

Execution is strictly sequential. Os testes `*.infra.test.ts` precisam de Docker rodando na máquina.
