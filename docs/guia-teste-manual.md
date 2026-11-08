# Guia de teste manual

Roteiro curto para ver o estado atual do projeto funcionando: a página de status e as features `identity` (login, convites, sessão, bloqueio), `skills` (catálogo, privadas, promoção, apelidos) e `application` (candidaturas). Leva uns 15 minutos. Todos os dados são fictícios.

## Estado atual

- **Pronto:** esqueleto (web + api + banco + status), `identity` (CLI de admin, login por e-mail e senha, sessão por cookie, convites — criar, copiar, revogar, aceitar —, áreas de admin e de membro, bloqueio por tentativas) e a identidade visual Rumo Carreira (marca, ícones, telas no padrão do design system).
- **Também pronto:** o catálogo de skills com seed de skills globais, skills privadas por pessoa, promoção e apelidos pelo admin (seção 8).
- **Também pronto:** candidaturas — cadastro de vaga com skills e nível, lista por status, detalhe com linha do tempo e a sugestão de "sem retorno" (seção 9).
- **Ainda não existe:** currículo mestre, versões adaptadas e PDF, análise de skills (próximas fases do [roadmap](roadmap.md)). Os passos 01 e 02 da home (conta e currículo mestre) seguem sem tela própria.

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
2. "Criar conta" → abre `/` como membro, que começa com a topbar "Início", com o título "Início", a saudação "Olá, Maria Membro", a linha "Três passos para a primeira candidatura com currículo adaptado." e três cartões: "01 Conta criada" (concluído), "02 Preencha o currículo mestre" e "03 Cadastre uma vaga" (a fazer, com o botão **Nova candidatura**), seguidos de "Quando houver candidaturas, aqui aparecem o pipeline, o que precisa de atenção e a atividade recente.". A barra lateral mostra a marca, os itens "Início" (atual) e "Candidaturas", e embaixo as iniciais "MM" (de "Maria Membro"), o nome e o botão **Sair**. Um nome do meio não entra nas iniciais ("Maria Souza Membro" também dá "MM") e um nome só usa as duas primeiras letras ("Maria" dá "MA").
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

## 9. Candidaturas

Use um membro fictício (seções 2 a 5). Todos os dados abaixo são inventados.

1. Na home (`/`), o cartão "03 Cadastre uma vaga" tem o botão **Nova candidatura**: ele abre `/applications` com o diálogo já aberto. Sem candidaturas, o cartão continua "A fazer".
2. No diálogo "Nova candidatura", preencha "Empresa" com `Empresa Fictícia Alfa` e "Título" com `Vaga de Teste Pleno`, escolha o nível "Pleno" e o modelo "Remoto". Em "Skills obrigatórias" digite `Postgres` e escolha **PostgreSQL** (achada pelo apelido); digite `Node.js` e escolha a skill; digite `Skill Privada de Teste`, escolha "Criar “Skill Privada de Teste” como skill privada" e depois a categoria "Ferramenta". Em "Skills desejáveis" escolha `Docker`. O rodapé diz "Entra como Salva."; `Ctrl+↵` (`⌘↵` no Mac) ou **Criar candidatura** cria. Sem empresa, título ou nível o diálogo mostra o erro sob o campo e não envia.
3. A lista `/applications` mostra a linha no grupo "Salvas", com duas skills, o nível, o modelo e "hoje". O título tem o total em mono e a sidebar mostra "Candidaturas 1". A tecla `C` fora de um campo abre o diálogo de novo; o "+" do cabeçalho de um grupo abre o diálogo já nesse status.
4. Na linha, o menu "⋯" (ou o clique direito) tem "Status" e "Nível". Escolha "Enviada": a linha passa ao grupo "Enviadas". Os chips "Ativas" e "Encerradas", os filtros "Nível", "Modelo" e "Filtro", a ordenação e a busca "Empresa, título ou skill" ficam na URL.
5. Clique na empresa para abrir `/applications/<id>`: breadcrumb "Candidaturas › Empresa Fictícia Alfa", as skills em "Obrigatórias" e "Desejáveis" (cada tag tem o "×" e cada linha o "+ Skill"), a "Linha do tempo" e a sidebar com Status, Nível, Modelo, Local, Vaga, Cadastrada e Atividade. **+ Etapa** abre o diálogo "Nova etapa" (tipo, data até hoje e nota opcional); o campo "Adicionar nota…" aceita `Ctrl+↵`. Cada ação aparece na linha do tempo.
6. **Excluir candidatura** (na sidebar) abre a confirmação "Excluir candidatura?"; **Excluir** apaga a vaga, as skills e a linha do tempo e volta à lista.
7. Sugestão de "sem retorno": ela só aparece com 21 dias sem atividade em "Enviada" ou "Em entrevistas". Para não esperar, volte a data da candidatura enviada:

   ```bash
   docker compose exec postgres psql -U app -d app \
     -c "update applications.applications set last_activity_at = now() - interval '23 days' where status = 'applied';"
   ```

   Recarregue a lista: a linha ganha "sem retorno?" em âmbar. No detalhe aparece o alerta "23 dias sem atividade desde o envio. Marcar como sem retorno?" com **Ainda não** (esconde a sugestão por mais 21 dias, sem mudar o status) e **Marcar sem retorno** (muda o status para "Sem retorno"). Nada muda sozinho.
8. Como admin, `/admin/skills` mostra em cada linha "0 vagas", "1 vaga" ou "{N} vagas": o número de vagas de todas as pessoas que têm a skill, sem dizer de quem. Cadastrar ou excluir uma candidatura muda o número ao recarregar.
9. Só com o teclado: `C` abre o diálogo, `Tab` anda pelos campos, as setas escolhem nível e modelo, no campo de skills a primeira sugestão já vem ativa: `Enter` a aplica e as setas escolhem outra; no menu "⋯" a seta para a direita abre o submenu de "Status".

## 10. Tema, largura e teclado

- Alterne o tema do sistema (claro/escuro): as telas e o favicon acompanham.
- Estreite a janela para 375 px: nada rola na horizontal (na lista de candidaturas sobram status, empresa, título e última atividade; no detalhe a sidebar vai para baixo do conteúdo); e-mails e links longos quebram dentro da página, e a barra lateral vira uma barra no topo.
- Navegue só com `Tab`: o botão em foco tem um anel visível. Em `/login`, o botão **Mostrar senha** é o próximo foco depois do campo "Senha" e funciona com `Enter` e `Espaço`.

## 11. Rodar os testes

| Comando | Tempo | O que cobre |
|---|---|---|
| `pnpm lint && pnpm typecheck` | segundos (com cache) | estilo, fronteiras, tipos |
| `pnpm test` | ~10 s com cache | unitários, componentes e stories em Chromium |
| `pnpm test:integration` | ~40 s | API contra PostgreSQL (precisa de Docker) |
| `pnpm test:e2e` | ~2 a 3 min | stack real do compose + navegador (fora do CI por enquanto) |
| `pnpm test:repo-rules` | ~1 min | regras do repositório com violações plantadas |

No CI de cada PR rodam lint, tipos, `pnpm test`, integração, `test:repo-rules` e o scan de segredos.

O E2E de candidaturas grava as três imagens das telas (`PageApplications`, `PageNewApplication` e `PageApplicationDetail`, 1280 × 800) na pasta de saída do Playwright (`tests/e2e/test-results`, ignorada pelo git), então um `pnpm test:e2e` comum deixa a árvore limpa. Para renovar as imagens versionadas em `.specs/features/application/captures/*.running.png`, rode `CAPTURE=1 pnpm test:e2e`.

## 12. Encerrar

```bash
docker compose down -v   # apaga também o volume do banco
```
