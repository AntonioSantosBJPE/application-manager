# Runbook: primeiro deploy em produção

Os passos que só você executa, nas suas contas e na sua VPS, para ir do estado atual (Coolify instalado com configuração básica, DNS ainda sem apontar) até o produto no ar. O código, os scripts e o workflow já estão no repositório; este roteiro liga as peças.

Convenções: `<DOMINIO>` é o domínio do produto, `<IP_DA_VPS>` o IP do servidor, `<DONO>` o usuário ou organização do GitHub (em minúsculas) e `<REPO>` o nome do repositório. Nada disso é commitado: valores reais ficam no Coolify, no GitHub e no seu gerenciador de senhas.

## Como o deploy funciona

1. Um push na `main` roda os gates (lint, tipos, testes, scan de segredos).
2. Com tudo verde, o workflow `Deploy` constrói as imagens `api`, `web` e `backup`, e só então as publica no GHCR com o SHA do commit como tag.
3. O workflow grava `IMAGE_TAG=<sha>` no recurso do Coolify pela API e dispara o deploy.
4. O Coolify baixa as imagens e sobe `infra/compose.prod.yaml`: `postgres`, `migrate` (aplica as migrations e termina), `api`, `web` e `backup`.
5. O workflow consulta `<WEB_PUBLIC_URL>/status` a cada 10 segundos, por até 5 minutos, e só termina verde quando a API aparece como "Operacional".

O mesmo `infra/compose.prod.yaml` sobe em qualquer servidor com Docker, sem Coolify, se você exportar as variáveis da tabela abaixo.

## Variáveis e secrets

| Nome | Onde fica | Para que serve |
| --- | --- | --- |
| `COOLIFY_URL` | GitHub: secret do repositório | Endereço do painel do Coolify, usado pelo workflow para chamar a API |
| `COOLIFY_TOKEN` | GitHub: secret do repositório | Token de API do Coolify (Keys & Tokens) |
| `COOLIFY_RESOURCE_UUID` | GitHub: secret do repositório | UUID do recurso criado no Coolify |
| `COOLIFY_RESOURCE_KIND` | GitHub: variável do repositório, opcional | `applications` (padrão) ou `services`: a família de rotas da API que o seu recurso usa |
| `WEB_PUBLIC_URL` | GitHub: variável do repositório; Coolify: variável do recurso | Endereço público do produto (`https://<DOMINIO>`): o smoke test consulta `/status` nele, a API monta o link de convite com ele e o web o aceita como origem |
| `IMAGE_REPOSITORY` | Coolify: variável do recurso | `ghcr.io/<DONO>/<REPO>`, em minúsculas; as imagens são `-api`, `-web` e `-backup` |
| `IMAGE_TAG` | Coolify: variável do recurso, gravada pelo workflow | Tag das imagens em uso (o SHA do commit); o workflow a atualiza a cada deploy |
| `POSTGRES_USER` | Coolify: variável do recurso | Usuário do banco |
| `POSTGRES_PASSWORD` | Coolify: variável do recurso | Senha do banco (gere com `openssl rand -base64 32`) |
| `POSTGRES_DB` | Coolify: variável do recurso | Nome do banco |
| `LOG_LEVEL` | Coolify: variável do recurso, opcional | `fatal`, `error`, `warn`, `info` (padrão), `debug` ou `trace` |
| `BACKUP_S3_ENDPOINT` | Coolify: variável do recurso | Endereço S3 do bucket de backup (no R2, `https://<ID_DA_CONTA>.r2.cloudflarestorage.com`) |
| `BACKUP_S3_ACCESS_KEY_ID` | Coolify: variável do recurso | Chave de acesso do token do bucket |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Coolify: variável do recurso | Segredo do token do bucket |
| `BACKUP_BUCKET` | Coolify: variável do recurso | Nome do bucket |
| `BACKUP_PREFIX` | Coolify: variável do recurso, opcional | Pasta dentro do bucket (padrão `postgres`) |
| `BACKUP_RETENTION_DAYS` | Coolify: variável do recurso, opcional | Dias de retenção (padrão 14) |
| `BACKUP_SCHEDULE_UTC_HOUR` | Coolify: variável do recurso, opcional | Hora UTC do backup diário (padrão 3) |
| `ADMIN_USER` | Terminal, ao rodar `harden.sh` | Conta não-root que vai administrar o servidor |
| `ADMIN_SSH_PUBLIC_KEY` | Terminal, ao rodar `harden.sh` | Chave pública SSH dessa conta (uma linha) |
| `SSH_PORT` | Terminal, ao rodar `harden.sh` | Porta SSH que o firewall mantém aberta (padrão 22) |
| `EXTRA_ALLOW_TCP` | Terminal, ao rodar `harden.sh` | Portas TCP extras abertas ao mundo, separadas por vírgula (padrão nenhuma) |
| `HARDEN_CF_IPS_FILE` | Terminal, ao rodar `harden.sh`, opcional | Arquivo com as faixas da Cloudflare; sem ele o script baixa as listas oficiais |
| `HARDEN_PUBLIC_IFACE` | Terminal, ao rodar `harden.sh`, opcional | Interface de rede pública, quando a rota padrão não a mostra |
| `TARGET_DATABASE_URL` | Terminal, ao rodar `restore.sh` | Banco vazio de destino de um restore |
| `MIGRATIONS_JOURNAL` | Terminal, ao rodar `verify-restore.sh` | Caminho de `apps/api/drizzle/meta/_journal.json` do commit implantado |

Os segredos de produção ficam só no Coolify e no GitHub; nunca em arquivo versionado.

## 1. Preparar o servidor (hardening)

O script `infra/provision/harden.sh` cria a conta não-root, desliga login de root e por senha no SSH, instala `fail2ban` e as atualizações automáticas de segurança e configura o firewall: entrada negada por padrão e as portas 80 e 443 abertas só às faixas da Cloudflare, no `ufw` e também na chain `DOCKER-USER`, porque o Docker publica portas à frente do `ufw`. É idempotente: rodar de novo não muda nada.

**Antes de rodar, e para não ficar trancado para fora:**

1. **Mantenha uma sessão SSH aberta** (a que você usa hoje) até confirmar que uma sessão nova funciona com a conta criada. Só então feche a antiga.
2. Gere uma chave só para o servidor, se ainda não tem: `ssh-keygen -t ed25519 -f ~/.ssh/vps_ed25519`.
3. Copie `infra/provision/harden.sh` para o servidor (por exemplo com `scp`).
4. Ensaie sem alterar nada: `ADMIN_USER=<usuario> ADMIN_SSH_PUBLIC_KEY="$(cat ~/.ssh/vps_ed25519.pub)" ./harden.sh --dry-run`. A saída lista cada comando com `+` na frente; leia as regras do firewall.
5. Rode de verdade, como root: `sudo -E ./harden.sh`, com as mesmas variáveis. Cada passo imprime `changed` ou `unchanged`.
6. **Em outro terminal**, abra uma sessão nova: `ssh -i ~/.ssh/vps_ed25519 <usuario>@<IP_DA_VPS>` e confirme `sudo whoami` (deve responder `root`). Só depois feche a sessão antiga.

**O painel do Coolify deixa de abrir pelo IP.** O firewall derruba conexões novas vindas da internet a qualquer porta que o Docker publica (incluindo a do painel, normalmente 8000), exceto 80 e 443 pela Cloudflare. Duas saídas:

- **Túnel SSH (recomendado):** `ssh -i ~/.ssh/vps_ed25519 -L 8000:127.0.0.1:8000 <usuario>@<IP_DA_VPS>` e abra `http://localhost:8000`.
- **Domínio do próprio Coolify atrás da Cloudflare:** configure um subdomínio para o painel nas configurações do Coolify e aponte-o na Cloudflare como no passo 2.

Evite `EXTRA_ALLOW_TCP=8000`: expõe o painel de deploy ao mundo.

## 2. DNS e Cloudflare

1. Na Cloudflare, adicione `<DOMINIO>` e aponte os nameservers no registrador, se ainda não fez.
2. Crie um registro `A` de `<DOMINIO>` (ou do subdomínio escolhido) para `<IP_DA_VPS>` com o proxy ligado (nuvem laranja).
3. Em SSL/TLS, escolha o modo **Full (strict)**. A Cloudflare só fala com o servidor se o certificado dele for válido.
4. O servidor precisa de um certificado que a Cloudflare aceite em Full (strict). Duas opções:
   - **Let's Encrypt pelo Coolify (mais simples):** é o que o Coolify faz por padrão ao ligar HTTPS num domínio; funciona atrás do proxy da Cloudflare porque o desafio chega pelas faixas dela, que o firewall permite.
   - **Origin Certificate da Cloudflare:** em SSL/TLS > Origin Server, crie um certificado para `<DOMINIO>` e instale-o no proxy do Coolify (Traefik) como certificado personalizado, seguindo a documentação do Coolify da sua versão. Use-o se a renovação do Let's Encrypt falhar.
5. A API não tem domínio nem registro DNS: só o `web` é público (AD-004).

## 3. Recurso no Coolify

1. Em Keys & Tokens, crie um token de API e guarde-o (ele vira `COOLIFY_TOKEN`).
2. Crie um recurso a partir de um repositório Git público: o repositório do projeto, branch `main`, tipo de build **Docker Compose**, arquivo `infra/compose.prod.yaml`. O Coolify só lê o compose; as imagens vêm do GHCR.
3. Preencha as variáveis do recurso da tabela acima (as de `Coolify: variável do recurso`). Em `IMAGE_TAG` coloque um valor provisório qualquer (`bootstrap`): o workflow o sobrescreve no primeiro deploy.
4. No serviço `web`, defina o domínio `https://<DOMINIO>` apontando para a porta interna 3000 e ligue o HTTPS. Nenhum outro serviço recebe domínio.
5. Anote o UUID do recurso (na URL ou nos detalhes do recurso): é o `COOLIFY_RESOURCE_UUID`.
6. **Confira as rotas da API na sua versão.** O workflow assume `PATCH /api/v1/<tipo>/<uuid>/envs` para gravar `IMAGE_TAG` e `GET /api/v1/deploy?uuid=<uuid>` para disparar o deploy, com `<tipo>` igual a `applications`. Compare com a documentação da API da sua versão do Coolify ([envs de application](https://coolify.io/docs/api/operations/update-env-by-application-uuid) e [envs de service](https://coolify.io/docs/api/operations/update-env-by-service-uuid)). Se o seu recurso aparecer como serviço, crie a variável do repositório `COOLIFY_RESOURCE_KIND` com o valor `services`. Teste a chamada à mão antes do primeiro deploy: `curl -i -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_URL/api/v1/applications/$COOLIFY_RESOURCE_UUID"` deve responder 200.

## 4. Secrets do GitHub

Em Settings > Secrets and variables > Actions do repositório:

- Secrets: `COOLIFY_URL`, `COOLIFY_TOKEN`, `COOLIFY_RESOURCE_UUID`.
- Variável: `WEB_PUBLIC_URL` (`https://<DOMINIO>`).

Em Settings > Code security, ligue secret scanning e push protection. O workflow falha logo no início, sem publicar nada, se um desses nomes estiver faltando.

## 5. Primeiro deploy

O primeiro push publica as imagens, mas o Coolify ainda não consegue baixá-las: os pacotes do GHCR nascem privados. Por isso o primeiro deploy tem dois tempos:

1. Faça o merge na `main` e acompanhe o workflow `Deploy` na aba Actions. Os gates e a publicação passam; a etapa de deploy ou o smoke test falha. É esperado.
2. Em GitHub > seu perfil ou organização > Packages, abra cada um dos três pacotes (`<REPO>-api`, `<REPO>-web`, `<REPO>-backup`), vá em Package settings e mude a visibilidade para **Public**. As imagens não carregam segredo.
3. Em Actions > Deploy > **Run workflow**, informe em `tag` o SHA do commit que acabou de ser publicado. Esse caminho não constrói nada: confere que a tag existe nas três imagens (o que também prova que os pacotes são públicos), grava `IMAGE_TAG`, dispara o deploy e espera o `/status`.
4. Os deploys seguintes são automáticos a cada push na `main`.

## 6. Criar o primeiro admin

Não existe cadastro aberto: o primeiro admin nasce pela CLI da API, dentro do contêiner. A senha entra por `--password-stdin`, nunca como argumento de linha de comando.

```bash
# No servidor, com a sessão do usuário criado no passo 1.
API_CONTAINER="$(docker ps --filter name=api --format '{{.Names}}' | head -n 1)"
read -rs -p 'Senha do admin: ' ADMIN_PASSWORD; echo
printf '%s' "$ADMIN_PASSWORD" | docker exec -i "$API_CONTAINER" \
  node dist/cli.js create-admin --email <email-do-admin> --name "<nome>" --password-stdin
unset ADMIN_PASSWORD
```

Confirme que `$API_CONTAINER` é o contêiner da `api` do seu recurso (`docker ps`). O e-mail é único entre os papéis; um e-mail que já existe não cria nada. Depois entre em `https://<DOMINIO>/admin/login`.

## 7. Verificar e reverter

**Verificar**

- `https://<DOMINIO>/status` mostra "API" e "Banco de dados" como "Operacional".
- De fora do servidor (do seu computador, fora da Cloudflare), `curl -m 10 -k https://<IP_DA_VPS>/` deve **falhar** ou dar tempo esgotado: o firewall só aceita a Cloudflare em 80 e 443. Se responder, a restrição não está valendo: revise o passo 1.
- Faça um backup agora e prove o restore:
  ```bash
  BACKUP_CONTAINER="$(docker ps --filter name=backup --format '{{.Names}}' | head -n 1)"
  docker exec "$BACKUP_CONTAINER" /usr/local/bin/backup.sh --once
  # De um checkout do commit implantado, no seu computador:
  scp apps/api/drizzle/meta/_journal.json <usuario>@<IP_DA_VPS>:/tmp/_journal.json
  # No servidor:
  docker cp /tmp/_journal.json "$BACKUP_CONTAINER":/tmp/_journal.json
  docker exec -e MIGRATIONS_JOURNAL=/tmp/_journal.json "$BACKUP_CONTAINER" /usr/local/bin/verify-restore.sh
  ```
  O `verify-restore.sh` restaura o backup mais recente num banco descartável, compara as migrations com as do repositório e termina com código 0 só se coincidem. Repita a cada mês.
- Para restaurar de verdade num banco novo e vazio: `docker exec -e TARGET_DATABASE_URL='<url do banco vazio>' "$BACKUP_CONTAINER" /usr/local/bin/restore.sh --latest` (com `--force` só quando quiser substituir o que existe).

**Reverter (rollback)**

1. Em Actions > Deploy > **Run workflow**, informe em `tag` o **SHA anterior** que estava saudável (o histórico de Actions mostra os SHAs implantados).
2. O workflow pula os gates e a construção, confere que a tag existe no GHCR, grava `IMAGE_TAG`, dispara o deploy e roda o smoke test.
3. As migrations só avançam: reverter o código não desfaz uma migration já aplicada. Se a versão anterior não funciona com o schema novo, restaure o banco de um backup (`restore.sh`) antes ou junto.
