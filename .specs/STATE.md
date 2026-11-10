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

### AD-010 (superseded by AD-021)
- **Decision**: A home do member mostra os três passos numerados e o `EmptyState` com a dica do ⌘K, sem os botões "Começar pelo perfil" e "Nova candidatura" até as fatias existirem.
- **Reason**: Pergunta: "O que a home mostra hoje, já que os passos levam a telas inexistentes?"; opção escolhida: "Passos sem ação".
- **Trade-off**: Os passos 2 e 3 são texto, sem caminho para agir.
- **Scope**: `apps/web` rota `_member/index`
- **Date**: 2026-11-08
- **Status**: superseded by AD-021

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

### AD-013 (superseded by AD-019)
- **Decision**: O catálogo de skills do admin não mostra quantas vagas usam cada skill nem o grupo "Mais usadas"; as linhas ficam em ordem alfabética pelo nome oficial.
- **Reason**: As vagas só existem na fatia Application, e um módulo não lê o schema do outro. Pergunta: "Como tratar 'N vagas' e o grupo 'Mais usadas'?"; opção escolhida: "Omitir agora".
- **Trade-off**: A tela fica sem o sinal de quais privadas valem a promoção, até Application existir.
- **Scope**: `apps/web` feature `skills`, `GET /admin/skills`
- **Date**: 2026-11-08
- **Status**: superseded by AD-019

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

### AD-017 (active)
- **Decision**: A feature Application não mostra nada que dependa do currículo: sem a cobertura "4/6" na lista, sem a frase "seu currículo cobre" e a tag `match` no detalhe, sem a seção "Currículo" e sem o documento no evento de status. `POST /applications/:id/status` não aceita `submittedDocumentId` até ResumeDocument existir.
- **Reason**: MasterResume, ResumeVersion e ResumeDocument ainda não existem. Pergunta: "O que a feature Application faz com elas?"; opção escolhida: "Omitir até existirem".
- **Trade-off**: As telas ficam mais vazias que as cartas `PageApplications` e `PageApplicationDetail`; cada fatia de currículo acrescenta a sua parte.
- **Scope**: módulo `applications`, `apps/web` feature `applications`
- **Date**: 2026-11-08
- **Status**: active

### AD-018 (active)
- **Decision**: A etapa na linha do tempo mostra "Etapa {tipo}" e a nota, sem resultado ("concluída").
- **Reason**: O evento `stage` do `.design` não tem resultado. Pergunta: "O que a linha mostra?"; opção escolhida: "'Etapa RH' + nota".
- **Trade-off**: Para dizer que a etapa foi concluída, o usuário escreve na nota.
- **Scope**: `apps/web` feature `applications`
- **Date**: 2026-11-08
- **Status**: active

### AD-019 (active)
- **Decision**: O catálogo de skills do admin mostra, em cada linha, quantas vagas de todas as pessoas usam a skill ("0 vagas", "1 vaga", "N vagas"). A ordem continua alfabética e paginada no SQL, e o grupo "Mais usadas" fica de fora. A contagem vem só para as skills da página, por uma porta (`SKILL_USAGE.countFor(ids)`) que o módulo `skills` declara e o `applications` implementa, sem um ler o schema do outro. Substitui AD-013.
- **Reason**: A fatia Application existe agora. Pergunta: "Quais entram agora?"; opção escolhida: "Os dois". Ordenar por uso exigiria carregar o catálogo inteiro, o que o usuário recusou ("não é aceitável a página do admin carregar todas as skill"); pergunta seguinte: "Uma listagem simples, sem carregar primeiro as mais usadas resolve o problema?"; confirmação: "Sim".
- **Trade-off**: Sem o sinal de "mais usadas" no topo; ele pode voltar como um grupo separado das 10 mais usadas sem mexer na paginação. É uma leitura agregada entre usuários; só o número sai do módulo, nunca a vaga ou o dono.
- **Scope**: módulos `skills` e `applications`, `GET /admin/skills`, `apps/web` feature `skills`
- **Date**: 2026-11-08
- **Status**: active

### AD-020 (active)
- **Decision**: "Ainda não" no Alert de sem retorno grava `applications.ghost_snoozed_until` (agora + 21 dias) por `POST /applications/:id/ghost-snooze`; a sugestão some até essa data, sem evento e sem contar como atividade.
- **Reason**: Pergunta: "O que 'Ainda não' faz?"; opção escolhida: "Adia 21 dias, salvo". Acrescenta uma coluna e uma rota ao `.design`.
- **Trade-off**: Um estado a mais na candidatura que não aparece na linha do tempo.
- **Scope**: módulo `applications`, `apps/web` feature `applications`
- **Date**: 2026-11-08
- **Status**: active

### AD-021 (active)
- **Decision**: O passo 03 da home do member ganha o botão "Nova candidatura", que abre `/applications` com o diálogo aberto. Substitui AD-010 no que toca ao passo 03; o passo 02 segue sem ação até MasterResume.
- **Reason**: Pergunta: "Quais entram agora?"; opção escolhida: "Os dois".
- **Trade-off**: Nenhum.
- **Scope**: `apps/web` rota `_member/index`
- **Date**: 2026-11-08
- **Status**: active

### AD-022 (active)
- **Decision**: No detalhe da candidatura, "+ Skill" aparece nas linhas "Obrigatórias" e "Desejáveis"; a carta `PageApplicationDetail` o desenha só em "Desejáveis".
- **Reason**: Sem o botão em "Obrigatórias" não há como acrescentar uma skill obrigatória pelo detalhe (APP-73). Decidido pelo orquestrador durante a execução, com a delegação do usuário: "Só me chame em dúvidas críticas que você não consegue resolver só".
- **Trade-off**: Um controle a mais que a carta.
- **Scope**: `apps/web` feature `applications`
- **Date**: 2026-11-08
- **Status**: active

### AD-023 (active)
- **Decision**: As tags de skill do diálogo de cadastro e do detalhe mostram o "×" de remover; as cartas `PageNewApplication` e `PageApplicationDetail` desenham as tags do detalhe sem ele.
- **Reason**: Os critérios aprovados APP-59 ("tag removível") e APP-73 ("o '×' de uma tag") pedem o gesto; spec aprovada pelo usuário em 2026-11-08 ("Sim"). Registrado como diferença pelo orquestrador depois do achado 13 do Verifier.
- **Trade-off**: As tags ficam mais largas que na carta, e a linha "Obrigatórias" pode quebrar.
- **Scope**: `apps/web` features `applications` e `skills`
- **Date**: 2026-11-08
- **Status**: active

### AD-024 (active)
- **Decision**: O hardening deixa o root entrar por SSH só com chave (`PermitRootLogin prohibit-password`) em vez de desligar o login de root, e o `harden.sh` aceita `HARDEN_STEPS` para rodar só alguns passos (num servidor já endurecido, só `firewall`).
- **Reason**: O Coolify administra o servidor em que roda por SSH como root, então desligar esse login pararia todos os deploys. Mostrado na verificação do servidor real em 2026-11-09, que o critério DEPLOY-26 (desligar o login de root) não previa; os demais critérios de DEPLOY-26 (senha desligada, `sshd -t` antes do reload, rollback) seguem valendo.
- **Trade-off**: A conta de root continua existindo para login por chave; a proteção contra força bruta fica com a chave, o `fail2ban` e o firewall.
- **Scope**: `infra/provision/harden.sh`, `docs/runbooks/production-deploy.md`, feature `production-deploy` (DEPLOY-26)
- **Date**: 2026-11-09
- **Status**: active

### AD-025 (active)
- **Decision**: O CI mantém o tempo plano quando o projeto cresce. O PR sempre roda lint, typecheck, `pnpm test` (com o cache do turbo entre runs), integração (em shards do Vitest), scan de segredos e actionlint. `test:repo-rules`, E2E e infraestrutura rodam no PR só quando ele muda o que essas suítes provam (`scripts/ci-scopes.sh`), ou com o label `ci:full` ou a variável `CI_FULL=true`. O push na `main` roda tudo uma vez, como gates do deploy: o `ci.yml` deixou de rodar no push. O E2E roda no CI em grupos (`platform` e `browser` em shards, `E2E_GROUP`), cada um com a própria stack. O `test:repo-rules` planta uma violação em cada workspace e roda cada comando da raiz uma vez (`turbo --continue=always`, agora padrão em `pnpm lint` e `pnpm typecheck`). O job `images` saiu: as imagens já são construídas pelo E2E, pela infraestrutura e pelo deploy.
- **Reason**: O PR levava 6–7 min contra um orçamento de 3 min, com `CI_FULL` ligado, e cada suíte crescia com as features (repo-rules com o número de workspaces, E2E e integração com o número de specs). O usuário pediu ajustes que considerem a evolução do sistema: "não adianta melhorar os números agora, e quando a próxima feature for criada, os tempos piorarem muito".
- **Trade-off**: Um PR que não toca `apps/`, `packages/` ou `tests/e2e/` não roda o E2E; uma quebra que escape do escopo aparece no push na `main` e segura o deploy. Mais jobs em paralelo gastam mais minutos de runner por PR que mudam código. Com `--continue=always`, `pnpm lint` e `pnpm typecheck` mostram todos os erros, e uma dependência quebrada pode gerar erros em cascata nos workspaces que dependem dela.
- **Scope**: `.github/workflows/ci.yml`, `.github/actions/*`, `scripts/ci-scopes.sh`, `package.json`, `tests/e2e/playwright.config.ts`, `tooling/guardrails`, `docs/workflow.md`
- **Date**: 2026-11-10
- **Status**: active

### AD-026 (active)
- **Decision**: O currículo mestre não tem o botão "Visualizar PDF" na topbar até a fatia ResumeDocument existir; ela acrescenta o botão.
- **Reason**: O PDF só existe com ResumeDocument. Pergunta: "O botão 'Visualizar PDF' da topbar do currículo mestre depende do PDF, que só chega na fatia ResumeDocument. O que fazer agora?"; opção escolhida: "Omitir até existir".
- **Trade-off**: A tela fica sem o atalho para ver o resultado final até a fase do PDF; a topbar só mostra "Salvo às".
- **Scope**: `apps/web` feature `resume`, carta `PageMasterResume`
- **Date**: 2026-11-10
- **Status**: active

### AD-027 (active)
- **Decision**: Reordenar por arrastar usa o `Sortable` de `packages/ui`, sobre `@dnd-kit/core` e `@dnd-kit/sortable` (versões estáveis, não `@dnd-kit/react` 0.x), sempre com sensor de teclado e anúncios vindos do chamador. Nenhuma feature importa `@dnd-kit` direto.
- **Reason**: Pergunta: "Reordenar experiências, projetos e bullets no currículo mestre: […] Como o usuário reordena?"; opção escolhida: "Arrastar + teclado". Uma lib só, atrás de um componente do design system, mantém o gesto e a acessibilidade iguais em toda tela que reordena (ResumeVersion também reordena).
- **Trade-off**: Uma dependência a mais no `packages/ui`; arrastar só é provado em teste de browser e E2E, não em jsdom.
- **Scope**: `packages/ui`, features `master-resume` e `resume-version`
- **Date**: 2026-11-10
- **Status**: active

### AD-028 (active)
- **Decision**: Cada leitura entrega só o que o consumidor usa, com teto declarado: valor derivado (sim/não, total, contagem) vem calculado da API; ordenar, filtrar, contar e paginar rodam no SQL; o loader não devolve dado que a página não mostra; resposta de escrita devolve o que mudou. Todo `design.md` de feature tem a seção `## Data Reads` (`Consumer | Endpoint | Uses | Returns | Worst case | In the HTML`), com o pior caso em número, e `tooling/guardrails/src/design-data-reads.test.ts` reprova o design sem ela. Regra em `docs/engineering-guidelines.md`.
- **Reason**: O excesso de leitura apareceu em mais de um design e só foi pego pelo usuário na revisão: o catálogo do admin carregando todas as skills (AD-019) e a home lendo o currículo inteiro para o passo 02 (feature `master-resume`). Pedido do usuário: "crie alguma regra no sistema para evitar esse problema de design, que não faz sentido se repetir, e ja aconteceu outras vezes nas etapas de design".
- **Trade-off**: Uma seção a mais em cada design e um teste de guarda; endpoints de resumo a mais (`/count`, `/summary`) em vez de reaproveitar a leitura completa. Os designs anteriores (walking-skeleton a production-deploy) não são reescritos.
- **Scope**: todo design de feature, `apps/api`, `apps/web` loaders, `tooling/guardrails`, `AGENTS.md`, `docs/workflow.md`
- **Date**: 2026-11-10
- **Status**: active

## Handoff

- **Feature**: `master-resume` - closed on branch `feat/master-resume`, 2026-11-10 (not pushed).
- **Done**: T1-T36 by Sonnet 5.5 workers in 5 batches (B3 carried one fix into B4), orchestrated and checked by Opus 5.5. Verifier (Opus 5.5) judged 81/86 checks holding and wrote 6 findings, all closed (`927a3dc`, `7143f2d`, `36b320d`, `9155f7a`, picture `6e96855`); the spec gained RES-87 and clearer RES-69 to follow the capture. Screens round 2: `matches`. Reports: `.specs/features/master-resume/verification.md`, `screens.md`.
- **Gates at the fix pass**: `pnpm build`, `typecheck`, `lint`, `pnpm test --force` (contracts 98, api 127, web 894, ui 650, guardrails 165), `pnpm test:integration` (348), `pnpm test:e2e` (67).
- **Decisions in the feature**: AD-026, AD-027 (and AD-028, merged before in #17).
- **Lessons**: L-033 to L-037 recorded as candidates.
- **Open for the author**: `gate.out` (a gate log with a local path) is out of the tree and ignored, but still inside commit `a319349`; rewrite the branch history before the first push.
- **Next**: after the author's go-ahead, remove `gate.out` from the branch history, push `feat/master-resume` and open the PR to `main`; merge with green CI, then `git switch main && git pull --ff-only && git branch -d feat/master-resume`. Then the review of reads under AD-028, before ResumeVersion.
