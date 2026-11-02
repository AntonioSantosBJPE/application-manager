# Engineering Guidelines

> Princípios que valem para todo o código e toda a infraestrutura deste repositório. Decisões específicas de feature ficam em `.design/`, `.prd/` e `.specs/`.

## Princípios

1. **Deploy primeiro, feature depois.** Um walking skeleton (web + api + Postgres) vai para produção antes de qualquer feature. Toda feature nasce em produção.
2. **Portabilidade.** Trocar de VPS, ir para AWS ou para self-host em casa deve ser uma operação documentada, não um projeto.
3. **Guard-rails acima de disciplina.** Tudo o que importa (fronteiras de módulo, testes, segredos, lint) é verificado por máquina no CI, o que torna seguro trabalhar com agentes de IA.
4. **Abstrair depois de repetir.** Nada de template genérico antes do segundo projeto.

## Monorepo

```
apps/
  web/            TanStack Start (imagem própria)
  api/            NestJS — HTTP e worker na mesma imagem, entrypoints diferentes
packages/
  contracts/      schemas Zod e tipos da API
  config/         tsconfig, eslint, prettier base
infra/            compose, provisionamento do servidor, runbooks
docs/             brief, diretrizes, ADRs
```

- **pnpm workspaces** com **catalogs** para versões compartilhadas; **Turborepo** para build com cache.
- `apps/*` nunca importam de outra app, só de `packages/*`.
- Cada app gera sua imagem com `turbo prune` / `pnpm deploy`: a imagem do front não carrega dependências do back, e vice-versa.
- CI e deploy filtram por caminho: mudança só no `web` faz build e deploy só do `web`.

## Frontend — TanStack Start

```
apps/web/src/
  routes/           rotas finas: loader + composição
  features/<name>/
    api/            queryOptions, mutations, server functions (BFF)
    components/     componentes da feature
    model/          tipos derivados de contracts, lógica pura
    index.ts        API pública da feature
  layouts/          arquétipos de página
  lib/
packages/ui/        design system: tokens, primitivos, padrões (com Storybook)
```

- Server functions são **BFF**: repassar auth, buscar dados para SSR, agregar chamadas. **Regra de negócio fica no Nest.**
- Contratos de API vêm de `packages/contracts`, nunca são redeclarados.
- **Rotas não têm lógica.** Carregam dados e compõem componentes de features.
- **Features não importam o interior de outras features**, só o `index.ts`.
- **Features não importam Radix/shadcn diretamente**, só `packages/ui`.
- **Estado:** dados do servidor no TanStack Query (fábricas de `queryOptions` compartilhadas entre loader e componente); filtros, ordenação e paginação na URL (search params validados com Zod); estado de UI local. Store global só com necessidade comprovada.
- **Formulários:** TanStack Form com os schemas de `packages/contracts`.

### Composition pattern

- Componentes com partes são **compound components** (`DataTable.Root`, `DataTable.Toolbar`, `DataTable.Content`...).
- Polimorfismo via **`asChild`** (Slot), nunca prop `as` nem componentes duplicados.
- Variantes via `cva`/`tailwind-variants`, com nomes semânticos (`intent="danger"`), nunca visuais (`color="red"`).
- Mais de 2–3 booleanos mudando estrutura → vira composição.
- Componentes de `packages/ui` são puros (não conhecem dados nem API). Componentes de feature buscam dados e compõem os de UI.

### Design system

Regras visuais em [design/principles.md](design/principles.md). Toda página usa um arquétipo (`ListPage`, `DetailPage`, `FormPage`, `DashboardPage`); página que não se encaixa vira discussão de design. Todo componente de `packages/ui` tem story no Storybook, que é a referência que pessoas e agentes seguem.

## Backend — NestJS monolito modular

- Um módulo por bounded context (candidatos iniciais: `identity`, `job-postings`, `applications`, `resume`, `tailoring`, `documents`, `insights`, `sourcing`).
- Módulos se comunicam por API pública do módulo ou por eventos de domínio; nunca importam o interior de outro módulo. Regras verificadas no CI (dependency-cruiser ou eslint-plugin-boundaries).
- Trabalho pesado ou lento (PDF, IA, coleta de vagas) vai para fila (BullMQ + Redis) e roda no worker, que escala separado da API.
- Toda entidade de dados pertence a um usuário (pronto para multiusuário).
- **Chave primária UUID v7** em toda tabela, com default `uuidv7()` nativo do Postgres. Por isso o projeto exige **PostgreSQL 18+** (imagem fixada no `compose`). O UUID v7 é ordenado no tempo, então mantém o índice compacto como um id sequencial, sem expor contagem de registros. Ele revela o momento de criação do registro, o que é aceitável aqui.

### Preparado para extrair microsserviço

Extrair um módulo deve ser exercício, não reescrita:
- **Schema do Postgres por módulo**, sem joins nem foreign keys entre módulos.
- **Barramento de eventos atrás de uma interface**: em memória hoje; Redis Streams, RabbitMQ ou NATS amanhã, sem mudar os módulos.
- **Outbox pattern** quando eventos precisarem de entrega garantida.
- Candidatos naturais à extração: `documents` (PDF) e `sourcing` (coleta de vagas).

## Escala

| Serviço | Escala por | Pré-requisito |
|---|---|---|
| web | réplicas | sem estado em memória |
| api | réplicas | sessão em DB/Redis, arquivos em S3, nada em disco local |
| worker | réplicas | fila |
| Postgres | vertical, depois PgBouncer e réplicas de leitura | — |

## Portabilidade

| Regra | Na prática |
|---|---|
| Tudo em container | Dockerfile por app; `compose` é a fonte de verdade |
| Config por variável de ambiente | Nada específico de ambiente no código (12-factor) |
| Coolify é substituível | O `compose` sobe num servidor sem Coolify |
| Storage via API S3 | SDK S3 genérico; R2 hoje, S3/MinIO amanhã |
| Servidor como código | Provisionamento e hardening em script versionado (cloud-init/Ansible), ensaiado em VM local |
| Telemetria via OpenTelemetry | O destino (Grafana, Sentry, outro) é configuração |
| Backup com restore testado | Script de restore e teste periódico; migração de banco = restore |

Exercício planejado: migrar de verdade para uma segunda VPS temporária e documentar o runbook.

## Infraestrutura

- **Build das imagens no GitHub Actions**, push para o GHCR; a VPS só baixa e roda.
- **Coolify** orquestra os deploys, incluindo preview por PR.
- **Hardening antes do Coolify:** usuário não-root, SSH só por chave, `ufw`, `fail2ban`, atualizações automáticas.
- **Cloudflare:** DNS com proxy, SSL em **Full (strict)**, portas 80/443 da VPS abertas só para IPs da Cloudflare (ou Cloudflare Tunnel, sem portas abertas).
- **Backups:** dump do Postgres para R2, com retenção definida e restore testado.

## Observabilidade

1. Logs estruturados (pino) com correlation ID desde o dia 1.
2. OpenTelemetry (traces e métricas) no Nest, depois no front.
3. Grafana + Loki + Prometheus + Tempo, coletados pelo Grafana Alloy, com retenção curta (7–15 dias).
4. Uptime Kuma para disponibilidade e alertas.
5. Erros no Sentry free (ou GlitchTip self-hosted, compatível com o SDK).

Futuro: erro no Sentry → issue no GitHub → agente propõe PR → CI + preview → **merge sempre humano**.

## Testes

**Vitest em todo o monorepo**, inclusive no Nest (via SWC). Playwright para E2E.

| Camada | Back (Nest) | Front (Start) |
|---|---|---|
| Unit | Domínio e casos de uso puros, sem DI do Nest | Lógica de `model/`, hooks |
| Integração | Testcontainers com Postgres real (sem mock de banco); módulo via HTTP + eventos | Componentes com Testing Library + MSW |
| Contrato | Schemas de `packages/contracts` validados nas duas pontas | idem |
| Arquitetura | Fronteiras de módulo (dependency-cruiser) | Fronteiras de feature; proibição de imports de UI crus |
| Visual | — | Testes de interação no Storybook; depois, regressão visual com screenshots do Playwright |
| E2E | Playwright contra a stack completa via `docker compose` com as imagens de produção, seed fictício e checagem de acessibilidade (axe); depois também contra o preview do PR | |

- **Determinismo:** teste flaky é bug prioritário.
- **Comandos únicos:** `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`.
- **E2E só para jornadas críticas**; o grosso fica em unit e integração.
- **Factories/builders** de dados de teste, nunca fixtures copiadas.
- **Critério ligado a teste, não porcentagem de cobertura** (a `tlc-spec-driven` liga cada critério de aceite ao teste que o prova). Mutation testing (Stryker) no domínio é estudo futuro.

## Fluxo de desenvolvimento

| Momento | Ferramenta |
|---|---|
| Ideia → decisões e design | `tlc-discover` → `.design/` |
| Escopo de produto | `tlc-prd` → `.prd/` |
| Cada feature | `tlc-spec-driven` → `.specs/` (spec, design, tasks, commit atômico por task) |
| Desenho dos módulos do back | `nestjs-modular-monolith` |
| Bugs e manutenção | `codenavi` |

- Branch protegida (`main`), tudo via PR com CI verde.
- Conventional Commits.
- Decisões difíceis de reverter viram ADR em `docs/adr/`.

## Segurança e repositório público

O repositório será **público** (portfólio). Tudo o que entra em um commit deve ser tratado como publicado para sempre: apagar depois não remove do histórico nem de forks.

**Segredos**
- Nunca commitar segredos. `.env*` ignorado; só `.env.example` com placeholders.
- Segredos de produção ficam no Coolify; os do CI, em GitHub Actions secrets.
- `gitleaks` no pre-commit e no CI. No GitHub: secret scanning + **push protection** ligados.
- Segredo vazado é **rotacionado**, não só removido do código.

**Dados pessoais**
- Dados reais de currículo, candidaturas e contatos **nunca** entram no repositório: seeds, fixtures e exemplos usam dados fictícios. Dados reais vivem só no banco de produção.
- Fixtures de vagas reais: só texto genérico/anonimizado.

**Infraestrutura**
- Sem IP da VPS, usuários de SSH, portas ou hostnames internos no código: tudo por variável/placeholder.
- Scripts de provisionamento recebem valores sensíveis por variável, nunca hardcoded.

**CI/CD**
- `permissions:` mínimas em cada workflow; actions de terceiros fixadas por SHA.
- PRs de forks nunca recebem segredos nem disparam preview deploy (evitar `pull_request_target` com checkout do código do PR).
- Dependabot + CodeQL (gratuitos em repo público).

**Antes de publicar o repo**
- Escolher a licença: MIT favorece o portfólio, mas permite que qualquer um use o código, inclusive comercialmente; sem licença, o código é visível mas todos os direitos ficam reservados. Decisão pendente na discovery.
- Skills de terceiros só entram com licença que permita redistribuição; as da Tech Leads Club são CC-BY-4.0, com crédito no README.
- Rodar `gitleaks` no histórico inteiro.
