# Identity Context

**Gathered:** 2026-11-03
**Spec:** `.specs/features/identity/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Acesso por convite com sessão no servidor (fatia Identity de `.design/application-manager.md`): login, logout, sessão, convites, papéis e comando de linha de comando para admin e troca de senha, com as telas do front.

---

## Implementation Decisions

### Comando de linha de comando

- Mesmo CLI com dois subcomandos: `create-admin --email --name` falha se o e-mail existe; `reset-password --email` falha se não existe. Resposta do usuário: "Dois subcomandos".
- Senha por prompt oculto ou `--password-stdin`, nunca em argv.
- `reset-password` vale para qualquer papel e revoga todas as sessões do usuário.

### Regra de senha

- Mínimo de 12 e máximo de 128 caracteres, sem regra de composição. Resposta do usuário: "Mínimo 12 caracteres".

### Bloqueio de login

- 5 falhas por e-mail + IP em 15 min e 50 falhas por IP em 15 min; bloqueia até a janela fechar. Resposta do usuário: "E-mail + IP e teto por IP".

### Área de admin

- O front tem fluxo de login e dashboard específicos do admin. Resposta do usuário: "Se vamos ter um sistema de admin, estruturar o frontend para ter um fluxo de login / dashboard especifico para o fluxo do admin, mesmo que seja simples , mas pensando no futuro, caso vire um curriculo / sass será necessario."
- A pergunta de arquétipos foi refeita a pedido do usuário: "refaça a pergunta baseado na resposta, de ter uma dashboar minima para o admin e um fluxo de login so dele".

### Tela de convites

- Formulário e lista de convites pendentes, com ação de revogar. Resposta do usuário: "Formulário + lista". Acrescenta endpoints de listar e revogar ao contrato do `.design`.

### Tela de aceitar convite

- Valida o link ao abrir, com `GET /invitations/:token` devolvendo `{ email, expiresAt }` ou `410`. Resposta do usuário: "Ao abrir o link". Acrescenta um endpoint ao contrato do `.design`.

### Porta da Key decision 3

- BFF no Start (AD-004). Resposta do usuário depois da comparação: "BFF no Start".

### Contas de admin

- Contas separadas (AD-005). Resposta do usuário: "Contas separadas".

### Página de status

- Vai para `/status`, pública, e o dashboard do admin reaproveita o painel. Resposta do usuário: "/status público + widget".

### Arquétipos

- `AuthPage` novo em `/login`, `/admin/login` e `/invite/:token`, registrado em `docs/design/principles.md`. Resposta do usuário: "AuthPage novo".

### Registro da regra de acesso

- A regra fica em AD-006, na documentação do guard no código, em `docs/engineering-guidelines.md` e na mensagem de erro do teste de `AUTH-19`. Pedido do usuário: "nao seria importante, deixar salva em algum lugar do backend essa decisao do guard do backend?"
- As tasks atualizam `docs/engineering-guidelines.md`, além do `.design` e de `docs/design/principles.md`.

---

## Specific References

Sem referência visual; vale `docs/design/principles.md`.

---

## Deferred Ideas

- Produto como SaaS: citado pelo usuário como motivo da área de admin; cadastro aberto continua no roadmap.
