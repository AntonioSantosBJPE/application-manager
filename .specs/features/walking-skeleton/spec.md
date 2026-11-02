# Walking Skeleton Specification

**Approved**: 2026-11-02 - user: "1 - tenho o node 24 instalado no nvm 2 - pode usar 3 - pode usar 4 - pode usar 5 - pode usar 6 - pode usar 7 - pode usar 8 - pode usar"

## Problem Statement

Não existe código. Toda feature do design ([.design/application-manager.md](../../../.design/application-manager.md)) depende de um monorepo funcionando, de front, API e banco conversando, e dos guard-rails (testes, fronteiras, segredos) que tornam seguro trabalhar com agentes. Construir isso agora, antes da primeira feature, evita adaptar depois código escrito sem essas proteções. Tudo aqui roda localmente; o que depende da VPS fica na feature `production-deploy`.

## Goals

- [ ] `docker compose up` sobe web, API e Postgres 18, e a página de status renderizada no servidor mostra API e banco operacionais.
- [ ] Os comandos únicos (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`) passam do zero num clone limpo.
- [ ] Violações de fronteira, de design system e segredos commitados são barrados por máquina, não por revisão.

## Out of Scope

| Feature | Reason |
| --- | --- |
| VPS, hardening, Coolify, domínio, Cloudflare | Feature `production-deploy`, depois da contratação (~2026-11-05) |
| Publicar imagens no GHCR e deploy automático | Feature `production-deploy` |
| Preview por PR e backup no R2 | Feature `production-deploy` |
| Redis, fila e worker | Entram na fatia ResumeDocument |
| Autenticação | Fatia Identity |
| Tabelas de domínio | Cada fatia cria as suas |
| Identidade visual definitiva (paleta, fonte, escala) | Etapa de design dedicada; aqui os tokens são provisórios |
| Botão de troca de tema | Entra com a identidade visual; aqui o tema segue o sistema |
| OpenTelemetry (traces, métricas) e stack Grafana | Trabalho de observabilidade após o primeiro deploy |
| Regressão visual por screenshot | Entra quando houver identidade visual definida |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Divisão do WalkingSkeleton do design | `walking-skeleton` (local + CI) agora; `production-deploy` depois | Critérios dependentes da VPS bloqueariam a conclusão por dias | y |
| Escopo de ferramentas | Toda a base de guard-rails entra aqui | Guard-rails antes da primeira feature | y |
| Conteúdo da tela | Página de status SSR, tema segue o sistema | Exercita navegador → Start → API → banco | y |
| Versão do Node | Node 24 LTS, fixada em `.nvmrc` e `engines` (já instalada via nvm) | LTS com suporte longo e ecossistema já estável | y |
| Gerenciador e orquestrador | pnpm 11 via corepack (versão em `packageManager`) + Turborepo | Já decidido nas diretrizes; pnpm 11 é o instalado | y |
| ORM e migrations | Drizzle + drizzle-kit, migrations aplicadas por um serviço de execução única antes da API | Preferência das diretrizes; separar a migration da API deixa a ordem explícita | y |
| Ferramenta de lint | ESLint (flat config) + Prettier; dependency-cruiser para fronteiras entre apps, módulos e features | O ESLint tem as regras de Tailwind e de imports necessárias; o dependency-cruiser expressa fronteiras de pasta | y |
| Git hooks | lefthook | Rápido, sem dependência de Node no hook, configuração em um arquivo | y |
| Portas locais | web 3000, API 3333, Postgres 5432 publicado só em `127.0.0.1`; configuráveis por variável para worktrees ([docs/workflow.md](../../../docs/workflow.md)) | Evita expor o banco na rede local; permite stacks paralelas | y |
| Chamada SSR → API | O servidor do Start chama a API pela rede interna do compose (`API_INTERNAL_URL`) | O navegador não precisa alcançar a API para a página de status | y |
| Timeout da checagem de banco | 2 segundos | Health check precisa responder rápido mesmo com o banco travado | y |
| Componente do design system | `StatusBadge` em `packages/ui`, usado pela página de status | Um componente real, usado de verdade, em vez de um exemplo solto | y |
| Docker local | Docker Desktop precisa estar rodando para compose, Testcontainers e E2E | Requisito do ambiente, não da feature | y |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Stack local completa ⭐ MVP

**User Story**: Como desenvolvedor, quero subir front, API e banco com um comando, para que toda feature nasça num ambiente igual ao de produção.

**Why P1**: É o caminho que todas as fatias do design usam.

**Acceptance Criteria**:

1. WHEN o desenvolvedor executa `docker compose up` na raiz THEN o sistema SHALL iniciar os serviços `web`, `api`, `migrate` e `postgres`, e a página de status SHALL responder `200` em `http://localhost:3000` em até 120 segundos.
2. The `postgres` service SHALL run PostgreSQL 18.
3. WHEN `GET /health` é chamado na API e o banco responde THEN a API SHALL responder `200` com o corpo `{"status":"ok","db":"up"}`.
4. IF o banco não responde em até 2 segundos THEN `GET /health` SHALL responder `503` com o corpo `{"status":"degraded","db":"down"}`.
5. WHEN a página de status é requisitada THEN o `web` SHALL entregar no HTML inicial, renderizado no servidor, as linhas "API" e "Banco de dados", cada uma com o texto "Operacional" ou "Indisponível".
6. IF a API não responde à página de status THEN o `web` SHALL responder `200` exibindo "API: Indisponível" e "Banco de dados: Indisponível", em vez de uma página de erro.
7. WHILE a preferência de cor do sistema for escura a página de status SHALL usar os tokens do tema escuro; caso contrário, os do tema claro.
8. WHEN o compose sobe THEN o serviço `migrate` SHALL aplicar as migrations pendentes e terminar com código 0 antes de o serviço `api` iniciar.
9. IF uma migration falha THEN o serviço `migrate` SHALL terminar com código diferente de 0 e o serviço `api` SHALL não iniciar.
10. WHEN `docker compose up` é executado de novo sem migrations novas THEN o serviço `migrate` SHALL terminar com código 0 sem reaplicar nenhuma migration.
11. IF uma variável de ambiente obrigatória está ausente THEN o `web` ou a `api` SHALL encerrar na inicialização com código diferente de 0 e uma mensagem que nomeia a variável.
12. The repository SHALL contain a `.env.example` listing every environment variable read by `web`, `api` and `migrate`, with placeholder values only.
13. The compose stack SHALL publish the `web`, `api` and `postgres` ports from `WEB_PORT`, `API_PORT` and `POSTGRES_PORT` (defaults 3000, 3333 and 5432), and the Playwright tests SHALL target `WEB_PORT`, so two worktrees with different values run at the same time.

**Independent Test**: Num clone limpo, `cp .env.example .env && docker compose up`; abrir `http://localhost:3000` e ver as duas linhas "Operacional"; parar o `postgres` e ver "Banco de dados: Indisponível".

---

### P1: Imagens enxutas e seguras ⭐ MVP

**User Story**: Como desenvolvedor, quero que cada app gere uma imagem só com o que usa, para que front e back escalem e sejam publicados de forma independente.

**Why P1**: É a base da escala independente e do deploy da próxima feature.

**Acceptance Criteria**:

1. The `web` image SHALL contain no package from the `@nestjs` scope.
2. The `api` image SHALL contain no package from the `@tanstack` scope.
3. The `web` and `api` images SHALL run their process as a non-root user.
4. The `web` and `api` images SHALL contain no `.env` file.

**Independent Test**: Construir as duas imagens e inspecionar `node_modules` e o usuário do processo de cada uma.

---

### P1: Guard-rails de qualidade ⭐ MVP

**User Story**: Como desenvolvedor que trabalha com agentes, quero comandos únicos que digam se o código está correto, para que nenhuma mudança dependa de revisão manual para respeitar as regras do projeto.

**Why P1**: É a condição para o fluxo autônomo das próximas features.

**Acceptance Criteria**:

1. WHEN `pnpm lint` é executado THEN o sistema SHALL rodar ESLint em todos os workspaces e terminar com código diferente de 0 se houver violação.
2. WHEN `pnpm typecheck` é executado THEN o sistema SHALL checar os tipos de todos os workspaces e terminar com código diferente de 0 se houver erro.
3. WHEN `pnpm test` é executado THEN o sistema SHALL rodar os testes unitários Vitest de todos os workspaces.
4. WHEN `pnpm test:integration` é executado THEN o sistema SHALL rodar os testes de integração da API contra um PostgreSQL 18 real iniciado por Testcontainers.
5. WHEN `pnpm test:e2e` é executado THEN o sistema SHALL subir a stack do compose e rodar os testes Playwright contra ela.
6. IF um arquivo em `apps/` importa de outra app THEN `pnpm lint` SHALL falhar nomeando o arquivo e o import.
7. IF um arquivo de uma feature do `web` importa um arquivo interno de outra feature (fora do `index.ts`) THEN `pnpm lint` SHALL falhar nomeando o arquivo e o import.
8. IF um arquivo de um módulo da `api` importa um arquivo interno de outro módulo (fora da API pública do módulo) THEN `pnpm lint` SHALL falhar nomeando o arquivo e o import.
9. IF um arquivo fora de `packages/ui` importa um pacote `@radix-ui` THEN `pnpm lint` SHALL falhar nomeando o arquivo.
10. IF uma classe de cor crua do Tailwind (como `bg-purple-500`) ou um valor arbitrário (como `p-[13px]`) aparece em `apps/web` ou `packages/ui` THEN `pnpm lint` SHALL falhar nomeando o arquivo e a classe.

**Independent Test**: Introduzir, um por vez, cada tipo de violação num arquivo de teste de fixture e ver `pnpm lint` falhar com a mensagem certa.

---

### P1: Segredos barrados ⭐ MVP

**User Story**: Como autor de um repositório público, quero que segredos sejam barrados antes do commit, para que nada sensível chegue ao histórico.

**Why P1**: Commit público é permanente; prevenir é a única proteção real.

**Acceptance Criteria**:

1. IF uma mudança em stage contém um segredo detectável pelo gitleaks THEN o hook de pre-commit SHALL bloquear o commit e nomear o arquivo.
2. WHEN `pnpm install` é executado num clone novo THEN os git hooks SHALL ficar instalados sem passo manual.

**Independent Test**: Colocar em stage um arquivo com uma chave de exemplo no formato da AWS e tentar commitar.

---

### P2: Pipeline de CI definido

**User Story**: Como desenvolvedor, quero o workflow de CI pronto, para que ele valide tudo assim que o repositório for publicado.

**Why P2**: Só executa após a publicação, mas precisa existir antes do primeiro push.

**Acceptance Criteria**:

1. WHEN um pull request é aberto ou um push chega à `main` THEN o workflow SHALL executar lint, typecheck, testes unitários, testes de integração, testes E2E, gitleaks sobre todo o histórico e o build das imagens `web` e `api`.
2. The workflow SHALL declare `permissions: contents: read` at the top level.
3. The workflow SHALL reference every third-party action by a full commit SHA.
4. The workflow SHALL NOT use the `pull_request_target` event.

**Independent Test**: `actionlint` sem erros e uma checagem do arquivo para permissões, SHAs e eventos.

---

### P2: Design system inicial no Storybook

**User Story**: Como desenvolvedor, quero o Storybook com o primeiro componente, para que pessoas e agentes tenham a referência viva dos padrões de UI.

**Why P2**: Estabelece o padrão de composição e tokens antes de existirem telas de verdade.

**Acceptance Criteria**:

1. WHEN `pnpm storybook:build` é executado THEN o sistema SHALL gerar um Storybook estático contendo as stories do `StatusBadge` nas variantes "Operacional" e "Indisponível".
2. WHEN as stories do `StatusBadge` são exibidas THEN o Storybook SHALL permitir alternar entre os temas claro e escuro.
3. WHEN `pnpm test` é executado THEN o sistema SHALL renderizar cada story do `packages/ui` e falhar se alguma lançar erro.

**Independent Test**: Gerar o Storybook, abrir as stories do `StatusBadge` nos dois temas.

---

### P2: Logs estruturados com correlation ID

**User Story**: Como desenvolvedor, quero rastrear uma requisição do front até a API pelos logs, para que depurar em produção não dependa de adivinhação.

**Why P2**: Base da observabilidade; barato agora, caro de retrofitar.

**Acceptance Criteria**:

1. The `api` SHALL write each log entry as one JSON line containing `level`, `time`, `msg` and `requestId`.
2. WHEN uma requisição chega à `api` com o header `x-request-id` THEN a `api` SHALL usar esse valor como `requestId` e devolvê-lo no header `x-request-id` da resposta.
3. WHEN uma requisição chega à `api` sem o header `x-request-id` THEN a `api` SHALL gerar um id e devolvê-lo no header `x-request-id` da resposta.
4. WHEN o servidor do `web` chama a `api` durante o SSR THEN o `web` SHALL enviar o header `x-request-id` com o mesmo id registrado nos seus próprios logs.

**Independent Test**: Abrir a página de status e encontrar o mesmo `requestId` nos logs do `web` e da `api`.

---

## Edge Cases

- IF o banco está fora quando o `migrate` inicia THEN o `migrate` SHALL tentar de novo por até 30 segundos antes de terminar com código diferente de 0.
- IF a API demora mais de 3 segundos para responder ao SSR THEN o `web` SHALL tratar a API como "Indisponível".

Implicit-requirement sweep: validação de entrada coberta por SKEL-11 (variáveis de ambiente); falhas cobertas por SKEL-04, SKEL-06, SKEL-09 e pelos casos acima; idempotência coberta por SKEL-10; observabilidade coberta por LOG-01 a LOG-04; falha de dependência externa coberta pelos timeouts. Auth e rate limit N/A because o único endpoint (`/health`) é público e não expõe dados (rate limit fica na borda, na feature `production-deploy`); concorrência N/A because não há escrita de dados; ciclo de vida de dados N/A because não há tabelas de domínio; integridade de transição de estado N/A because não há estados.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SKEL-01 | P1: Stack local completa (critério 1) | Tasks | Pending |
| SKEL-02 | P1: Stack local completa (critério 2) | Tasks | Pending |
| SKEL-03 | P1: Stack local completa (critério 3) | Tasks | Pending |
| SKEL-04 | P1: Stack local completa (critério 4) | Tasks | Pending |
| SKEL-05 | P1: Stack local completa (critério 5) | Tasks | Pending |
| SKEL-06 | P1: Stack local completa (critério 6) | Tasks | Pending |
| SKEL-07 | P1: Stack local completa (critério 7) | Tasks | Pending |
| SKEL-08 | P1: Stack local completa (critério 8) | Tasks | Pending |
| SKEL-09 | P1: Stack local completa (critério 9) | Tasks | Pending |
| SKEL-10 | P1: Stack local completa (critério 10) | Tasks | Pending |
| SKEL-11 | P1: Stack local completa (critério 11) | Tasks | Pending |
| SKEL-12 | P1: Stack local completa (critério 12) | Tasks | Pending |
| SKEL-13 | P1: Stack local completa (critério 13) | Tasks | Pending |
| IMG-01 | P1: Imagens enxutas e seguras (critério 1) | Tasks | Pending |
| IMG-02 | P1: Imagens enxutas e seguras (critério 2) | Tasks | Pending |
| IMG-03 | P1: Imagens enxutas e seguras (critério 3) | Tasks | Pending |
| IMG-04 | P1: Imagens enxutas e seguras (critério 4) | Tasks | Pending |
| GUARD-01 | P1: Guard-rails de qualidade (critério 1) | Tasks | Pending |
| GUARD-02 | P1: Guard-rails de qualidade (critério 2) | Tasks | Pending |
| GUARD-03 | P1: Guard-rails de qualidade (critério 3) | Tasks | Pending |
| GUARD-04 | P1: Guard-rails de qualidade (critério 4) | Tasks | Pending |
| GUARD-05 | P1: Guard-rails de qualidade (critério 5) | Tasks | Pending |
| GUARD-06 | P1: Guard-rails de qualidade (critério 6) | Execute | Implementing |
| GUARD-07 | P1: Guard-rails de qualidade (critério 7) | Execute | Implementing |
| GUARD-08 | P1: Guard-rails de qualidade (critério 8) | Execute | Implementing |
| GUARD-09 | P1: Guard-rails de qualidade (critério 9) | Tasks | Pending |
| GUARD-10 | P1: Guard-rails de qualidade (critério 10) | Tasks | Pending |
| SEC-01 | P1: Segredos barrados (critério 1) | Execute | Implementing |
| SEC-02 | P1: Segredos barrados (critério 2) | Execute | Implementing |
| CI-01 | P2: Pipeline de CI definido (critério 1) | Tasks | Pending |
| CI-02 | P2: Pipeline de CI definido (critério 2) | Tasks | Pending |
| CI-03 | P2: Pipeline de CI definido (critério 3) | Tasks | Pending |
| CI-04 | P2: Pipeline de CI definido (critério 4) | Tasks | Pending |
| DS-01 | P2: Design system inicial no Storybook (critério 1) | Execute | Implementing |
| DS-02 | P2: Design system inicial no Storybook (critério 2) | Execute | Implementing |
| DS-03 | P2: Design system inicial no Storybook (critério 3) | Execute | Implementing |
| LOG-01 | P2: Logs estruturados com correlation ID (critério 1) | Tasks | Pending |
| LOG-02 | P2: Logs estruturados com correlation ID (critério 2) | Tasks | Pending |
| LOG-03 | P2: Logs estruturados com correlation ID (critério 3) | Tasks | Pending |
| LOG-04 | P2: Logs estruturados com correlation ID (critério 4) | Tasks | Pending |
| EDGE-01 | Edge Cases (retry do `migrate`) | Tasks | Pending |
| EDGE-02 | Edge Cases (timeout do SSR) | Tasks | Pending |

**Coverage:** 42 total, 0 mapped to tasks, 42 unmapped ⚠️ (tasks ainda não escritas)

---

## Sources

- [.design/application-manager.md](../../../.design/application-manager.md) - fatia WalkingSkeleton, convenções e Key decisions
- [docs/engineering-guidelines.md](../../../docs/engineering-guidelines.md) - monorepo, testes, segurança, portabilidade
- [docs/design/principles.md](../../../docs/design/principles.md) - tokens, temas e proibições de UI

---

## Success Criteria

- [ ] Num clone limpo, com Docker rodando, `docker compose up` deixa a página de status no ar em até 120 segundos.
- [ ] Os cinco comandos únicos passam do zero num clone limpo.
- [ ] Cada tipo de violação (fronteira, Radix fora do UI, cor crua, segredo) é barrado com mensagem que nomeia o arquivo.
