# Production Deploy Specification

**Approved**: 2026-11-09 - user: "aporvado"

## Problem Statement

O sistema só roda na máquina do desenvolvedor. A VPS e o domínio já foram contratados e o Coolify está instalado com configuração básica, mas nada leva o código da `main` até lá: não há imagem publicada, compose de produção, servidor endurecido nem backup. As diretrizes mandam "deploy primeiro, feature depois": as fatias seguintes só valem quando nascem em produção.

## Goals

- [ ] Todo push na `main` com os gates verdes publica as imagens `web` e `api` no GHCR e atualiza a stack no Coolify sem ação manual, com falha visível quando algo quebra.
- [ ] O mesmo compose de produção sobe a stack em qualquer servidor com Docker, com ou sem Coolify.
- [ ] A VPS é endurecida por um script versionado, ensaiado fora dela, e o Postgres tem backup no R2 com restore provado.
- [ ] Um runbook leva o autor do estado atual (Coolify básico, DNS sem apontar) até o produto no ar e ao primeiro admin.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Preview por PR | Não escolhido nesta rodada; fica no roadmap |
| Ambiente de staging | Um só ambiente (produção) com um só usuário |
| Build e deploy filtrados por caminho (só o `web`, só a `api`) | As duas imagens são construídas a cada push na `main`; o cache de camadas segura o tempo. Reavaliar se o build passar de 5 minutos |
| OpenTelemetry, Grafana, Loki, Uptime Kuma, Sentry | Feature de observabilidade, depois do primeiro deploy |
| Cloudflare Tunnel | Escolhido proxy com portas restritas |
| Operar a VPS, o Coolify, a Cloudflare ou o GitHub por mim | O agente entrega código, scripts e runbook; quem aplica na VPS e nas contas é o autor (blast radius) |
| Restore agendado automaticamente | O teste de restore é um script que o autor roda; o runbook define a frequência |
| E-mail de alerta de falha do backup | Falha aparece no log do container e no status do Coolify |
| Alta disponibilidade, réplicas, PgBouncer | Uma VPS, um usuário |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Escopo | GHCR + deploy automático, domínio + Cloudflare, hardening como script, backup + restore | Resposta do usuário: "Imagens no GHCR + deploy automático, Domínio + Cloudflare (Full strict), Hardening da VPS como script, Backup Postgres → R2 + restore testado" | y |
| Mecanismo | `infra/compose.prod.yaml` com imagens do GHCR; o CI publica e aciona o Coolify | Resposta do usuário: "Compose de produção com imagens do GHCR" | y |
| Gatilho | Push na `main` → gates verdes → deploy automático, com smoke test depois | Resposta do usuário: "Push na main → CI verde → deploy automático" | y |
| Domínio | Comprado, DNS ainda não apontado; o nome vem de variável (`WEB_PUBLIC_URL`), nunca de arquivo versionado | Resposta do usuário: "Domínio comprado, DNS ainda não apontado"; diretriz de não gravar hostname | y |
| Borda | Proxy da Cloudflare, SSL Full (strict), 80/443 abertas só às faixas da Cloudflare | Resposta do usuário: "Proxy + 80/443 só para IPs da Cloudflare" | y |
| Visibilidade das imagens | Públicas no GHCR; a VPS baixa sem credencial | Resposta do usuário: "Públicas"; as imagens não levam segredo (AD-001) | y |
| Hardening | Script idempotente ensaiado em container local; o autor o aplica na VPS seguindo o runbook | Resposta do usuário: "Script idempotente + ensaio em VM/container local" | y |
| Admin e backup | `create-admin` via runbook; backup é um serviço do compose de produção | Resposta do usuário: "CLI create-admin via runbook; backup como container agendado" | y |
| Troca de versão no Coolify | O workflow grava `IMAGE_TAG=<sha>` como variável do recurso no Coolify pela API e dispara o deploy; o Coolify lê o compose do repositório (`infra/compose.prod.yaml`) | Mantém o compose como fonte de verdade e dá rollback por tag | n |
| Docker ignora o `ufw` | Portas publicadas pelo Docker (Traefik do Coolify em 80/443) contornam o `ufw`; a restrição às faixas da Cloudflare entra na chain `DOCKER-USER` além do `ufw` | Só o `ufw` deixaria 80/443 abertas ao mundo | n |
| Acesso ao painel do Coolify | O hardening fecha a porta do painel ao mundo; o acesso passa a ser por túnel SSH ou pelo domínio do Coolify atrás da Cloudflare; `EXTRA_ALLOW_TCP` permite exceções | Painel de deploy exposto ao mundo é a maior superfície da VPS | n |
| Gates do PR | `CI_FULL` continua desligando e2e e build das imagens no PR; a validação das imagens acontece no workflow de deploy da `main`, antes de publicar | Mantém o PR dentro do orçamento de 3 minutos ([docs/workflow.md](../../../docs/workflow.md)) | n |
| Provas que dependem da VPS | Nenhum teste automatizado toca a VPS, o Coolify real ou a Cloudflare; o que o repositório prova é o conteúdo dos arquivos, o compose de produção rodando localmente e os scripts em container; a jornada real é o passo a passo do runbook, executado pelo autor | O agente não opera a infraestrutura remota | y |
| Backup | `pg_dump` em formato custom enviado a um bucket S3-compatível (R2) por um container do compose de produção, diariamente, com retenção padrão de 14 dias | Portável: SDK S3 genérico, sem recurso do Coolify | n |

Os itens `n` são defaults meus para você corrigir ao aprovar.

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Publicar e implantar a cada push na `main` ⭐ MVP

**User Story**: Como autor, quero que cada merge na `main` vire imagens publicadas e uma stack atualizada na VPS, para que toda feature nasça em produção sem passos manuais.

**Why P1**: É o objetivo da fase 0 ("VPS com deploy automático").

**Acceptance Criteria**:

1. WHEN há um push na `main` THEN o workflow de deploy SHALL executar lint, typecheck, testes unitários, testes de integração e o scan de segredos antes de construir qualquer imagem. (DEPLOY-01)
2. IF qualquer um desses gates falha THEN o workflow SHALL terminar com falha sem publicar imagem e sem acionar o Coolify. (DEPLOY-02)
3. WHEN os gates passam THEN o workflow SHALL construir as imagens `web` e `api` com os Dockerfiles existentes e publicá-las no GHCR com a tag igual ao SHA completo do commit. (DEPLOY-03)
4. The workflow SHALL declarar `permissions` mínimas, dar `packages: write` só ao job que publica, e fixar cada action de terceiros por SHA. (DEPLOY-04)
5. The workflow SHALL disparar apenas em push na `main` e em acionamento manual, nunca em `pull_request`, `pull_request_target` ou evento de fork. (DEPLOY-05)
6. WHEN as imagens foram publicadas THEN o workflow SHALL gravar `IMAGE_TAG` com o SHA no recurso do Coolify e disparar o deploy pela API, com URL e token lidos de GitHub Actions secrets. (DEPLOY-06)
7. IF um secret exigido pelo workflow não está definido THEN o workflow SHALL terminar com falha antes de publicar, numa mensagem que nomeia o secret ausente e nunca imprime valor de secret. (DEPLOY-07)
8. WHEN o Coolify aceitou o deploy THEN o workflow SHALL consultar `<WEB_PUBLIC_URL>/status` a cada 10 segundos até receber `200` com a API operacional, por no máximo 5 minutos. (DEPLOY-08)
9. IF o smoke test não recebe `200` em 5 minutos THEN o workflow SHALL terminar com falha e imprimir o último status HTTP recebido. (DEPLOY-09)
10. WHILE um deploy está em andamento um segundo push SHALL esperar na fila, sem cancelar o deploy em curso. (DEPLOY-10)

**Independent Test**: Os testes leem o YAML do workflow e provam cada propriedade; o script de smoke test roda contra um servidor local que responde `200`, `503` e não responde.

---

### P1: Compose de produção portável ⭐ MVP

**User Story**: Como autor, quero um compose de produção que use as imagens publicadas, para subir a mesma stack na VPS, em outra VPS ou em casa.

**Why P1**: Sem ele o Coolify não tem o que rodar, e a portabilidade é regra do projeto.

**Acceptance Criteria**:

1. The `infra/compose.prod.yaml` SHALL declarar os serviços `postgres`, `migrate`, `api`, `web` e `backup`, com `web` e `api` usando as imagens `ghcr.io/<dono>/<repositório>-web` e `-api` na tag de `IMAGE_TAG`. (DEPLOY-11)
2. IF `IMAGE_TAG` ou uma variável de segredo (`POSTGRES_PASSWORD`, `WEB_PUBLIC_URL`) está ausente THEN `docker compose config` SHALL falhar nomeando a variável. (DEPLOY-12)
3. The `postgres` e a `api` SHALL não publicar porta no host (AD-004); só o `web` é alcançável pelo proxy. (DEPLOY-13)
4. The `api` SHALL subir com `SESSION_COOKIE_SECURE=true` e o `web` com `CLIENT_IP_HEADER=cf-connecting-ip`, sem que uma variável do ambiente local do autor os altere. (DEPLOY-14)
5. WHEN a stack sobe THEN `migrate` SHALL terminar com código 0 antes de a `api` iniciar, e a `api` e o `web` SHALL reiniciar sozinhos após uma queda do processo ou reboot do servidor. (DEPLOY-15)
6. The Postgres SHALL guardar os dados num volume nomeado que sobrevive a `docker compose down` e a um novo deploy. (DEPLOY-16)
7. WHEN o compose de produção sobe localmente com imagens construídas dos Dockerfiles do repositório THEN `GET /status` no `web` SHALL responder `200` com "API" e "Banco de dados" operacionais, sem Coolify e sem acesso ao GHCR. (DEPLOY-17)
8. The `infra/compose.prod.yaml` SHALL não conter IP, hostname, senha ou token reais, só referências a variáveis. (DEPLOY-18)

**Independent Test**: Um teste roda `docker compose config` com e sem as variáveis, e outro sobe a stack com as imagens locais e lê `/status`.

---

### P1: Runbook do primeiro deploy ⭐ MVP

**User Story**: Como autor, quero um passo a passo do estado atual até o produto no ar, para fazer a parte que depende das minhas contas sem adivinhar.

**Why P1**: DNS, Coolify, Cloudflare e secrets do GitHub só o autor aplica.

**Acceptance Criteria**:

1. The `docs/runbooks/production-deploy.md` SHALL conter, em ordem, as seções: preparar o servidor (hardening), DNS e Cloudflare (Full strict, origin certificate), recurso no Coolify (compose do repositório, variáveis), secrets do GitHub, primeiro deploy, criar o primeiro admin, verificar e reverter. (DEPLOY-19)
2. The runbook SHALL listar cada variável e secret exigido (nome, onde fica, para que serve) em tabela cujos nomes coincidem com os de `infra/compose.prod.yaml`, de `.env.example` e do workflow; um teste falha quando divergem. (DEPLOY-20)
3. The runbook SHALL descrever o rollback: acionar o workflow manualmente com o SHA anterior, que reimplanta aquela tag sem construir imagem. (DEPLOY-21)
4. WHEN o workflow é acionado manualmente com uma tag existente no GHCR THEN ele SHALL pular a construção, gravar essa tag no Coolify, disparar o deploy e rodar o smoke test. (DEPLOY-22)
5. The runbook SHALL descrever a criação do primeiro admin com `create-admin` lendo a senha por stdin (`--password-stdin`), sem a senha em argumento de linha de comando. (DEPLOY-23)

**Independent Test**: Um teste de repositório lê o runbook, o compose, o workflow e `.env.example` e compara seções e nomes.

---

### P2: Hardening da VPS como código

**User Story**: Como autor, quero um script que endureça o servidor e seja seguro de rodar duas vezes, para não depender de memória nem arriscar ficar sem acesso.

**Why P2**: Necessário antes de expor o domínio, mas o deploy já funciona sem ele.

**Acceptance Criteria**:

1. WHEN `infra/provision/harden.sh` roda com `ADMIN_USER` e `ADMIN_SSH_PUBLIC_KEY` THEN ele SHALL criar o usuário sem senha, no grupo `docker` e com `sudo`, e instalar a chave em `authorized_keys`. (DEPLOY-24)
2. IF `ADMIN_SSH_PUBLIC_KEY` está vazia ou inválida THEN o script SHALL terminar com código diferente de 0 antes de alterar o `sshd`, o firewall ou qualquer usuário. (DEPLOY-25)
3. WHEN o script configura o SSH THEN ele SHALL desabilitar login de root e por senha num arquivo `sshd_config.d`, validar com `sshd -t` e só então recarregar o serviço; IF a validação falha THEN SHALL remover o arquivo novo e manter a configuração anterior. (DEPLOY-26)
4. WHEN o script configura o firewall THEN ele SHALL negar entrada por padrão, permitir a porta SSH e as portas de `EXTRA_ALLOW_TCP`, e permitir 80 e 443 só às faixas IPv4 e IPv6 da Cloudflare, também na chain `DOCKER-USER`. (DEPLOY-27)
5. The script SHALL instalar e habilitar `fail2ban` para o SSH e as atualizações de segurança automáticas (`unattended-upgrades`). (DEPLOY-28)
6. WHEN o script roda uma segunda vez com os mesmos valores THEN ele SHALL terminar com código 0 e relatar "sem alterações" para cada passo, sem mudar nenhum arquivo. (DEPLOY-29)
7. WHERE `--dry-run` é passado o script SHALL imprimir cada comando que executaria e não alterar o sistema. (DEPLOY-30)
8. The script SHALL receber todo valor sensível ou específico do servidor por variável de ambiente, sem IP, usuário ou chave gravados no repositório. (DEPLOY-31)
9. The runbook SHALL exigir que o autor mantenha uma sessão SSH aberta até abrir uma nova com o usuário criado, e SHALL explicar como acessar o painel do Coolify depois que a porta dele fecha. (DEPLOY-32)

**Independent Test**: Um teste roda o script num container Debian/Ubuntu descartável (sem `ufw`/`iptables` reais: o firewall é provado pelo `--dry-run`), duas vezes, e confere arquivos, usuários e a saída.

---

### P2: Backup do Postgres no R2 e restore provado

**User Story**: Como autor, quero backup diário do banco num bucket S3-compatível e um jeito de provar que ele restaura, para não perder as candidaturas.

**Why P2**: O produto guarda dados reais assim que entra no ar; o deploy já funciona sem o backup.

**Acceptance Criteria**:

1. WHEN o serviço `backup` executa um ciclo THEN ele SHALL gerar um `pg_dump` em formato custom e enviá-lo ao bucket `BACKUP_BUCKET` na chave `<BACKUP_PREFIX>/<timestamp UTC ISO 8601>.dump`. (DEPLOY-33)
2. The serviço `backup` SHALL executar um ciclo por dia no horário de `BACKUP_SCHEDULE_UTC_HOUR` (padrão 3) e um ciclo imediato quando iniciado com `--once`. (DEPLOY-34)
3. IF o dump ou o envio falha THEN o ciclo SHALL terminar com código diferente de 0, registrar o erro num log estruturado e não apagar nenhum backup antigo. (DEPLOY-35)
4. WHEN um envio termina com sucesso THEN o serviço SHALL apagar do prefixo os objetos mais velhos que `BACKUP_RETENTION_DAYS` (padrão 14). (DEPLOY-36)
5. The serviço `backup` SHALL falar com o armazenamento por uma API S3 genérica configurada por `BACKUP_S3_ENDPOINT`, chave de acesso e segredo, sem código específico da Cloudflare. (DEPLOY-37)
6. The serviço SHALL nunca registrar em log a senha do banco, a chave de acesso ou o segredo S3. (DEPLOY-38)
7. WHEN `infra/backup/restore.sh` recebe a chave de um backup (ou `--latest`) e um banco de destino vazio THEN ele SHALL restaurá-lo e imprimir a contagem de migrations aplicadas encontrada no destino. (DEPLOY-39)
8. IF o banco de destino não está vazio THEN o restore SHALL terminar com código diferente de 0 sem alterar o destino, exceto com `--force`. (DEPLOY-40)
9. WHEN `infra/backup/verify-restore.sh` roda THEN ele SHALL restaurar o backup mais recente num banco descartável, comparar a contagem de migrations com a do arquivo de migrations do repositório e terminar com código 0 só se coincidem. (DEPLOY-41)

**Independent Test**: Testes de integração sobem Postgres e MinIO (S3-compatível) com Testcontainers e rodam backup, retenção, falha de envio, restore e verify-restore.

---

## Edge Cases

- IF o build de uma das imagens falha THEN o workflow SHALL terminar com falha sem publicar nenhuma das duas. (DEPLOY-42)
- IF a API do Coolify responde com erro ao gravar `IMAGE_TAG` ou ao disparar o deploy THEN o workflow SHALL terminar com falha mostrando o status HTTP, sem rodar o smoke test. (DEPLOY-43)
- IF uma migration falha no deploy THEN `migrate` SHALL terminar com código diferente de 0, a `api` nova não SHALL iniciar e o smoke test SHALL falhar o workflow. (DEPLOY-44)
- IF o workflow é acionado manualmente com uma tag que não existe no GHCR THEN ele SHALL terminar com falha antes de tocar no Coolify. (DEPLOY-45)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DEPLOY-01 | P1: Publicar e implantar (critério 1) | Execute | Verified |
| DEPLOY-02 | P1: Publicar e implantar (critério 2) | Execute | Verified |
| DEPLOY-03 | P1: Publicar e implantar (critério 3) | Execute | Verified |
| DEPLOY-04 | P1: Publicar e implantar (critério 4) | Execute | Verified |
| DEPLOY-05 | P1: Publicar e implantar (critério 5) | Execute | Verified |
| DEPLOY-06 | P1: Publicar e implantar (critério 6) | Execute | Verified |
| DEPLOY-07 | P1: Publicar e implantar (critério 7) | Execute | Verified |
| DEPLOY-08 | P1: Publicar e implantar (critério 8) | Execute | Verified |
| DEPLOY-09 | P1: Publicar e implantar (critério 9) | Execute | Verified |
| DEPLOY-10 | P1: Publicar e implantar (critério 10) | Execute | Verified |
| DEPLOY-11 | P1: Compose de produção (critério 1) | Execute | Verified |
| DEPLOY-12 | P1: Compose de produção (critério 2) | Execute | Verified |
| DEPLOY-13 | P1: Compose de produção (critério 3) | Execute | Verified |
| DEPLOY-14 | P1: Compose de produção (critério 4) | Execute | Verified |
| DEPLOY-15 | P1: Compose de produção (critério 5) | Execute | Verified |
| DEPLOY-16 | P1: Compose de produção (critério 6) | Execute | Verified |
| DEPLOY-17 | P1: Compose de produção (critério 7) | Execute | Verified |
| DEPLOY-18 | P1: Compose de produção (critério 8) | Execute | Verified |
| DEPLOY-19 | P1: Runbook (critério 1) | Execute | Verified |
| DEPLOY-20 | P1: Runbook (critério 2) | Execute | Verified |
| DEPLOY-21 | P1: Runbook (critério 3) | Execute | Verified |
| DEPLOY-22 | P1: Runbook (critério 4) | Execute | Verified |
| DEPLOY-23 | P1: Runbook (critério 5) | Execute | Verified |
| DEPLOY-24 | P2: Hardening (critério 1) | Execute | Verified |
| DEPLOY-25 | P2: Hardening (critério 2) | Execute | Verified |
| DEPLOY-26 | P2: Hardening (critério 3) | Execute | Verified |
| DEPLOY-27 | P2: Hardening (critério 4) | Execute | Verified |
| DEPLOY-28 | P2: Hardening (critério 5) | Execute | Verified |
| DEPLOY-29 | P2: Hardening (critério 6) | Execute | Verified |
| DEPLOY-30 | P2: Hardening (critério 7) | Execute | Verified |
| DEPLOY-31 | P2: Hardening (critério 8) | Execute | Verified |
| DEPLOY-32 | P2: Hardening (critério 9) | Execute | Verified |
| DEPLOY-33 | P2: Backup (critério 1) | Execute | Verified |
| DEPLOY-34 | P2: Backup (critério 2) | Execute | Verified |
| DEPLOY-35 | P2: Backup (critério 3) | Execute | Verified |
| DEPLOY-36 | P2: Backup (critério 4) | Execute | Verified |
| DEPLOY-37 | P2: Backup (critério 5) | Execute | Verified |
| DEPLOY-38 | P2: Backup (critério 6) | Execute | Verified |
| DEPLOY-39 | P2: Backup (critério 7) | Execute | Verified |
| DEPLOY-40 | P2: Backup (critério 8) | Execute | Verified |
| DEPLOY-41 | P2: Backup (critério 9) | Execute | Verified |
| DEPLOY-42 | Edge cases | Execute | Verified |
| DEPLOY-43 | Edge cases | Execute | Verified |
| DEPLOY-44 | Edge cases | Execute | Verified |
| DEPLOY-45 | Edge cases | Execute | Verified |

**Coverage:** 45 total, 45 mapped to tasks, 0 unmapped

Implicit-requirement sweep: validação de entrada coberta por DEPLOY-12, 25 e 45; falha parcial por DEPLOY-02, 35, 42, 43 e 44; idempotência por DEPLOY-29 e 22; auth e segredos por DEPLOY-04, 05, 07, 18, 31 e 38; concorrência por DEPLOY-10; ciclo de vida de dados por DEPLOY-36; observabilidade por DEPLOY-09, 35 e 43 (log estruturado e falha visível no workflow); falha de dependência externa por DEPLOY-09, 35 e 43; integridade de transição de estado N/A because nenhuma entidade de domínio muda de estado.

---

## Sources

- [docs/engineering-guidelines.md](../../../docs/engineering-guidelines.md) - Infraestrutura, Portabilidade e Segurança: build no GitHub Actions, Coolify, hardening, Cloudflare, backup no R2, actions fixadas por SHA
- [docs/project-brief.md](../../../docs/project-brief.md) - fase 0 e a VPS como prioridade após a contratação
- `.specs/STATE.md` AD-001 (imagens por `turbo prune`) e AD-004 (API sem domínio público nem porta publicada)
- Conversa de 2026-11-09 - escopo, mecanismo, gatilho, domínio, borda, visibilidade das imagens, hardening, admin e backup

---

## Success Criteria

- [ ] Um merge na `main` aparece em produção sem ação manual, e um deploy quebrado deixa o workflow vermelho.
- [ ] `docker compose -f infra/compose.prod.yaml` sobe a stack numa máquina limpa só com variáveis de ambiente.
- [ ] `verify-restore.sh` termina com código 0 sobre um backup real.
