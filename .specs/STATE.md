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

## Handoff
