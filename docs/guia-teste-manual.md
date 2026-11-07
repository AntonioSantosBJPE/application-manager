# Guia de teste manual

Roteiro curto para ver o estado atual do projeto funcionando: a página de status e a feature `identity` (login, convites, sessão, bloqueio). Leva uns 15 minutos. Todos os dados são fictícios.

## Estado atual

- **Pronto:** esqueleto (web + api + banco + status) e `identity`: CLI de admin, login por e-mail e senha, sessão por cookie, convites (criar, copiar, revogar, aceitar), áreas de admin e de membro, bloqueio por tentativas.
- **Ainda não existe:** vagas, currículos, análise de skills (próximas fases do [roadmap](roadmap.md)). A home do membro (`/`) é só o título "Início".

## 1. Subir a stack

Pré-requisitos: Node 24, pnpm via corepack e Docker (ver o [README](../README.md)).

```bash
corepack enable
pnpm install
cp .env.example .env     # já vem com SESSION_COOKIE_SECURE=false para http local
docker compose up --build -d
docker compose ps        # postgres, api e web "healthy"/"running"; migrate "exited (0)"
```

Abra `http://localhost:3000/status`: devem aparecer **API** e **Banco de dados** como "Operacional".

## 2. Criar o administrador (CLI)

Não existe tela de cadastro: o primeiro admin nasce pela CLI.

```bash
printf 'senha-de-teste-123' | docker compose run --rm --no-deps -T api \
  node dist/cli.js create-admin --email admin@example.com --name "Ana Admin" --password-stdin
```

Esperado: confirmação de criação. Variações para conferir:
- senha com menos de 12 caracteres → recusada (exit 2);
- repetir o mesmo e-mail → recusado;
- `--password` na linha de comando → recusado (a senha não pode ir no histórico do shell).

Redefinir a senha (e derrubar as sessões abertas): `node dist/cli.js reset-password --email admin@example.com --password-stdin`, no mesmo formato.

## 3. Login e proteção de rotas

1. Sem sessão, abra `http://localhost:3000/` → vai para `/login` (a rota pedida fica guardada).
2. Abra `http://localhost:3000/admin/invitations` → vai para `/admin/login`.
3. Em `/admin/login`, entre com `admin@example.com` e senha errada → "E-mail ou senha incorretos." (o e-mail continua no campo).
4. Entre com a senha certa → abre `/admin`, com API e Banco "Operacional" e "Convites pendentes".
5. Com o admin logado, `/` redireciona para `/admin`.

## 4. Convites

1. Em `/admin/invitations`, convide `maria@example.com` → aparece o aviso "Este link só aparece desta vez" e o link. **Copiar** muda para "Copiado".
2. Convide o mesmo e-mail de novo ou o do admin → "Este e-mail já tem uma conta." (conta existente).
3. Crie uma segunda invitation e clique em **Revogar** → abre a confirmação com o e-mail; `Esc` cancela, confirmar remove a linha e baixa o total. O foco do teclado não se perde.
4. Teste a lista longa e o "Carregar mais" (opcional): crie mais de 20 convites pela interface.

## 5. Aceitar o convite (outro perfil)

Use uma janela anônima (cookies separados) e cole o link copiado.

1. `/invite/<token>` mostra o e-mail só leitura, nome e senha. Senha curta → "Use de 12 a 128 caracteres."; nome com mais de 128 caracteres → erro no campo.
2. "Criar conta" → abre `/` como membro: "Maria Membro" e **Sair**.
3. Reabra o mesmo link → "Este convite não é mais válido. Peça um novo ao administrador." (sem formulário).
4. Como membro, abra `/admin` → "Você não tem acesso a esta área.", com "Voltar para o início" e **Sair**.
5. **Sair** encerra a sessão e volta ao login.

## 6. Sessão expirada e bloqueio

- **Expirada:** com o admin logado, force a expiração e tente uma ação.

  ```bash
  docker compose exec postgres psql -U app -d app \
    -c "update identity.sessions set expires_at = now() - interval '1 second';"
  ```

  Clique em "Convidar" → vai para `/admin/login` com "Sua sessão expirou. Entre novamente."; depois de entrar, volta à rota anterior.
- **Bloqueio:** em `/login`, erre a senha do mesmo e-mail 6 vezes → na sexta aparece "Muitas tentativas. Tente novamente em 15 min.".
  Para tirar o bloqueio no teste: `docker compose exec postgres psql -U app -d app -c "truncate identity.login_attempts;"`.

## 7. Falhas da API

```bash
docker compose stop api
```

- `/login` mostra "Serviço indisponível. Tente novamente em instantes." sem redirecionar.
- `/status` continua abrindo, com API e Banco "Indisponível".
- Telas protegidas mostram o aviso com **Tentar novamente**.

`docker compose start api` volta ao normal.

## 8. Tema, largura e teclado

- Alterne o tema do sistema (claro/escuro): as telas acompanham.
- Estreite a janela para 375 px: nada rola na horizontal; e-mails e links longos quebram dentro da página.
- Navegue só com `Tab`: o botão em foco tem um anel visível.

## 9. Rodar os testes

| Comando | Tempo | O que cobre |
|---|---|---|
| `pnpm lint && pnpm typecheck` | segundos (com cache) | estilo, fronteiras, tipos |
| `pnpm test` | ~10 s com cache | unitários, componentes e stories em Chromium |
| `pnpm test:integration` | ~40 s | API contra PostgreSQL (precisa de Docker) |
| `pnpm test:e2e` | ~2 a 3 min | stack real do compose + navegador (fora do CI por enquanto) |
| `pnpm test:repo-rules` | ~1 min | regras do repositório com violações plantadas |

No CI de cada PR rodam lint, tipos, `pnpm test`, integração, `test:repo-rules` e o scan de segredos.

## 10. Encerrar

```bash
docker compose down -v   # apaga também o volume do banco
```
