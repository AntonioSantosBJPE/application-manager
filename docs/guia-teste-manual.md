# Guia de teste manual

Roteiro curto para ver o estado atual do projeto funcionando: a página de status e as features `identity` (login, convites, sessão, bloqueio) e `skills` (catálogo, privadas, promoção, apelidos). Leva uns 15 minutos. Todos os dados são fictícios.

## Estado atual

- **Pronto:** esqueleto (web + api + banco + status), `identity` (CLI de admin, login por e-mail e senha, sessão por cookie, convites — criar, copiar, revogar, aceitar —, áreas de admin e de membro, bloqueio por tentativas) e a identidade visual Rumo Carreira (marca, ícones, telas no padrão do design system).
- **Também pronto:** o catálogo de skills com seed de skills globais, skills privadas por pessoa, promoção e apelidos pelo admin (seção 8).
- **Ainda não existe:** vagas, currículos, análise de skills (próximas fases do [roadmap](roadmap.md)). A home do membro (`/`) mostra só o título "Início", a saudação e os três passos até a primeira candidatura; ainda não há dados de candidaturas.

## 1. Subir a stack

Pré-requisitos: Node 24, pnpm via corepack e Docker (ver o [README](../README.md)).

```bash
corepack enable
pnpm install
cp .env.example .env     # já vem com SESSION_COOKIE_SECURE=false para http local
docker compose up --build -d
docker compose ps        # postgres, api e web "healthy"/"running"; migrate "exited (0)"
```

Abra `http://localhost:3000/status`: a aba mostra "Rumo Carreira" e a página traz a marca, o título "Status", o veredito "Todos os sistemas operacionais", a linha "Verificado às {hora} de {data}." e as linhas **API** e **Banco de dados** com o selo "Operacional".

Os ícones vêm de `apps/web/public`: `http://localhost:3000/favicon.svg` (o favicon, que acompanha o tema do sistema) e `http://localhost:3000/app-icon.png` (o ícone de app, um PNG de 180×180).

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

Em todas as telas, espere a página terminar de carregar antes de digitar: o formulário só reage depois da hidratação (~1 s).

1. Sem sessão, abra `http://localhost:3000/` → vai para `/login` (a rota pedida fica guardada). A tela mostra a marca, o título "Entrar", a linha "Rumo Carreira — suas candidaturas e currículos", os campos "E-mail" e "Senha", o botão "Entrar" e o rodapé "O acesso é por convite. Esqueceu a senha? Fale com quem te convidou.".
2. Abra `http://localhost:3000/admin/invitations` → vai para `/admin/login`, com a mesma tela e o título "Administração".
3. No campo "Senha", digite algo e use o botão **Mostrar senha** (ícone de olho, à direita do campo): o texto aparece e o botão passa a `aria-pressed="true"`; usar de novo volta aos pontos. O rótulo do botão é sempre "Mostrar senha", nos dois estados, e o que foi digitado continua no campo.
4. Em `/admin/login`, entre com `admin@example.com` e senha errada → alerta "E-mail ou senha incorretos." acima dos campos (o e-mail continua no campo).
5. Entre com a senha certa → abre `/admin`, que começa com a topbar "Painel" e o título "Administração", com o widget "Status do sistema" (selo "Operacional", linhas "API" e "Banco de dados" e a hora da checagem) e o widget "Convites pendentes" (a contagem, "Ver convites" e "Convidar pessoa"). A barra lateral mostra a marca com a tag "admin", os itens "Painel", "Convites" e "Status do sistema", e embaixo as iniciais "AA" (primeira letra do primeiro e do último nome de "Ana Admin"), o nome e o botão **Sair**.
6. Com o admin logado, `/` redireciona para `/admin`.

## 4. Convites

1. Em `/admin/invitations` (cabeçalho "Convites" com a contagem "{n} pendentes"), preencha "E-mail a convidar" com `maria@example.com` e clique em **Convidar** → aparece a faixa "Convite criado para maria@example.com", com a nota "este link só aparece desta vez. Copie-o agora." e o link do convite. **Copiar** muda para "Copiado".
2. Convide o mesmo e-mail de novo ou o do admin → "Este e-mail já tem uma conta." (conta existente).
3. Crie uma segunda invitation e clique em **Revogar** na linha (grupo "Pendentes", com o e-mail e "expira em {n} d") → abre a confirmação "Revogar convite" com "O link enviado para {e-mail} deixa de funcionar."; `Esc` ou **Cancelar** fecha, **Revogar** remove a linha e baixa o total. O foco do teclado não se perde.
4. Sem convites pendentes, a lista mostra "Nenhum convite pendente." e o botão "Convidar pessoa", que leva o foco ao campo de e-mail.
5. Teste a lista longa e o "Carregar mais" (opcional): crie mais de 20 convites pela interface.

## 5. Aceitar o convite (outro perfil)

Use uma janela anônima (cookies separados) e cole o link copiado.

1. `/invite/<token>` mostra a marca, o título "Criar conta", a linha "Você recebeu um convite para o Rumo Carreira.", o e-mail só leitura, "Nome" e "Senha" (com o botão **Mostrar senha**), a dica "Use de 12 a 128 caracteres." e o rodapé "O convite vale até {data}.". Senha curta → ao enviar, "A senha precisa ter de 12 a 128 caracteres." sob o campo (a dica continua); nome com mais de 120 caracteres → "Informe seu nome, com até 120 caracteres.".
2. "Criar conta" → abre `/` como membro, que começa com a topbar "Início", com o título "Início", a saudação "Olá, Maria Membro", a linha "Três passos para a primeira candidatura com currículo adaptado." e três cartões: "01 Conta criada" (concluído), "02 Preencha o currículo mestre" e "03 Cadastre uma vaga" (a fazer), seguidos de "Quando houver candidaturas, aqui aparecem o pipeline, o que precisa de atenção e a atividade recente.". A barra lateral mostra a marca, o item "Início" como atual, e embaixo as iniciais "MM" (de "Maria Membro"), o nome e o botão **Sair**. Um nome do meio não entra nas iniciais ("Maria Souza Membro" também dá "MM") e um nome só usa as duas primeiras letras ("Maria" dá "MA").
3. Reabra o mesmo link → tela "Convite inválido": "Este convite expirou ou já foi usado. Peça um novo link a quem te convidou." (sem formulário).
4. Como membro, abra `/admin` → tela "Sem acesso": "Esta área é da administração. Sua conta é de uso do produto.", com o botão "Voltar para o início" e **Sair**.
5. **Sair** encerra a sessão e volta ao login.

## 6. Sessão expirada e bloqueio

- **Expirada:** com o admin logado, deixe `/admin/invitations` aberta, expire a sessão **depois** de a página carregar e só então use a tela.

  ```bash
  docker compose exec postgres psql -U app -d app \
    -c "update identity.sessions set expires_at = now() - interval '1 second';"
  ```

  Volte à página aberta, digite um e-mail e clique em "Convidar" → em cerca de 1 s abre `/admin/login?...&reason=expired` com o aviso "Sua sessão expirou. Entre de novo para continuar."; depois de entrar, volta para `/admin/invitations`.
- **Bloqueio:** em `/login`, erre a senha do mesmo e-mail 6 vezes → na sexta aparece "Muitas tentativas. Tente novamente em 15 min.".
  Para tirar o bloqueio no teste: `docker compose exec postgres psql -U app -d app -c "truncate identity.login_attempts;"`.

## 7. Falhas da API

```bash
docker compose stop api
```

- `/login` abre o formulário; ao enviar, mostra "Serviço indisponível. Tente novamente em instantes." sem redirecionar.
- `/status` continua abrindo, com o veredito "Serviço degradado" e API e Banco de dados "Indisponível" (os componentes afetados vão para o topo, em vermelho).
- `/` e `/admin` mostram a tela "Indisponível": "O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.", com o botão **Tentar novamente**, e a URL pedida continua a mesma.

`docker compose start api` volta ao normal.

## 8. Catálogo de skills

O membro ainda não tem tela de skills: as privadas nascem por chamada direta à API, que a stack publica em `127.0.0.1:3333` (ou na porta de `API_PORT`). Use um membro e um admin fictícios (seções 2 a 5).

1. Entre como membro no navegador e copie o nome e o valor do cookie de sessão, aquele cujo nome termina em `am_session` (ferramentas do navegador, aba de armazenamento). É a credencial da sessão: não a cole em lugar nenhum além do terminal.
2. Crie uma privada: `curl -i -X POST http://127.0.0.1:3333/skills -H "Cookie: <nome>=<valor>" -H "Content-Type: application/json" -d '{"name":"Skill Fictícia Alfa","category":"tool"}'` → `201` com `scope: "private"`. Repetir o mesmo nome devolve `200` com o mesmo id.
3. Busque com outro membro: `curl "http://127.0.0.1:3333/skills?q=Alfa" -H "Cookie: <nome>=<valor do outro membro>"` → a privada não aparece.
4. Como admin, abra `/admin/skills`: o título mostra o total do catálogo e o chip "Privadas" conta as privadas. Filtre por "Privadas": a linha tem o selo "Privada" e o botão **Promover**. O painel `/admin` também lista as privadas no widget "Skills privadas aguardando promoção".
5. Clique em **Promover** e confirme: a linha perde o selo e ganha o menu "⋯". Repita a busca do passo 3: a skill agora aparece, com o mesmo id e `scope: "global"`.
6. No menu "⋯" escolha **Editar** (nome e categoria) e **Apelidos** (cadastrar, editar e remover). O botão **Apelido** da barra superior cadastra um apelido escolhendo a skill numa lista. A busca do membro passa a achar a skill pelo apelido e deixa de achar pelo apelido removido.
7. Para ver o erro de promoção, crie a mesma privada com duas contas, promova uma e tente promover a outra: aparece o aviso "Já existe uma skill global com esse nome ou apelido. A fusão é manual."
8. Só com o teclado: `Tab` até o "⋯", `Enter` abre, as setas movem entre "Editar" e "Apelidos", `Enter` escolhe; o foco fica preso no diálogo e `Esc` o fecha, devolvendo o foco ao "⋯".

## 9. Tema, largura e teclado

- Alterne o tema do sistema (claro/escuro): as telas e o favicon acompanham.
- Estreite a janela para 375 px: nada rola na horizontal; e-mails e links longos quebram dentro da página, e a barra lateral vira uma barra no topo.
- Navegue só com `Tab`: o botão em foco tem um anel visível. Em `/login`, o botão **Mostrar senha** é o próximo foco depois do campo "Senha" e funciona com `Enter` e `Espaço`.

## 10. Rodar os testes

| Comando | Tempo | O que cobre |
|---|---|---|
| `pnpm lint && pnpm typecheck` | segundos (com cache) | estilo, fronteiras, tipos |
| `pnpm test` | ~10 s com cache | unitários, componentes e stories em Chromium |
| `pnpm test:integration` | ~40 s | API contra PostgreSQL (precisa de Docker) |
| `pnpm test:e2e` | ~2 a 3 min | stack real do compose + navegador (fora do CI por enquanto) |
| `pnpm test:repo-rules` | ~1 min | regras do repositório com violações plantadas |

No CI de cada PR rodam lint, tipos, `pnpm test`, integração, `test:repo-rules` e o scan de segredos.

## 11. Encerrar

```bash
docker compose down -v   # apaga também o volume do banco
```
