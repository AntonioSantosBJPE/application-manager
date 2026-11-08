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

### AD-008 (active)
- **Decision**: A sidebar mostra só o que existe: o member vê Início; o admin vê Painel, Convites e Status do sistema. O botão "Buscar ⌘K" e os itens das fases futuras (Candidaturas, Currículo mestre, Skills, Insights, Catálogo de skills) entram junto com a fatia que os cria.
- **Reason**: Controle sem gesto contraria o guia do `AppShell` ("itens aparecem quando a fatia existe"). Pergunta: "O botão Buscar ⌘K e os itens de menu das fases futuras: o que a sidebar mostra hoje?"; opção escolhida: "Só o que existe".
- **Trade-off**: As telas atuais ficam mais vazias que as cartas `PageMemberHome` e `PageAdminDashboard`.
- **Scope**: `packages/ui` AppShell, `apps/web` rotas `_member` e `admin`
- **Date**: 2026-11-08
- **Status**: active

### AD-009 (active)
- **Decision**: A linha do convite não mostra quem convidou, e a API não muda. O horário "Verificado" do status é o instante em que o `web` leu a saúde da API.
- **Reason**: O contrato de convites e o `/health` não carregam esses dados, e esta feature é só de UI. Pergunta: "Como tratar 'por você' e 'Verificado 14:32:07'?"; opção escolhida: "Omitir quem convidou; carimbar verificação no web".
- **Trade-off**: A coluna "por você" da carta `PageAdminInvitations` fica de fora; em `/status`, que é cacheável, o horário é o da leitura que gerou a página.
- **Scope**: `apps/web` features `identity` e `system-status`
- **Date**: 2026-11-08
- **Status**: active

### AD-010 (active)
- **Decision**: A home do member mostra os três passos numerados e o `EmptyState` com a dica do ⌘K, sem os botões "Começar pelo perfil" e "Nova candidatura" até as fatias existirem.
- **Reason**: Pergunta: "O que a home mostra hoje, já que os passos levam a telas inexistentes?"; opção escolhida: "Passos sem ação".
- **Trade-off**: Os passos 2 e 3 são texto, sem caminho para agir.
- **Scope**: `apps/web` rota `_member/index`
- **Date**: 2026-11-08
- **Status**: active

### AD-011 (active)
- **Decision**: Dois textos das cartas mudam: a home saúda "Olá, {nome}" (sem "Bom dia/Boa tarde") e o convite diz "Você recebeu um convite para o Rumo Carreira." (sem flexão de gênero).
- **Reason**: O horário depende do fuso do navegador e diverge entre SSR e cliente; o gênero de quem recebe não é conhecido. Perguntas: "O que a home diz?" (opção "Olá, {nome}") e "Qual texto vale para qualquer pessoa?" (opção "Você recebeu um convite…").
- **Trade-off**: Duas frases diferem da carta.
- **Scope**: `apps/web` home do member e tela de convite
- **Date**: 2026-11-08
- **Status**: active

### AD-012 (active)
- **Decision**: O produto é Rumo Carreira e o design system é Prumo (referência em `docs/design/system/`). Geist e Geist Mono vêm auto-hospedadas por `@fontsource` no web e no Storybook, e os ícones são `lucide-react`; nenhuma fonte ou ícone é carregado de terceiro em runtime.
- **Reason**: Portabilidade e privacidade: o IP do visitante não vai ao Google, e a CSP pode ser restrita. Pergunta: "Como o app serve as fontes?"; opção escolhida: "Auto-hospedadas via @fontsource".
- **Trade-off**: Os pacotes de fonte entram no build e no peso da página.
- **Scope**: `packages/ui`, `apps/web`, Storybook
- **Date**: 2026-11-08
- **Status**: active

### AD-013 (active)
- **Decision**: O catálogo de skills do admin não mostra quantas vagas usam cada skill nem o grupo "Mais usadas"; as linhas ficam em ordem alfabética pelo nome oficial.
- **Reason**: As vagas só existem na fatia Application, e um módulo não lê o schema do outro. Pergunta: "Como tratar 'N vagas' e o grupo 'Mais usadas'?"; opção escolhida: "Omitir agora".
- **Trade-off**: A tela fica sem o sinal de quais privadas valem a promoção, até Application existir.
- **Scope**: `apps/web` feature `skills`, `GET /admin/skills`
- **Date**: 2026-11-08
- **Status**: active

### AD-014 (active)
- **Decision**: Apelido só existe em skill global; para dar apelido a uma privada, o admin a promove antes. A linha de uma privada não mostra apelidos.
- **Reason**: O apelido é único globalmente, então um apelido numa skill privada de uma pessoa passaria a bloquear esse nome para todas, inclusive para uma global futura. Pergunta: "Em quais skills o admin pode adicionar apelido?"; opção escolhida: "Só globais; '+ Apelido' abre um diálogo".
- **Trade-off**: A carta mostra "drizzle" numa privada; o produto mostra "—".
- **Scope**: módulo `skills`, `apps/web` feature `skills`
- **Date**: 2026-11-08
- **Status**: active

### AD-015 (active)
- **Decision**: A categoria `language` tem um só rótulo, "Linguagem", no chip de filtro e na linha.
- **Reason**: O enum tem uma categoria `language`; "Linguagem/runtime" da carta é lido como texto de exemplo. Pergunta: "Qual rótulo a tela usa?"; opção escolhida: "'Linguagem' no chip e na linha".
- **Trade-off**: A linha do Node.js diz "Linguagem", e não "Linguagem/runtime".
- **Scope**: `apps/web` feature `skills`
- **Date**: 2026-11-08
- **Status**: active

### AD-016 (active)
- **Decision**: Os helpers do BFF do `web` (`Outcome`, `ApiFailure`, o parse do contrato, o contexto da requisição e o repasse de `Set-Cookie`) ficam em `apps/web/src/lib/bff.ts`; cada feature tem só as suas server functions e importa o resto de `lib`.
- **Reason**: Uma feature não importa o interior de outra, e copiar os helpers criaria dois pontos de verdade para cookie e IP do cliente. Pergunta: "Aprova o design com a abordagem A?"; resposta do usuário: "Sim".
- **Trade-off**: A feature `identity` perde a posse dos helpers e passa a importá-los de `lib`.
- **Scope**: `apps/web`, todas as features
- **Date**: 2026-11-08
- **Status**: active

## Handoff

- **Feature**: `skills` - closed on branch `feat/skills`, 2026-11-08.
- **Done**: T1-T36 committed; Verifier (Opus 5.5) judged 76/76 checks holding; its finding (U+0000 answered 500) closed in `b707f9f` and `d7eb144`; a flaky C32 test closed in `ba12ec7`. Report: `.specs/features/skills/verification.md`.
- **Gates at `ba12ec7`**: `pnpm build`, `typecheck`, `lint`, `pnpm test --force` (contracts 42, guardrails 32, api 74, web 401, ui 474), `pnpm test:integration` (163, twice), `pnpm test:e2e` (54).
- **Lessons**: L-014 and L-015 recorded as candidates.
- **Open for the author**: review the seed list `apps/api/src/modules/skills/seed/global-skills.json` (322 skills) in the PR before the merge; Verifier observations with no finding: the 60-character limit counts the text without NFC, and the web drops a search above 60 characters silently.
- **Note for the next features**: turbo caches `@am/guardrails`, so a change outside that package does not rerun the repository pattern checks; run `pnpm test --force` in the gates.
- **Next**: PR `feat/skills` -> `main`, merge with green CI, then `git switch main && git pull --ff-only && git branch -d feat/skills`.
