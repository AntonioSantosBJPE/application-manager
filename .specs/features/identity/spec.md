# Identity Specification

**Approved**: 2026-11-03 - user: "Aprovo a spec"

## Problem Statement

Toda fatia seguinte guarda dados pessoais reais de um usuário, e hoje o sistema não sabe quem está acessando. Esta feature cria o acesso por convite com sessão revogável no servidor, separa a administração do uso do produto e define o guard que os próximos módulos usam. Sem cadastro aberto e sem envio de e-mail: o admin copia o link do convite e troca senhas pela linha de comando.

## Goals

- [ ] Um admin criado pelo CLI entra em `/admin/login`, convida uma pessoa e copia o link; a pessoa aceita o convite e cai logada na home do produto.
- [ ] Todos os estados de Identity do `.design` (`204`, `401`, `429`, `403`, `201`, `410`) têm um teste que falharia se o comportamento mudasse.
- [ ] Toda rota da API exige sessão por padrão, e os módulos seguintes reaproveitam o guard pela API pública do módulo `identity`.

## Out of Scope

| Feature                                                                                  | Reason                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Recuperação de senha e convite por e-mail                                                | Roadmap: envio de e-mail entra com o primeiro usuário além do autor                                                                        |
| Troca da própria senha pela interface                                                    | Fora do `.design`; a troca é feita pelo CLI                                                                                                |
| Login social e 2FA                                                                       | Roadmap: entram com cadastro aberto                                                                                                        |
| Cadastro aberto                                                                          | Roadmap: depende da decisão de virar SaaS                                                                                                  |
| Tela de sessões ativas, lista de usuários, exclusão de conta, promoção de member a admin | Fora do `.design`; sem necessidade com poucos usuários                                                                                     |
| Rotas do produto além da home mínima                                                     | Cada fatia seguinte cria as suas e aplica o guard de member                                                                                |
| Publicar a stack na VPS                                                                  | Feature `production-deploy`, que recebe daqui a regra de a API não ter domínio público (AD-004)                                            |
| Redis e cache de sessão                                                                  | Redis entra na fatia ResumeDocument, para a fila; sessões e bloqueio de login usam Postgres, e cache só entra com medição que o justifique |
| Botão de tema, command palette, identidade visual definitiva                             | Etapa de design dedicada; aqui o tema segue o sistema                                                                                      |

---

## Assumptions & Open Questions

| Assumption / decision                | Chosen default                                                                                                                                                                             | Rationale                                                                                                            | Confirmed? |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| Porta da Key decision 3              | BFF: o navegador só fala com o Start, e a API fica sem domínio público (AD-004)                                                                                                            | Um único caminho de auth em SSR, client, local e preview                                                             | y          |
| Contas                               | Contas separadas: admin só administra, member só usa o produto; o e-mail é único entre os dois (AD-005)                                                                                    | Resposta do usuário: "Contas separadas"                                                                              | y          |
| Entradas de login                    | `/login` só para member e `/admin/login` só para admin; credencial na entrada errada recebe o mesmo `401`                                                                                  | Resposta do usuário sobre login próprio do admin; o `401` igual não revela o papel                                   | y          |
| CLI                                  | `create-admin` e `reset-password`; senha por prompt oculto ou `--password-stdin`                                                                                                           | Resposta do usuário: "Dois subcomandos"; e-mail digitado errado nunca cria admin                                     | y          |
| Regra de senha                       | 12 a 128 caracteres, sem regra de composição                                                                                                                                               | Resposta do usuário: "Mínimo 12 caracteres"                                                                          | y          |
| Limites do `429`                     | 5 falhas por e-mail + IP e 50 por IP, em 15 min                                                                                                                                            | Resposta do usuário: "E-mail + IP e teto por IP"                                                                     | y          |
| Tela de convites                     | Formulário e lista de pendentes com revogação; acrescenta `GET /invitations` e `DELETE /invitations/:id`                                                                                   | Resposta do usuário: "Formulário + lista"                                                                            | y          |
| Abertura do convite                  | `GET /invitations/:token` valida ao abrir                                                                                                                                                  | Resposta do usuário: "Ao abrir o link"                                                                               | y          |
| Página de status                     | Vai para `/status`, pública; o dashboard do admin reaproveita o painel                                                                                                                     | Resposta do usuário: "/status público + widget"                                                                      | y          |
| Arquétipos                           | `AuthPage` novo em `/login`, `/admin/login` e `/invite/:token`; `DashboardPage` em `/` e `/admin`; `ListPage` em `/admin/invitations`                                                      | Resposta do usuário: "AuthPage novo"; os outros seguem `docs/design/principles.md`                                   | y          |
| Dashboard do admin                   | Painel de status, total de convites pendentes e link para convites                                                                                                                         | Conteúdo mínimo sem endpoint além do pedido; proposto por mim                                                        | y          |
| Convidar e-mail com convite pendente | O novo convite revoga o anterior                                                                                                                                                           | O link não pode ser reexibido, então é assim que se recupera um link perdido                                         | y          |
| Token de convite desconhecido        | `410`, igual a expirado, usado ou revogado                                                                                                                                                 | A tela é a mesma e o token tem 256 bits, então não há enumeração a evitar                                            | y          |
| Papel do convidado                   | Sempre `member`; admin só nasce pelo CLI                                                                                                                                                   | `POST /invitations` do `.design` não recebe papel                                                                    | y          |
| Aceitar convite estando logado       | A sessão atual é revogada e a nova assume                                                                                                                                                  | Um navegador tem um único cookie de sessão                                                                           | y          |
| Sessões simultâneas                  | Permitidas, sem limite                                                                                                                                                                     | Uso em mais de um dispositivo; o `reset-password` revoga todas                                                       | y          |
| Duração da sessão                    | 30 dias deslizantes, sem teto absoluto; renovada quando restam menos de 29 dias                                                                                                            | O `.design` define 30 dias deslizantes; o limiar evita uma escrita por requisição                                    | y          |
| Consulta de sessão                   | Postgres a cada requisição, por índice único em `token_hash`, sem cache                                                                                                                    | Poucos usuários; sem cache, a revogação vale na requisição seguinte, sem invalidação para manter                     | y          |
| Hash de senha                        | Argon2id com `m=19456 KiB`, `t=2`, `p=1`, salt de 16 bytes, saída de 32 bytes, em formato PHC, via `node:crypto`                                                                           | Configuração da OWASP; Node 24 já traz o algoritmo, sem dependência nativa, e o PHC permite trocar parâmetros depois | y          |
| Tokens                               | 32 bytes de CSPRNG em base64url; o banco guarda só o SHA-256 em hex                                                                                                                        | 256 bits de entropia dispensam hash lento                                                                            | y          |
| Cookie                               | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` de 30 dias, sem `Domain`; `Secure` e nome `__Host-am_session` por padrão, `am_session` com `SESSION_COOKIE_SECURE=false` no ambiente local | `Lax` mantém a sessão ao chegar por link externo; `__Host-` trava o cookie no host                                   | y          |
| CSRF                                 | `SameSite=Lax` + middleware de CSRF do Start nas server functions; a API não habilita CORS                                                                                                 | O navegador nunca chama a API diretamente                                                                            | y          |
| Estado do bloqueio                   | Tabela `identity.login_attempts` no Postgres, com linhas apagadas após a janela                                                                                                            | A API escala em réplicas sem estado e o Redis ainda não existe; IP é dado pessoal, então a retenção é curta          | y          |
| IP do cliente                        | O web obtém o IP do header definido em `CLIENT_IP_HEADER` (ou do socket, sem a variável) e o repassa à API                                                                                 | Cloudflare e Coolify ficam na frente do web; a config fica por ambiente                                              | y          |
| Link do convite                      | `WEB_PUBLIC_URL`, obrigatória na API                                                                                                                                                       | Config por env; o `inviteUrl` é contrato da API                                                                      | y          |
| Corpo inválido                       | `400` em Problem Details                                                                                                                                                                   | Convenção de erros do `.design`; nenhum contrato define outro status                                                 | y          |
| Larguras de tela                     | 375 px e 1280 px, sem rolagem horizontal da página                                                                                                                                         | Sem captura de referência; diretriz de acessibilidade e densidade                                                    | y          |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Primeiro admin e troca de senha pelo CLI ⭐ MVP

**User Story**: Como operador do servidor, quero criar admins e trocar senhas por comando, para não existir nenhum endpoint público capaz disso.

**Why P1**: Sem o primeiro admin, ninguém entra no sistema.

**Acceptance Criteria**:

1. WHEN `create-admin --email --name` roda com e-mail novo e senha válida THEN o CLI SHALL criar um usuário `admin` com o e-mail em minúsculas e sair com código 0. (CLI-01)
2. IF o e-mail de `create-admin` já existe em qualquer papel THEN o CLI SHALL sair com código diferente de 0 sem alterar nenhum usuário. (CLI-02)
3. WHEN `reset-password --email` roda para um usuário existente de qualquer papel THEN o CLI SHALL trocar o hash da senha, manter o papel e revogar todas as sessões desse usuário. (CLI-03)
4. IF o e-mail de `reset-password` não existe THEN o CLI SHALL sair com código diferente de 0 sem criar usuário. (CLI-04)
5. IF a senha informada ao CLI tiver menos de 12 ou mais de 128 caracteres THEN o CLI SHALL sair com código diferente de 0 sem gravar nada. (CLI-05)
6. The CLI SHALL read the password only from a hidden prompt or from standard input with `--password-stdin`, and SHALL reject a password passed as a command-line argument. (CLI-06)
7. The API SHALL expose no endpoint that creates an admin or changes a password. (CLI-07)

**Independent Test**: Rodar os dois subcomandos contra um Postgres real e conferir as linhas de `identity.users` e `identity.sessions`.

---

### P1: Login, sessão e logout ⭐ MVP

**User Story**: Como usuário convidado ou admin, quero entrar com e-mail e senha e continuar logado, para usar o sistema sem repetir o login a cada visita.

**Why P1**: É a porta de todas as fatias seguintes.

**Acceptance Criteria**:

1. WHEN um member envia credenciais válidas a `POST /auth/login` THEN a API SHALL criar uma sessão, definir o cookie e responder `204`. (AUTH-01)
2. WHEN um admin envia credenciais válidas a `POST /auth/admin/login` THEN a API SHALL criar uma sessão, definir o cookie e responder `204`. (AUTH-02)
3. IF a senha está errada, o e-mail não existe ou a conta é do papel da outra entrada THEN a API SHALL responder `401` com corpo Problem Details idêntico nos três casos, sem criar sessão. (AUTH-03)
4. IF o e-mail não existe THEN a API SHALL executar a mesma verificação Argon2id de uma senha errada antes de responder. (AUTH-04)
5. The API SHALL store passwords only as Argon2id PHC strings with `m=19456`, `t=2`, `p=1`. (AUTH-05)
6. The API SHALL store session and invitation tokens only as SHA-256 hashes, generated from 32 random bytes. (AUTH-06)
7. The session cookie SHALL carry `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` and no `Domain`. (AUTH-07)
8. WHERE `SESSION_COOKIE_SECURE` não é `false` the session cookie SHALL be named `__Host-am_session` and carry `Secure`. (AUTH-08)
9. WHEN `GET /auth/me` é chamado com sessão válida THEN a API SHALL responder `200` com `{ id, email, name, role }` do usuário da sessão. (AUTH-09)
10. IF a sessão está ausente, expirada, revogada ou o token é desconhecido THEN a API SHALL responder `401` em toda rota não marcada como pública. (AUTH-10)
11. WHEN uma requisição autenticada usa uma sessão com menos de 29 dias restantes THEN a API SHALL estender `expires_at` para 30 dias a partir de agora e reenviar o cookie. (AUTH-11)
12. WHEN `POST /auth/logout` é chamado THEN a API SHALL revogar a sessão apresentada, se houver, apagar o cookie e responder `204`. (AUTH-12)
13. WHEN um login cria uma sessão THEN a API SHALL apagar as sessões já expiradas desse usuário. (AUTH-13)
14. WHEN uma rota marcada para um papel recebe sessão válida de outro papel THEN a API SHALL responder `403`. (AUTH-14)
15. The API SHALL treat routes as requiring a session unless explicitly marked public, and `GET /health` SHALL remain public. (AUTH-15)
16. The API SHALL take the user identity only from the session and SHALL ignore any `userId` or `invitedBy` sent by the client. (AUTH-16)
17. All Identity errors SHALL be returned as `application/problem+json` following RFC 9457. (AUTH-17)
18. The API and web logs SHALL contain no password, session token, invitation token or `Cookie` header value. (AUTH-18)
19. Every registered API route SHALL declare its access level as public, as a specific role or as any valid session. (AUTH-19)

**Independent Test**: Com um usuário criado direto no banco, exercitar os endpoints via HTTP contra Postgres real, avançando o relógio para expiração e renovação.

---

### P1: Bloqueio por tentativas ⭐ MVP

**User Story**: Como dono dos dados, quero limitar tentativas de login, para que senhas não sejam testadas em volume.

**Why P1**: O login fica exposto à internet e protege dados pessoais reais.

**Acceptance Criteria**:

1. WHILE há 5 falhas do mesmo e-mail + IP nos últimos 15 minutos a API SHALL responder `429` a novas tentativas desse par, mesmo com a senha correta. (LOCK-01)
2. WHILE há 50 falhas do mesmo IP nos últimos 15 minutos a API SHALL responder `429` a novas tentativas desse IP, para qualquer e-mail. (LOCK-02)
3. The `429` response SHALL carry a `Retry-After` header with the seconds until the oldest counted failure leaves the window. (LOCK-03)
4. The lockout SHALL count failures for existing and non-existing e-mails alike and SHALL return the same `429` body for both. (LOCK-04)
5. WHEN a tentativa é respondida com `429` THEN a API SHALL não executar Argon2id e não registrar nova falha. (LOCK-05)
6. WHEN um login é bem-sucedido THEN a API SHALL deixar de contar as falhas daquele e-mail + IP e manter as falhas contadas para o IP. (LOCK-06)
7. WHEN a janela de 15 minutos passa THEN a API SHALL aceitar nova tentativa e apagar as linhas vencidas de `identity.login_attempts` ao registrar a próxima falha. (LOCK-07)
8. The two login entrances SHALL share the same failure counters. (LOCK-08)
9. WHEN o web chama a API em nome de um navegador THEN o web SHALL repassar o IP do cliente, obtido de `CLIENT_IP_HEADER` quando definido, de forma que IPs diferentes contem em separado. (LOCK-09)
10. IF `CLIENT_IP_HEADER` está definido THEN o web SHALL ignorar o valor de `X-Forwarded-For` enviado pelo cliente. (LOCK-10)

**Independent Test**: Enviar tentativas via HTTP com relógio controlado e conferir `429`, `Retry-After` e a liberação ao fim da janela; repetir pelo web com dois IPs.

---

### P1: Convidar e aceitar convite ⭐ MVP

**User Story**: Como admin, quero gerar um link de convite para uma pessoa, para que ela crie a conta sem cadastro aberto.

**Why P1**: É a única forma de entrar um usuário do produto.

**Acceptance Criteria**:

1. WHEN um admin envia `POST /invitations` com um e-mail THEN a API SHALL criar o convite com validade de 7 dias e responder `201` com `{ inviteUrl, expiresAt }`, com `inviteUrl` montado a partir de `WEB_PUBLIC_URL`. (INV-01)
2. IF um member chama `POST /invitations` THEN a API SHALL responder `403` sem criar convite. (INV-02)
3. IF o e-mail convidado já é de um usuário THEN a API SHALL responder `409` sem criar convite. (INV-03)
4. WHEN um admin convida um e-mail com convite pendente THEN a API SHALL revogar o convite anterior e criar o novo. (INV-04)
5. WHEN `GET /invitations/:token` recebe um convite pendente THEN a API SHALL responder `200` com `{ email, expiresAt }`. (INV-05)
6. IF o token é desconhecido ou o convite está expirado, aceito ou revogado THEN `GET /invitations/:token` e `POST /invitations/:token/accept` SHALL responder `410`. (INV-06)
7. WHEN `POST /invitations/:token/accept` recebe nome e senha válidos THEN a API SHALL criar um usuário `member` com o e-mail do convite, marcar `accepted_at`, iniciar sessão e responder `201`, numa única transação. (INV-07)
8. IF a senha do aceite tem menos de 12 ou mais de 128 caracteres, ou o nome está vazio ou passa de 120 caracteres THEN a API SHALL responder `400`, e o convite SHALL continuar pendente. (INV-08)
9. WHEN dois aceites do mesmo token chegam ao mesmo tempo THEN a API SHALL criar um único usuário, e o outro aceite SHALL receber `410`. (INV-09)
10. WHEN uma sessão válida acompanha o aceite THEN a API SHALL revogar essa sessão antes de iniciar a nova. (INV-10)

**Independent Test**: Via HTTP contra Postgres real, com um admin de teste: convidar, abrir, aceitar e repetir o aceite.

---

### P1: Telas de login, convite e home ⭐ MVP

**User Story**: Como usuário, quero as telas de entrada e uma home protegida, para usar o fluxo inteiro pelo navegador.

**Why P1**: Sem elas a feature não é demonstrável de ponta a ponta.

**Acceptance Criteria**:

1. WHEN um member usa "Entrar" em `/login` com credenciais válidas THEN o web SHALL abrir a rota preservada, ou `/`, mostrando o nome do usuário e a ação "Sair". (UI-01)
2. WHEN um admin usa "Entrar" em `/admin/login` com credenciais válidas THEN o web SHALL abrir a rota preservada, ou `/admin`. (UI-02)
3. IF o login responde `401` THEN a tela SHALL mostrar "E-mail ou senha incorretos." e manter o e-mail digitado. (UI-03)
4. IF o login responde `429` THEN a tela SHALL mostrar "Muitas tentativas. Tente novamente em {n} min.", com `{n}` arredondado para cima a partir do `Retry-After`. (UI-04)
5. IF a API não responde durante um login, aceite ou checagem de sessão THEN a tela SHALL mostrar "Serviço indisponível. Tente novamente em instantes." sem redirecionar para o login. (UI-05)
6. WHEN um visitante sem sessão abre `/` THEN o HTML renderizado no servidor SHALL redirecionar para `/login` preservando a rota. (UI-06)
7. WHEN um visitante sem sessão abre uma rota de `/admin/*` THEN o HTML renderizado no servidor SHALL redirecionar para `/admin/login` preservando a rota. (UI-07)
8. WHEN uma ação no navegador recebe `401` THEN o web SHALL abrir o login da área atual, preservando a rota, com a mensagem "Sua sessão expirou. Entre novamente." (UI-08)
9. IF a rota preservada não é um caminho interno que começa com uma única `/` THEN o web SHALL ignorá-la e usar o destino padrão. (UI-09)
10. WHEN um member logado abre uma rota de `/admin/*` THEN o web SHALL mostrar "Você não tem acesso a esta área." com link para `/`, sem dados de admin. (UI-10)
11. WHEN um admin logado abre `/` THEN o web SHALL redirecionar para `/admin`. (UI-11)
12. WHEN um usuário logado abre a tela de login de sua área THEN o web SHALL redirecionar para a home dessa área. (UI-12)
13. WHEN alguém usa "Sair" THEN o web SHALL encerrar a sessão e abrir `/login` para member ou `/admin/login` para admin. (UI-13)
14. WHEN alguém abre `/invite/:token` de um convite pendente THEN a tela SHALL mostrar o e-mail convidado, sem edição, e os campos de nome e senha com a regra de 12 caracteres visível. (UI-14)
15. WHEN alguém usa "Criar conta" com dados válidos em `/invite/:token` THEN o web SHALL abrir `/` já logado. (UI-15)
16. IF `/invite/:token` recebe `410` ao abrir ou ao enviar THEN a tela SHALL mostrar "Este convite não é mais válido. Peça um novo ao administrador." sem formulário. (UI-16)
17. The `/invite/:token` response SHALL carry `Referrer-Policy: no-referrer`. (UI-17)
18. The web responses for authenticated pages and `/invite/:token` SHALL carry `Cache-Control: no-store`. (UI-18)
19. WHEN o navegador envia um POST de outra origem a uma server function THEN o web SHALL recusar a requisição sem chamar a API. (UI-19)
20. WHEN alguém abre `/status` sem sessão THEN o web SHALL entregar a página de status, com o mesmo conteúdo renderizado no servidor de antes. (UI-20)
21. The login, invite and home screens SHALL use `AuthPage` or `DashboardPage` from `packages/ui`, and each new component SHALL have a story in both themes. (UI-21)
22. The screens of this feature SHALL have no axe violations in light and dark themes and no horizontal page scroll at 375 px and 1280 px. (UI-22)
23. WHILE um formulário aguarda resposta a ação de envio SHALL ficar desabilitada, impedindo envio duplicado. (UI-23)
24. The keyboard focus indicator of every `packages/ui` control SHALL have a contrast of at least 3:1 against the page background in the light and dark themes, using a design token and never the text color of the control. (UI-24)
25. WHEN o e-mail de um convite ou o link do convite é mais largo que a linha THEN a tela SHALL quebrar ou conter o texto, manter "Revogar" e "Copiar" visíveis dentro da viewport e não ter rolagem horizontal da página em 375 px e 1280 px. (UI-25)
26. WHEN a lista de convites ganha uma página ou perde um convite THEN o foco SHALL ir para a primeira linha nova ou para a próxima linha, e para o título da lista quando não restar linha, nunca para o `body`. (UI-26)
27. WHEN a tela de serviço indisponível ou a de acesso negado é aberta THEN ela SHALL oferecer "Tentar novamente", que recarrega a rota, na indisponível e "Sair", quando houver sessão, na de acesso negado. (UI-27)
28. WHEN uma linha de convite é mostrada em 375 px THEN o texto SHALL usar a largura toda da linha, sem coluna espremida, com "Revogar" dentro da viewport e sem rolagem horizontal da página. (UI-28)

**Independent Test**: Playwright na stack do compose: criar o admin pelo CLI, convidar pelo navegador, aceitar em outro contexto e sair.

---

### P2: Administrar convites e dashboard do admin

**User Story**: Como admin, quero ver e revogar convites pendentes num dashboard próprio, para controlar quem ainda pode entrar.

**Why P2**: O convite funciona sem a lista, mas a lista é a forma de cancelar um link enviado por engano.

**Acceptance Criteria**:

1. WHEN um admin chama `GET /invitations` THEN a API SHALL responder `200` com `{ items, nextCursor, totalPending }`, só com convites pendentes não expirados, do mais recente ao mais antigo. (ADM-01)
2. WHEN um admin chama `DELETE /invitations/:id` em convite pendente THEN a API SHALL marcar `revoked_at` e responder `204`. (ADM-02)
3. IF o convite de `DELETE /invitations/:id` não existe ou não está pendente THEN a API SHALL responder `404`. (ADM-03)
4. IF um member chama `GET /invitations` ou `DELETE /invitations/:id` THEN a API SHALL responder `403`. (ADM-04)
5. The API SHALL never return an invitation token or its hash in `GET /invitations`. (ADM-05)
6. WHEN um admin usa "Convidar" em `/admin/invitations` com e-mail válido THEN a tela SHALL mostrar o link com a ação "Copiar", avisar que ele só aparece esta vez e incluir o e-mail na lista. (ADM-06)
7. WHEN o admin usa "Copiar" THEN a tela SHALL copiar o link para a área de transferência e mostrar "Copiado". (ADM-07)
8. IF a cópia falha THEN a tela SHALL manter o link visível e selecionável, com a mensagem "Não foi possível copiar. Selecione o link." (ADM-08)
9. IF o e-mail convidado já é de um usuário THEN a tela SHALL mostrar "Este e-mail já tem uma conta." e manter o valor digitado. (ADM-09)
10. WHEN o admin usa "Revogar" numa linha THEN a tela SHALL pedir confirmação com o e-mail do convite, sem revogar até a confirmação. (ADM-10)
11. WHEN o admin confirma a revogação THEN a tela SHALL remover o convite da lista e atualizar o total. (ADM-11)
12. WHILE não há convites pendentes a tela SHALL mostrar "Nenhum convite pendente." e o formulário de convite. (ADM-12)
13. WHEN há mais convites que a primeira página THEN a tela SHALL oferecer "Carregar mais", usando `nextCursor`. (ADM-13)
14. WHEN um admin abre `/admin` THEN o dashboard SHALL mostrar o painel de status do sistema, o total de convites pendentes e um link para `/admin/invitations`. (ADM-14)
15. The `/admin` screen SHALL use `DashboardPage` and `/admin/invitations` SHALL use `ListPage`. (ADM-15)

**Independent Test**: Com um admin logado, convidar dois e-mails, revogar um e conferir lista, total e `410` no link revogado.

---

## Edge Cases

- IF o e-mail do login ou do convite vem com maiúsculas ou espaços nas pontas THEN o sistema SHALL normalizar para minúsculas sem espaços antes de comparar ou gravar. (EDGE-01)
- IF o corpo de um endpoint de Identity é inválido THEN a API SHALL responder `400` em Problem Details, sem ecoar a senha. (EDGE-02)
- IF a senha enviada ao login passa de 128 caracteres THEN a API SHALL responder o mesmo `401`, contar a falha e não executar Argon2id. (EDGE-03)
- IF `WEB_PUBLIC_URL` está ausente THEN a API SHALL recusar a inicialização com mensagem que nomeia a variável. (EDGE-04)
- IF o usuário foi criado entre o convite e o aceite THEN o aceite SHALL responder `410` sem alterar o usuário existente. (EDGE-05)
- WHEN `compose` verifica a saúde do `web` THEN o healthcheck SHALL consultar `/status`, para que uma API fora do ar não derrube o `web`. (EDGE-06)
- The `identity` schema SHALL hold `users`, `sessions`, `invitations` and `login_attempts`, with UUID v7 keys generated by Postgres and no foreign key to another schema. (EDGE-07)
- The module boundary rules SHALL block importing `identity` internals from another module, and other modules SHALL reach the guard through its public API. (EDGE-08)

## Implicit-Requirement Sweep

| Dimension                                | Coverage                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Input validation & bounds                | INV-08, CLI-05, EDGE-01, EDGE-02, EDGE-03                             |
| Failure / partial-failure states         | INV-07 (transação), UI-05, EDGE-04                                    |
| Idempotency / retry / duplicate handling | AUTH-12, INV-04, INV-09, UI-23                                        |
| Auth boundaries & rate limits            | AUTH-03, AUTH-10, AUTH-14, AUTH-15, INV-02, ADM-04, LOCK-01 a LOCK-10 |
| Concurrency / ordering                   | INV-09, EDGE-05                                                       |
| Data lifecycle / expiry                  | AUTH-11, AUTH-13, LOCK-07, INV-06                                     |
| Observability                            | AUTH-18; logs e request id já existem no skeleton                     |
| External-dependency failure              | UI-05; a stack só depende de Postgres e da API                        |
| State-transition integrity               | INV-04, INV-06, INV-07, ADM-02, ADM-03                                |

---

## Proof Map

Os estados do `.design` e o teste que prova cada um. O comando exato de cada check fica em `tasks.md`.

| Estado                                                              | Requisitos                         | Prova                                                                                                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login válido `204` e flags do cookie                                | AUTH-01, AUTH-02, AUTH-07, AUTH-08 | Integração HTTP com Postgres real: lê o `Set-Cookie` e confere a sessão no banco                                                                                             |
| `401` igual para usuário inexistente, senha errada e entrada errada | AUTH-03, AUTH-04                   | Integração compara status, headers de conteúdo e corpo byte a byte; unit prova que o verificador roda uma vez nos dois casos, sem depender de medir tempo                    |
| `429` e liberação                                                   | LOCK-01 a LOCK-08                  | Integração com relógio controlado, nos dois limites, conferindo que a senha correta também é recusada                                                                        |
| IP real pelo BFF                                                    | LOCK-09, LOCK-10                   | E2E na stack do compose com headers de IP diferentes                                                                                                                         |
| Expiração, revogação e renovação                                    | AUTH-10, AUTH-11, AUTH-12          | Integração com relógio controlado em cada caso; E2E volta ao login preservando a rota                                                                                        |
| `403` para não admin                                                | INV-02, ADM-04, AUTH-14, UI-10     | Integração nos endpoints; E2E na tela                                                                                                                                        |
| Convite `201`, aceite `201`, duplo aceite                           | INV-01, INV-07, INV-09             | Integração, incluindo aceites simultâneos contra Postgres real                                                                                                               |
| `410` expirado, usado, revogado e desconhecido                      | INV-06, UI-16                      | Integração nos quatro casos, nos dois endpoints; E2E na tela                                                                                                                 |
| Logout `204`                                                        | AUTH-12, UI-13                     | Integração reutiliza o cookie antigo e recebe `401`; E2E usa "Sair"                                                                                                          |
| Toda rota declara o acesso                                          | AUTH-19                            | Teste de arquitetura percorre as rotas registradas na aplicação real e falha com uma rota de fixture sem declaração, com mensagem que nomeia a rota e as declarações aceitas |
| Segredos fora dos logs                                              | AUTH-18                            | Integração lê as linhas JSON do pino depois de login e aceite e busca o token, a senha e o cookie                                                                            |
| Jornada completa                                                    | Goals                              | E2E: CLI, login de admin, convite, aceite, home e saída, com axe nos dois temas                                                                                              |
| CLI                                                                 | CLI-01 a CLI-06                    | Integração roda o entrypoint real com Postgres real                                                                                                                          |
| Componentes                                                         | UI-21, ADM-15                      | Testes e stories em `packages/ui`; a regra de fronteiras cobre o resto                                                                                                       |
| Foco visível                                                        | UI-24                              | Story em `packages/ui` lê a cor do foco de cada intent nos dois temas e calcula o contraste contra o fundo                                                                   |
| Texto longo em 375 px                                               | UI-25                              | Story do `CopyField` com valor longo; E2E com e-mail de mais de 100 caracteres em 375 e 1280 px, nos dois temas                                                              |
| Foco da lista                                                       | UI-26                              | Teste do `InvitationsPanel` confere o elemento focado depois de Carregar mais e de Revogar                                                                                   |
| Saída das telas de erro                                             | UI-27                              | Testes de `UnavailableScreen` e `NoAccessScreen`                                                                                                                             |
| Linha de convite em 375 px                                          | UI-28                              | Story `ListPage` com `Row` em 375 px mede a largura do texto, o botão e a rolagem                                                                                            |

---

## Requirement Traceability

| Requirement ID | Story                    | Phase  | Status  |
| -------------- | ------------------------ | ------ | ------- |
| CLI-01         | P1: CLI                  | Design | Pending |
| CLI-02         | P1: CLI                  | Design | Pending |
| CLI-03         | P1: CLI                  | Design | Pending |
| CLI-04         | P1: CLI                  | Design | Pending |
| CLI-05         | P1: CLI                  | Design | Pending |
| CLI-06         | P1: CLI                  | Design | Pending |
| CLI-07         | P1: CLI                  | Design | Pending |
| AUTH-01        | P1: Login e sessão       | Design | Pending |
| AUTH-02        | P1: Login e sessão       | Design | Pending |
| AUTH-03        | P1: Login e sessão       | Design | Pending |
| AUTH-04        | P1: Login e sessão       | Design | Pending |
| AUTH-05        | P1: Login e sessão       | Design | Pending |
| AUTH-06        | P1: Login e sessão       | Design | Pending |
| AUTH-07        | P1: Login e sessão       | Design | Pending |
| AUTH-08        | P1: Login e sessão       | Design | Pending |
| AUTH-09        | P1: Login e sessão       | Design | Pending |
| AUTH-10        | P1: Login e sessão       | Design | Pending |
| AUTH-11        | P1: Login e sessão       | Design | Pending |
| AUTH-12        | P1: Login e sessão       | Design | Pending |
| AUTH-13        | P1: Login e sessão       | Design | Pending |
| AUTH-14        | P1: Login e sessão       | Design | Pending |
| AUTH-15        | P1: Login e sessão       | Design | Pending |
| AUTH-16        | P1: Login e sessão       | Design | Pending |
| AUTH-17        | P1: Login e sessão       | Design | Pending |
| AUTH-18        | P1: Login e sessão       | Design | Pending |
| AUTH-19        | P1: Login e sessão       | Design | Pending |
| LOCK-01        | P1: Bloqueio             | Design | Pending |
| LOCK-02        | P1: Bloqueio             | Design | Pending |
| LOCK-03        | P1: Bloqueio             | Design | Pending |
| LOCK-04        | P1: Bloqueio             | Design | Pending |
| LOCK-05        | P1: Bloqueio             | Design | Pending |
| LOCK-06        | P1: Bloqueio             | Design | Pending |
| LOCK-07        | P1: Bloqueio             | Design | Pending |
| LOCK-08        | P1: Bloqueio             | Design | Pending |
| LOCK-09        | P1: Bloqueio             | Design | Pending |
| LOCK-10        | P1: Bloqueio             | Design | Pending |
| INV-01         | P1: Convite              | Design | Pending |
| INV-02         | P1: Convite              | Design | Pending |
| INV-03         | P1: Convite              | Design | Pending |
| INV-04         | P1: Convite              | Design | Pending |
| INV-05         | P1: Convite              | Design | Pending |
| INV-06         | P1: Convite              | Design | Pending |
| INV-07         | P1: Convite              | Design | Pending |
| INV-08         | P1: Convite              | Design | Pending |
| INV-09         | P1: Convite              | Design | Pending |
| INV-10         | P1: Convite              | Design | Pending |
| UI-01          | P1: Telas                | Design | Pending |
| UI-02          | P1: Telas                | Design | Pending |
| UI-03          | P1: Telas                | Design | Pending |
| UI-04          | P1: Telas                | Design | Pending |
| UI-05          | P1: Telas                | Design | Pending |
| UI-06          | P1: Telas                | Design | Pending |
| UI-07          | P1: Telas                | Design | Pending |
| UI-08          | P1: Telas                | Design | Pending |
| UI-09          | P1: Telas                | Design | Pending |
| UI-10          | P1: Telas                | Design | Pending |
| UI-11          | P1: Telas                | Design | Pending |
| UI-12          | P1: Telas                | Design | Pending |
| UI-13          | P1: Telas                | Design | Pending |
| UI-14          | P1: Telas                | Design | Pending |
| UI-15          | P1: Telas                | Design | Pending |
| UI-16          | P1: Telas                | Design | Pending |
| UI-17          | P1: Telas                | Design | Pending |
| UI-18          | P1: Telas                | Design | Pending |
| UI-19          | P1: Telas                | Design | Pending |
| UI-20          | P1: Telas                | Design | Pending |
| UI-21          | P1: Telas                | Design | Pending |
| UI-22          | P1: Telas                | Design | Pending |
| UI-23          | P1: Telas                | Design | Pending |
| UI-24          | P1: Telas                | Design | Pending |
| UI-25          | P1: Telas                | Design | Pending |
| UI-26          | P1: Telas                | Design | Pending |
| UI-27          | P1: Telas                | Design | Pending |
| UI-28          | P1: Telas                | Design | Pending |
| ADM-01         | P2: Administrar convites | Design | Pending |
| ADM-02         | P2: Administrar convites | Design | Pending |
| ADM-03         | P2: Administrar convites | Design | Pending |
| ADM-04         | P2: Administrar convites | Design | Pending |
| ADM-05         | P2: Administrar convites | Design | Pending |
| ADM-06         | P2: Administrar convites | Design | Pending |
| ADM-07         | P2: Administrar convites | Design | Pending |
| ADM-08         | P2: Administrar convites | Design | Pending |
| ADM-09         | P2: Administrar convites | Design | Pending |
| ADM-10         | P2: Administrar convites | Design | Pending |
| ADM-11         | P2: Administrar convites | Design | Pending |
| ADM-12         | P2: Administrar convites | Design | Pending |
| ADM-13         | P2: Administrar convites | Design | Pending |
| ADM-14         | P2: Administrar convites | Design | Pending |
| ADM-15         | P2: Administrar convites | Design | Pending |
| EDGE-01        | Edge Cases               | Design | Pending |
| EDGE-02        | Edge Cases               | Design | Pending |
| EDGE-03        | Edge Cases               | Design | Pending |
| EDGE-04        | Edge Cases               | Design | Pending |
| EDGE-05        | Edge Cases               | Design | Pending |
| EDGE-06        | Edge Cases               | Design | Pending |
| EDGE-07        | Edge Cases               | Design | Pending |
| EDGE-08        | Edge Cases               | Design | Pending |

**Coverage:** 94 total, 0 mapped to tasks, 94 unmapped até a fase de Tasks.

---

## Differences from the source

O `.design` não é captura de tela; as linhas abaixo registram onde esta spec muda o que ele define.

| Source shows                                                             | Product shows                                                                   | Confirmed                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------- |
| Key decision 3: cookie compartilhado pelos subdomínios do front e da API | Cookie host-only no web, API sem domínio público                                | y - AD-004                        |
| Admin e member usam a mesma entrada; admin é só um papel                 | Duas entradas e contas separadas; admin não usa o produto                       | y - AD-005                        |
| `POST /auth/login` para todos                                            | `POST /auth/login` para member e `POST /auth/admin/login` para admin            | y - AD-005                        |
| Sem listagem nem revogação de convites                                   | `GET /invitations`, `DELETE /invitations/:id` e coluna `invitations.revoked_at` | y - usuário: "Formulário + lista" |
| Convite validado só no aceite                                            | `GET /invitations/:token`                                                       | y - usuário: "Ao abrir o link"    |
| Tabelas `users`, `sessions`, `invitations`                               | Também `identity.login_attempts`                                                | y - usuário: "Aprovo a spec"      |
| Quatro arquétipos                                                        | Quinto arquétipo `AuthPage`                                                     | y - usuário: "AuthPage novo"      |
| "Mesmo comando" para criar admin e trocar senha                          | Mesmo CLI com dois subcomandos                                                  | y - usuário: "Dois subcomandos"   |

## Sources

- [.design/application-manager.md](../../../.design/application-manager.md) - Key decisions e fatia Identity: estados, contratos, tabelas
- [docs/engineering-guidelines.md](../../../docs/engineering-guidelines.md) - BFF, fronteiras, testes, portabilidade
- [docs/design/principles.md](../../../docs/design/principles.md) - arquétipos e proibições de UI
- [context.md](context.md) - respostas do usuário nesta feature
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - parâmetros do Argon2id

---

## Success Criteria

- [ ] A jornada CLI → login de admin → convite → aceite → home → saída passa em E2E com as imagens de produção.
- [ ] Nenhum endpoint fora de `/health`, dos logins e dos dois endpoints públicos de convite responde sem sessão.
- [ ] Busca nos logs de um E2E completo não encontra senha, token nem cookie.
