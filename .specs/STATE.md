# STATE

## Decisions

### AD-001
- **Decision**: Cada app gera a própria imagem com `turbo prune` + `pnpm deploy --prod`, roda como usuário `node` e sem `.env`; o `web` roda com srvx sobre o `dist/` do Vite, sem Nitro.
- **Reason**: Um padrão de Dockerfile para toda app, imagens só com as dependências de produção de cada uma, nenhuma dependência em release candidate (o Nitro 3 está em RC).
- **Trade-off**: A imagem do `web` carrega `node_modules` em vez do `.output` autocontido do Nitro. Revisar quando o Nitro 3 for estável.
- **Scope**: `apps/*`, Dockerfiles, `compose.yaml`, deploy
- **Date**: 2026-11-02
- **Status**: active

### AD-002
- **Decision**: TypeScript fixado em 6.0.x no catalog do pnpm.
- **Reason**: O `typescript-eslint` 8 aceita só TypeScript `<6.1`; o Nest 12 exige TypeScript 6 ou mais.
- **Trade-off**: Sem o compilador nativo do TypeScript 7 até o `typescript-eslint` suportá-lo.
- **Scope**: todo o monorepo
- **Date**: 2026-11-02
- **Status**: active

### AD-003
- **Decision**: As regras de repositório (lint, fronteiras, hooks, CI, `.env.example`) são provadas por testes Vitest no workspace `tooling/guardrails`, que roda no `pnpm test`.
- **Reason**: Guard-rail sem teste pode parar de barrar sem ninguém notar; nenhuma app carrega testes de infraestrutura.
- **Trade-off**: Um workspace a mais, e testes que dependem de Docker e git rodando na máquina.
- **Scope**: `tooling/guardrails`, toda regra nova de repositório
- **Date**: 2026-11-02
- **Status**: active

### AD-004
- **Decision**: O navegador fala só com o TanStack Start, que repassa as chamadas à API pela rede interna (BFF). O cookie de sessão é host-only no web e a API não tem domínio público nem CORS.
- **Reason**: Um único caminho de autenticação em SSR, client, local e preview por PR, e menos superfície exposta. Pergunta: "Com os trade-offs acima, qual porta fica decidida?"; opção escolhida: "BFF no Start". Substitui o cookie compartilhado da Key decision 3 do `.design`.
- **Trade-off**: Um salto a mais em cada chamada do client, uma camada BFF por endpoint e repasse explícito do IP do cliente para o bloqueio de login. Clientes fora do navegador exigirão publicar a API depois.
- **Scope**: `apps/web`, `apps/api`, `compose.yaml`, feature `production-deploy`
- **Date**: 2026-11-03
- **Status**: active

### AD-005
- **Decision**: Contas separadas: `admin` só administra (`/admin/*`, `POST /auth/admin/login`) e `member` só usa o produto (`/`, `POST /auth/login`). O e-mail é único entre os dois papéis, e os dois usam a mesma tabela de sessões.
- **Reason**: Preparar a separação entre operador e cliente caso o produto vire SaaS. Pergunta: "Como conta e sessão de admin se relacionam com o produto?"; opção escolhida: "Contas separadas".
- **Trade-off**: O autor mantém duas contas, com e-mails diferentes, e faz logout para alternar. Cada módulo de produto aplica o guard de member.
- **Scope**: módulo `identity`, rotas do `web`, todos os módulos de produto
- **Date**: 2026-11-03
- **Status**: active

### AD-006
- **Decision**: O acesso às rotas da API é decidido no servidor, a cada requisição: o guard global busca a sessão pelo SHA-256 do token e lê o papel do usuário em `identity.users`, sem papel no token e sem cache. Toda rota declara o acesso como pública, de um papel específico ou de qualquer sessão, e um teste de arquitetura falha quando uma rota não declara.
- **Reason**: O papel e a revogação valem na requisição seguinte, e esquecer a declaração quebra o CI em vez de abrir uma brecha. Pergunta: "Quer que eu inclua esse requisito?"; resposta do usuário: "pode incluir esse requisito".
- **Trade-off**: Uma consulta ao Postgres por requisição autenticada. Cache só entra com medição que mostre impacto na latência ou no pool de conexões, atrás da interface de sessão do módulo `identity`.
- **Scope**: `apps/api`, todos os módulos do backend
- **Date**: 2026-11-03
- **Status**: active

### AD-007
- **Decision**: O BFF do `web` tem uma server function por endpoint da API, sobre o `callApi` de `apps/web/src/lib/call-api.ts`. Não existe rota proxy genérica.
- **Reason**: O navegador só alcança o que tem função, o CSRF do Start cobre esse caminho e SSR e client usam a mesma função. Pergunta: "Aprova o design com uma server function por endpoint?"; resposta do usuário: "Aprovo o design".
- **Trade-off**: Uma função curta a mais por endpoint em cada fatia.
- **Scope**: `apps/web`, todas as features
- **Date**: 2026-11-03
- **Status**: active

## Handoff
