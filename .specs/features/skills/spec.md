# Skills Specification

**Approved**: 2026-11-08 - user: "Sim"

## Problem Statement

Vagas e bullets do currículo vão apontar para as mesmas skills, e a pontuação de relevância só funciona se "Node", "NodeJS" e "Node.js" forem a mesma skill com o mesmo id. Esta feature cria o catálogo compartilhado: ~200 skills globais com apelidos, skills privadas criadas na hora por quem usa o produto, a promoção de uma privada a global pelo admin e a curadoria do catálogo (editar nome e categoria de uma global, editar e remover apelidos). As fatias Application e MasterResume só pedem ids a este módulo, e o seletor que as usa nasce com elas.

## Goals

- [ ] Uma migração entrega pelo menos 200 skills globais com apelidos, e a busca por nome ou por apelido devolve a skill pelo nome oficial.
- [ ] Um member cria uma skill privada pela API; um admin a vê no catálogo de `/admin/skills`, a promove com confirmação, e a skill passa a aparecer na busca de todos com o mesmo id.
- [ ] O admin corrige o nome e a categoria de uma skill global e edita ou remove os apelidos dela, e a busca passa a refletir a mudança sem trocar o id.
- [ ] Todos os estados de Skill do `.design` (`200`, `201`, `403`, `409`) e os acrescentados aqui têm um teste que falharia se o comportamento mudasse.
- [ ] As fatias seguintes validam ids de skill pela API pública do módulo, sem ler o schema `skills`.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Tela do member para buscar ou criar skill (seletor de skills) | Nasce com Application e MasterResume, que a usam; aqui o member só tem a API e o BFF só ganha funções dos endpoints do admin |
| Coluna "N vagas" e grupo "Mais usadas" do catálogo | Dependem da fatia Application (AD-013) |
| Apelido em skill privada | AD-014 |
| Despromover e excluir skill | Fora do contrato do `.design`; os vínculos de Application e MasterResume dependem do id |
| Editar o nome ou a categoria de uma skill privada | Só globais são editáveis (AD-014 pelo mesmo motivo); para corrigir uma privada, o admin a promove antes |
| Fusão de skills duplicadas e redirecionar vínculos | Os vínculos moram em Application e MasterResume, que ainda não existem; a promoção recusada (`409`) fica sem fusão por ora |
| Criar skill global direto pelo admin | Fora do contrato; globais nascem do seed e da promoção de uma privada |
| Busca aproximada (erro de digitação) | A busca é por trecho da chave normalizada; aproximação só com necessidade medida |
| Skills por vaga, insights e roadmap de estudo | Application e fase 4 |
| Limite de skills privadas por pessoa e limite de taxa de `POST /skills` | Cadastro só por convite; sem abuso a conter com poucos usuários |
| Aviso à pessoa quando sua privada é promovida | Sem e-mail nem notificações no escopo |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Seed global | O autor revisa um rascunho de pelo menos 200 skills comuns de desenvolvimento (nome, categoria, apelidos) em arquivo versionado; uma migração do Drizzle as insere | Pergunta: "Quem escreve a lista e como ela chega ao banco?"; opção escolhida: "Eu rascunho, você revisa; migração SQL". A migração roda sozinha em dev, CI, preview e produção | y |
| Tela do member | Nenhuma; busca e criação de privada existem só na API, provadas por testes de API | Pergunta: "O member ganha alguma tela de skills nesta feature?"; opção escolhida: "Nenhuma, só API" | y |
| Uso em vagas | Omitido do catálogo (AD-013) | Pergunta: "Como tratar 'N vagas' e 'Mais usadas'?"; opção escolhida: "Omitir agora" | y |
| Apelidos | Só em skills globais; "+ Apelido" abre um diálogo para escolher a skill e digitar o apelido (AD-014) | Pergunta: "Em quais skills o admin pode adicionar apelido?"; opção escolhida: "Só globais; '+ Apelido' abre um diálogo" | y |
| Rótulo de categoria | "Linguagem" no chip e na linha (AD-015) | Pergunta: "Qual rótulo a tela usa?"; opção escolhida: "'Linguagem' no chip e na linha" | y |
| Confirmação ao promover | `ConfirmDialog` antes da chamada à API | Pergunta: "O botão pede confirmação antes?"; opção escolhida: "Sim, com ConfirmDialog". A carta não desenha o diálogo; é uma adição | y |
| Duplicata ao criar | Criar confere o nome contra as globais, os apelidos das globais e as privadas da própria pessoa; se achar, devolve a existente com `200` e ignora a categoria enviada | Pergunta: "Qual vale?"; opção escolhida: "Devolve a global existente com 200". Evita ids diferentes para a mesma skill, que quebrariam a pontuação do ResumeVersion | y |
| Promoção recusada | Duas pessoas com a mesma privada: promover a segunda dá `409`, e cada uma segue com a sua. Sem fusão por ora | Default do `.design` (fatia Skill, default 1), confirmado pelo autor em 2026-11-02 | y |
| Chave normalizada | NFKD, sem acentos (marcas combinantes), minúsculas, mantendo só letras, dígitos, `+` e `#`: "Node.js" → `nodejs`, "C++" → `c++`, "C#" → `c#`, "Comunicação" → `comunicacao`, ".NET" → `net` | Junta grafias de uma skill sem juntar "C", "C++" e "C#"; "Node" não vira "nodejs", e o apelido cobre esse caso | n |
| Limites de texto | Nome e apelido: aparados, espaços internos reduzidos a um, 1 a 60 caracteres, e a chave normalizada não pode ser vazia; `q` da busca: até 60 caracteres | Nomes de tecnologia são curtos; o limite barra colagem de texto longo | n |
| Busca do member | `GET /skills?q=`: chave de `q` contida na chave do nome ou na chave de um apelido; primeiro quem casa pelo nome oficial, depois quem casa só por apelido, cada grupo em ordem alfabética da chave; no máximo 20 itens, sem cursor; `q` ausente ou de chave vazia lista as 20 primeiras | O contrato diz "nome oficial primeiro" e devolve um array; a lista é para um seletor | n |
| Quem chama cada rota | `GET /skills` e `POST /skills` são só de member; `POST /skills/:id/promote`, `PATCH /skills/:id`, as rotas de apelido e `GET /admin/skills` são só de admin; a outra conta recebe `403` | AD-005: admin só administra e member só usa o produto; o contrato já manda `403` para quem não é admin | y (AD-005) |
| Admin vê todas as privadas | O catálogo do admin lista as globais e as privadas de todas as pessoas, sem mostrar de quem são; é a única leitura entre usuários do módulo | Promover exige ver as privadas; o nome de uma skill é dado pouco sensível, e esconder o dono preserva a regra de isolamento da Key decision 1 no resto | n |
| Lista do admin | `GET /admin/skills?scope=&category=&q=&cursor=` devolve `{ items, nextCursor, counts }`; `scope` é `all` (padrão), `global` ou `private`; 50 itens por página em ordem alfabética da chave; `counts` traz o total e o de privadas do catálogo inteiro, sem os filtros | A carta precisa de filtro por escopo e categoria, busca, o total no título e "Privadas 4"; listas paginadas por cursor é convenção do `.design`. A rota é do admin porque o admin não usa as rotas do produto | n |
| Promover o que já é global | `200` sem mudar nada | Idempotência: repetir o clique ou a chamada não falha | n |
| Repetir um apelido da mesma skill | `200` com o apelido existente, sem duplicar | O contrato diz `201` na criação; repetir é seguro | n |
| Status dos erros | Corpo ou parâmetro inválido `400`; id inexistente ou que não é uuid `404`; conflito de nome `409`; apelido ou edição em skill privada `422`; tudo em Problem Details | Convenção de erros do `.design`; Identity já usa `400` para corpo inválido | n |
| Quantidade do widget do painel | Até 8 privadas em ordem alfabética e "e mais N" quando houver mais | A carta mostra 4; o limite mantém o widget do tamanho de uma linha de chips | n |
| Busca do catálogo | Digitar atualiza a lista 300 ms depois da última tecla, sem botão de enviar | Filtros na URL e busca sem botão são o padrão do `ListPage` | n |
| Editar skill | `PATCH /skills/:id` (admin) com `{ name?, category? }`, ao menos um campo; só em globais; o id não muda e a chave é recalculada; trocar só a grafia mantendo a chave ("Nodejs" → "Node.js") é permitido | Pedido do usuário: "o admin precisa poder editar nomes de skills". Perguntas: "O que o admin pode editar além do nome?" (opção "Nome e categoria"), "Quais skills o admin pode renomear?" (opção "Só globais") | y |
| Nome antigo após renomear | Nenhum apelido é criado sozinho; o nome antigo deixa de casar | Pergunta: "Como tratar o nome antigo?"; opção escolhida: "Sem efeito automático" | y |
| Editar e remover apelido | `PATCH /skills/:id/aliases/:aliasId` `{ alias }` → `200` e `DELETE /skills/:id/aliases/:aliasId` → `204`, ambos do admin; `POST` passa a responder também o id do apelido; remover pede confirmação num `ConfirmDialog` | Pedido do usuário: "É preciso ter como editar e remover o apelido"; resposta do usuário ao ponto 1: "ter confirmação" | y |
| Gesto na tela | Cada linha de global tem um menu "⋯" com "Editar" e "Apelidos"; o botão "Apelido" do topo continua para adicionar | Pergunta: "Como o admin edita nome e categoria na tela e edita ou remove um apelido?"; opção escolhida: "Menu '⋯' por linha" | y |
| Rótulos da carta | "Fase 1 · admin — skills privadas, apelidos e promoção" e "Fase 1 · aparece quando a fatia Skill existir." são anotações do design e não vão para a tela | Mesma regra adotada na feature `prumo-design-system` | y |
| Larguras de tela | 375 px e 1280 px, sem rolagem horizontal da página | Sem captura de referência além da carta a 1280 px; diretriz de acessibilidade e densidade | n |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Seed e chave normalizada ⭐ MVP

**User Story**: Como pessoa que usa o produto, quero que o catálogo já nasça com as skills comuns e que variações de grafia sejam a mesma skill, para não cadastrar "Node.js" de cinco jeitos.

**Why P1**: Sem o seed o catálogo começa vazio e toda skill viraria privada; sem a chave normalizada nada é deduplicado.

**Acceptance Criteria**:

1. The system SHALL derive the normalized key of a name or alias by Unicode NFKD, removing combining marks, lowercasing and keeping only letters, digits, `+` and `#`. (SKL-01)
2. WHEN as migrações rodam num banco novo THEN o catálogo SHALL conter pelo menos 200 skills globais, cada uma com nome, uma das sete categorias e os apelidos do seed. (SKL-02)
3. The seed SHALL hold no two skills with the same normalized key and no alias whose normalized key equals a seeded skill key or another alias. (SKL-03)
4. The `skills` schema SHALL hold no foreign key to any other schema. (SKL-04)

**Independent Test**: Subir um Postgres vazio, aplicar as migrações e contar as linhas de `skills.skills` com `owner_user_id` nulo; rodar a função de normalização com os exemplos da tabela de assumptions.

---

### P1: Buscar skills (member) ⭐ MVP

**User Story**: Como member, quero buscar uma skill pelo nome ou por um apelido, para achar "Node.js" digitando "node" ou "nodejs".

**Why P1**: É o que o seletor de Application e MasterResume vai chamar a cada skill marcada.

**Acceptance Criteria**:

1. WHEN um member chama `GET /skills?q=` THEN a API SHALL responder `200` com um array de `{ id, name, category, scope }` com as globais e as privadas dele cuja chave do nome ou de algum apelido contém a chave de `q`, no máximo 20. (SKL-05)
2. The search SHALL list first the skills whose name matches and then those that match only through an alias, each group in alphabetical order of the normalized key, and SHALL always return the official name. (SKL-06)
3. WHEN `q` está ausente ou a chave de `q` é vazia THEN a API SHALL responder `200` com as 20 primeiras skills visíveis em ordem alfabética da chave. (SKL-07)
4. IF existe uma skill privada de outra pessoa que casa com `q` THEN a API SHALL não devolvê-la. (SKL-08)
5. IF `q` tem mais de 60 caracteres THEN a API SHALL responder `400` em Problem Details. (SKL-09)
6. WHEN uma skill global é devolvida THEN o campo `scope` SHALL ser `global`, e WHEN uma privada da própria pessoa é devolvida THEN `scope` SHALL ser `private`. (SKL-10)

**Independent Test**: Contra Postgres real, com o seed e duas contas member, buscar "node", "nodejs", "comunicacao" e um texto sem resultado, e conferir ordem, escopo e isolamento entre as contas.

---

### P1: Criar skill privada (member) ⭐ MVP

**User Story**: Como member, quero criar uma skill que não está no catálogo, para marcá-la numa vaga ou num bullet sem esperar o admin.

**Why P1**: Skills fora do seed são o caso comum no início; sem isso o cadastro trava.

**Acceptance Criteria**:

1. WHEN um member envia `POST /skills` com `{ name, category }` válidos cuja chave não casa com nenhuma global, nenhum apelido de global nem privada dele THEN a API SHALL criar a skill privada do usuário da sessão e responder `201` com `{ id, name, category, scope: "private" }`. (SKL-11)
2. WHEN a chave de `name` casa com uma global, com um apelido de global ou com uma privada do próprio usuário THEN a API SHALL responder `200` com a skill existente, sem criar linha e ignorando a categoria enviada. (SKL-12)
3. WHEN duas requisições do mesmo usuário com a mesma chave nova chegam ao mesmo tempo THEN a API SHALL gravar uma só skill, respondendo `201` a uma e `200` à outra. (SKL-13)
4. WHEN outra pessoa cria um nome que só existe como privada de um terceiro THEN a API SHALL criar uma privada separada para ela, com outro id, e responder `201`. (SKL-14)
5. IF `name` está vazio, passa de 60 caracteres ou tem chave normalizada vazia, ou `category` não é uma das sete categorias THEN a API SHALL responder `400` em Problem Details com o campo inválido, sem gravar nada. (SKL-15)
6. The API SHALL take the owner only from the session and SHALL ignore any `ownerUserId` or `scope` sent by the client. (SKL-16)

**Independent Test**: Criar "Drizzle ORM" como member A (`201`), repetir com "drizzle orm" (`200`, mesmo id), criar "Node" (`200`, devolve a global "Node.js"), criar "Drizzle ORM" como member B (`201`, id diferente), e disparar duas criações simultâneas de um nome novo.

---

### P1: Promover skill privada (admin) ⭐ MVP

**User Story**: Como admin, quero promover uma skill privada a global, para que todas as pessoas usem a mesma skill e os vínculos existentes continuem valendo.

**Why P1**: É a regra que mantém o catálogo único (Key decision 4).

**Acceptance Criteria**:

1. WHEN um admin chama `POST /skills/:id/promote` numa privada cuja chave não é chave nem apelido de uma global THEN a API SHALL torná-la global mantendo `id`, nome e categoria, e responder `200` com `scope: "global"`. (SKL-17)
2. WHEN uma skill é promovida THEN a busca de qualquer member SHALL passar a devolvê-la como `global`, com o mesmo `id`. (SKL-18)
3. IF a chave da privada já é chave ou apelido de uma global THEN a API SHALL responder `409` em Problem Details e a skill SHALL continuar privada. (SKL-19)
4. WHEN o admin promove uma skill que já é global THEN a API SHALL responder `200` sem alterar nada. (SKL-20)
5. IF `:id` não é um uuid ou não existe THEN a API SHALL responder `404` em Problem Details. (SKL-21)
6. IF a sessão é de um member THEN a API SHALL responder `403` a `POST /skills/:id/promote`, `POST /skills/:id/aliases` e `GET /admin/skills`, sem alterar nada. (SKL-22)
7. IF a sessão é de um admin THEN a API SHALL responder `403` a `GET /skills` e `POST /skills`. (SKL-23)
8. WHEN duas privadas de mesma chave são promovidas ao mesmo tempo THEN exatamente uma SHALL virar global e a outra SHALL receber `409`. (SKL-24)
9. The API SHALL expose no operation that turns a global skill back into a private one or that deletes a skill. (SKL-25)

**Independent Test**: Member A cria "Drizzle ORM"; o admin a promove (`200`, mesmo id) e a busca do member B passa a trazê-la; B cria o mesmo nome antes da promoção e o admin promove as duas, a segunda dá `409`.

---

### P1: Apelidos (admin) ⭐ MVP

**User Story**: Como admin, quero cadastrar apelidos de uma skill global, para que quem digitar "nest" ou "reactjs" encontre a skill oficial.

**Why P1**: Os apelidos são o que torna a busca útil e evita criar duplicatas.

**Acceptance Criteria**:

1. WHEN um admin envia `POST /skills/:id/aliases` com `{ alias }` válido a uma skill global THEN a API SHALL gravar o apelido com o texto digitado e a chave normalizada e responder `201` com o `id` e o texto do apelido gravado. (SKL-26)
2. WHEN um apelido é gravado THEN a busca do member por esse apelido SHALL devolver a skill pelo nome oficial. (SKL-27)
3. IF a chave do apelido é a chave de uma global (inclusive da própria skill) ou o apelido de outra skill THEN a API SHALL responder `409` em Problem Details, sem gravar. (SKL-28)
4. WHEN o apelido já pertence à mesma skill THEN a API SHALL responder `200` com o apelido existente, sem duplicar. (SKL-29)
5. IF a skill é privada THEN a API SHALL responder `422` em Problem Details, sem gravar. (SKL-30)
6. IF `:id` não existe THEN a API SHALL responder `404`, and IF `alias` está vazio, passa de 60 caracteres ou tem chave vazia THEN a API SHALL responder `400`, sem gravar. (SKL-31)
7. WHILE requisições concorrentes criam ou editam apelidos, renomeiam ou promovem skills, o catálogo SHALL never hold a global skill whose key equals the key of another global skill or of any alias. (SKL-32)

**Independent Test**: Adicionar "nest" à global "NestJS" (`201`) e buscar "nest" como member; repetir (`200`); adicionar "node" a "NestJS" (`409`); adicionar apelido a uma privada (`422`); disparar em paralelo a promoção de uma privada "nest" e o apelido "nest" de outra global.

---

### P1: Editar skill e apelidos (admin) ⭐ MVP

**User Story**: Como admin, quero corrigir o nome e a categoria de uma skill global e editar ou remover os apelidos dela, para manter o catálogo limpo sem mexer no banco.

**Why P1**: Um nome ou apelido digitado errado fica visível para todas as pessoas, e sem edição só o banco o corrigiria.

**Acceptance Criteria**:

1. WHEN um admin envia `PATCH /skills/:id` com `name`, `category` ou os dois, válidos, a uma skill global THEN a API SHALL atualizar a skill, recalcular a chave normalizada, manter o `id` e responder `200` com `{ id, name, category, scope: "global" }`. (SKL-62)
2. WHEN uma skill é renomeada THEN a busca pelo nome novo SHALL devolvê-la, a busca só pelo nome antigo SHALL não devolvê-la e a API SHALL não criar apelido algum. (SKL-63)
3. IF a chave do nome novo é a chave de outra global ou o apelido de qualquer skill, inclusive da própria THEN a API SHALL responder `409` em Problem Details, sem alterar nada; a mesma chave com outra grafia SHALL ser aceita. (SKL-64)
4. IF a skill é privada THEN a API SHALL responder `422` em Problem Details a `PATCH /skills/:id`, sem alterar nada. (SKL-65)
5. IF o corpo não traz `name` nem `category`, o nome está vazio, passa de 60 caracteres ou tem chave vazia, ou a categoria não é uma das sete THEN a API SHALL responder `400`, and IF `:id` não existe THEN a API SHALL responder `404`, sem alterar nada. (SKL-66)
6. WHEN um admin envia `PATCH /skills/:id/aliases/:aliasId` com `{ alias }` válido THEN a API SHALL trocar o texto e a chave do apelido e responder `200` com o `id` e o texto do apelido. (SKL-67)
7. IF a chave do apelido novo é a chave de uma global ou o apelido de outra skill THEN a API SHALL responder `409` em Problem Details, e IF o apelido é inválido THEN `400`, and IF a skill ou o apelido não existe, ou o apelido é de outra skill, THEN `404`, sem alterar nada; a mesma chave com outra grafia SHALL ser aceita. (SKL-68)
8. WHEN um admin chama `DELETE /skills/:id/aliases/:aliasId` THEN a API SHALL apagar o apelido e responder `204`, e a busca por ele SHALL deixar de devolver a skill. (SKL-69)
9. IF o apelido já foi apagado, a skill não existe ou o apelido é de outra skill THEN a API SHALL responder `404` a `DELETE /skills/:id/aliases/:aliasId`. (SKL-70)
10. IF a sessão é de um member THEN a API SHALL responder `403` a `PATCH /skills/:id`, `PATCH /skills/:id/aliases/:aliasId` e `DELETE /skills/:id/aliases/:aliasId`, sem alterar nada. (SKL-71)

**Independent Test**: Renomear "NestJS" para "Nest.js" (`200`, mesmo id), buscar os dois nomes como member, trocar a categoria, editar o apelido "nest" para "nestjs-core", tentar "node" (`409`), remover o apelido (`204`, repetir dá `404`), e tentar editar uma privada (`422`).

---

### P1: Lista do catálogo para o admin (API) ⭐ MVP

**User Story**: Como admin, quero listar o catálogo inteiro, com as privadas de todas as pessoas, para decidir o que promover.

**Why P1**: Sem ela o admin não enxerga o que promover.

**Acceptance Criteria**:

1. WHEN um admin chama `GET /admin/skills` THEN a API SHALL responder `200` com `{ items, nextCursor, counts }`, onde cada item traz `id`, `name`, `category`, `scope` e `aliases` (o `id` e o texto de cada apelido), sem identificar o dono de uma privada. (SKL-33)
2. The list SHALL return the global skills and the private skills of every user, 50 per page in alphabetical order of the normalized key, with `nextCursor` null on the last page. (SKL-34)
3. WHEN `scope`, `category` e `q` são enviados THEN a lista SHALL devolver só o que casa com todos, e `q` casa pelo nome ou por apelido como na busca do member. (SKL-35)
4. The `counts` field SHALL hold the total number of skills and the number of private skills of the whole catalog, ignoring the filters. (SKL-36)
5. IF `scope`, `category` ou `cursor` são inválidos THEN a API SHALL responder `400` em Problem Details. (SKL-37)

**Independent Test**: Com o seed e três privadas de duas contas, listar sem filtro, com `scope=private`, com `category=database`, com `q=postgres` e seguir `nextCursor` até o fim; conferir `counts` em cada chamada.

---

### P1: Tela do catálogo (admin) ⭐ MVP

**User Story**: Como admin, quero uma tela para filtrar o catálogo, promover privadas e cadastrar apelidos, para curar as skills sem usar a API.

**Why P1**: É o único jeito de o admin agir sobre o catálogo.

**Acceptance Criteria** (fonte binding: `docs/design/system/components/PageSkills/preview.html`, com as diferenças da tabela `Differences from the source`; rótulos e frases da carta são copiados, e os dados de exemplo não):

1. WHEN o admin abre `/admin/skills` THEN o web SHALL mostrar a carta `PageSkills`, acrescida do menu "⋯" das globais (SKL-40): o título "Catálogo de skills" com o total do catálogo em `mono`, o botão "Apelido" com o ícone `plus`, os chips "Todas" e "Privadas" com o número de privadas, os sete chips de categoria, o campo "Nome ou apelido", as linhas em ordem alfabética e o `Alert` `info` "Promover torna a skill global. Se a chave já existir como global, a promoção é recusada e a fusão é manual.". (SKL-38)
2. WHILE o admin está em `/admin/skills` a sidebar SHALL mostrar o item "Catálogo de skills" com `aria-current="page"`, entre "Convites" e "Status do sistema". (SKL-39)
3. The row of a skill SHALL show its official name, the "Privada" badge when it is private, its aliases separated by commas or "—" when it has none, and its category label, and only a private row SHALL carry the button "Promover", while only a global row SHALL carry the "⋯" menu button with the accessible name "Ações de {nome}" and the items "Editar" and "Apelidos". (SKL-40)
4. WHEN o admin escolhe "Todas" ou "Privadas", escolhe uma categoria, ou digita no campo de busca THEN o web SHALL listar só o que casa, colocar `scope`, `category` e `q` na URL e manter os filtros ao recarregar; a busca SHALL atualizar 300 ms depois da última tecla. (SKL-41)
5. WHEN o admin usa o chip de categoria já pressionado THEN o web SHALL remover o filtro de categoria. (SKL-42)
6. IF nenhuma skill casa com os filtros THEN o web SHALL mostrar um `EmptyState` "Nenhuma skill encontrada." com a ação "Limpar filtros", que SHALL zerar `scope`, `category` e `q`. (SKL-43)
7. WHERE a resposta traz `nextCursor` o web SHALL mostrar o botão "Carregar mais", que acrescenta a página seguinte à lista, e WHERE `nextCursor` é nulo o botão SHALL não aparecer. (SKL-44)
8. WHEN o admin usa "Promover" numa linha THEN o web SHALL abrir um `ConfirmDialog` "Promover {nome}?" que diz que a skill passa a ser visível para todas as pessoas e que a promoção não se desfaz por aqui, e WHEN confirma THEN o web SHALL chamar a promoção e mostrar a linha sem o selo e sem o botão, com o número de "Privadas" reduzido em um e o total igual. (SKL-45)
9. WHEN o admin cancela ou fecha o `ConfirmDialog` de promoção THEN o web SHALL não chamar a API e SHALL devolver o foco ao botão "Promover" da linha. (SKL-46)
10. IF a promoção responde `409` THEN o web SHALL fechar o diálogo, manter a linha como privada e mostrar um `Alert` `danger` "Já existe uma skill global com esse nome ou apelido. A fusão é manual.". (SKL-47)
11. WHEN o admin usa o botão "Apelido" THEN o web SHALL abrir um diálogo com o campo "Skill", que busca entre as globais por nome ou apelido e exige escolher uma, e o campo "Apelido", e WHEN ele envia os dois válidos THEN o web SHALL chamar a API, fechar o diálogo e mostrar o apelido na linha dessa skill. (SKL-48)
12. IF a API responde `409` ao apelido THEN o web SHALL manter o diálogo aberto com o erro "Esse apelido já pertence a outra skill." no campo "Apelido", e IF responde `400` THEN o erro SHALL aparecer no campo inválido, sem fechar o diálogo. (SKL-49)
13. WHILE uma chamada de promoção, edição, apelido ou remoção de apelido está pendente o botão de confirmar SHALL ficar desabilitado com `aria-busy`, de modo que um segundo clique não envie outra chamada. (SKL-50)
14. IF a leitura do catálogo falha THEN o web SHALL mostrar um `Alert` `danger` com o texto de indisponibilidade já usado no app e nenhuma linha, e IF a sessão expirou THEN o web SHALL seguir o redirecionamento ao login do admin que as telas protegidas já têm. (SKL-51)
15. The page SHALL pass the axe scan in light and dark themes in the list, empty, open row menu, promote confirm dialog, remove-alias confirm dialog, add-alias dialog, edit dialog, aliases dialog and error alert states. (SKL-52)
16. The page SHALL be fully operable by keyboard, with the row menu opening with Enter and moving between items with the arrow keys, the dialogs moving focus in, trapping it and closing with Escape, and SHALL show no horizontal page scroll at 375 px and 1280 px. (SKL-53)
17. The web SHALL reach the skills API only through one server function per admin endpoint, and the browser SHALL have no function for `GET /skills` or `POST /skills`. (SKL-54)
18. WHEN o admin usa "Editar" no menu de uma global THEN o web SHALL abrir um diálogo "Editar skill" com os campos "Nome" e "Categoria" preenchidos, e WHEN ele envia valores válidos THEN o web SHALL chamar a API, fechar o diálogo e mostrar a linha com o nome e a categoria novos, com os totais iguais. (SKL-72)
19. IF a edição responde `409` THEN o web SHALL manter o diálogo aberto com o erro "Já existe uma skill ou apelido com esse nome." no campo "Nome", e IF responde `400` THEN o erro SHALL aparecer no campo inválido, sem fechar o diálogo. (SKL-73)
20. WHEN o admin usa "Apelidos" no menu de uma global THEN o web SHALL abrir um diálogo "Apelidos de {nome}" que lista cada apelido com as ações "Editar" e "Remover" e tem um campo para acrescentar outro, e IF a skill não tem apelidos THEN o diálogo SHALL dizer "Esta skill não tem apelidos.". (SKL-74)
21. WHEN o admin usa "Editar" num apelido e envia um texto válido THEN o web SHALL chamar a API e mostrar o texto novo no diálogo e na linha, and IF a API responde `409` THEN o web SHALL manter o campo aberto com o erro "Esse apelido já pertence a outra skill.". (SKL-75)
22. WHEN o admin usa "Remover" num apelido THEN o web SHALL abrir um `ConfirmDialog` "Remover o apelido {apelido}?" que diz que a busca por ele deixa de achar a skill, and WHEN ele confirma THEN o web SHALL chamar a API e tirar o apelido do diálogo e da linha, and WHEN cancela ou fecha THEN o web SHALL não chamar a API e devolver o foco ao botão "Remover" do apelido. (SKL-76)

**Independent Test**: No navegador, com o seed e privadas criadas pela API, entrar como admin, filtrar por "Privadas" e por "Banco de dados", buscar "postgres", promover uma privada e cadastrar um apelido, recarregando a página para ver a URL manter os filtros.

---

### P2: Widget de privadas no painel do admin

**User Story**: Como admin, quero ver no painel quantas skills privadas aguardam promoção, para saber quando abrir o catálogo.

**Why P2**: Útil, mas o catálogo já cobre a curadoria. A carta do painel previa o widget "com a fatia Skill" (AD-008).

**Acceptance Criteria** (fonte binding: `docs/design/system/components/PageAdminDashboard/preview.html`, terceiro widget):

1. WHEN o admin abre `/admin` THEN o web SHALL mostrar o widget "Skills privadas aguardando promoção" em largura total, com as privadas como `SkillTag` privadas em ordem alfabética, até 8, e "e mais N" quando houver mais, e a ação `ghost` "Abrir catálogo" com seta que leva a `/admin/skills?scope=private`. (SKL-55)
2. IF não há privadas THEN o widget SHALL mostrar "Nenhuma skill privada aguardando promoção." e manter a ação "Abrir catálogo". (SKL-56)
3. IF a leitura das privadas falha THEN o widget SHALL mostrar um `Alert` `danger` e os outros widgets do painel SHALL continuar na tela. (SKL-57)

**Independent Test**: Abrir `/admin` sem privadas, com 3 e com 11 privadas, e com a API de skills derrubada.

---

### P2: API pública do módulo para as próximas fatias

**User Story**: Como fatia Application ou MasterResume, quero validar ids de skill pela API pública do módulo, para não ler o schema `skills` (Key decision 2).

**Why P2**: Nenhum cliente existe ainda, mas é a única porta que a regra entre módulos permite; um teste a mantém estável.

**Acceptance Criteria**:

1. The `skills` module SHALL export from its `index.ts` an operation that, given a user id and skill ids, returns the ids visible to that user (global or the user's own private). (SKL-58)
2. IF um id pertence à privada de outra pessoa ou não existe THEN a operação SHALL não incluí-lo no resultado. (SKL-59)

**Independent Test**: Chamar a operação com um id global, um id privado do usuário, um id privado de outro usuário e um uuid inexistente, e conferir que só os dois primeiros voltam.

---

### P2: Registros de operação

**User Story**: Como operador, quero logs das mudanças no catálogo, para saber quem criou, promoveu ou deu apelido a quê.

**Why P2**: O catálogo é compartilhado entre contas; sem registro, uma promoção indevida não deixa rastro.

**Acceptance Criteria**:

1. WHEN uma skill é criada, editada ou promovida, ou um apelido é criado, editado ou removido, THEN a API SHALL registrar um evento estruturado com a operação, o id da skill e o id do usuário que agiu. (SKL-60)
2. The skills log events SHALL contain no cookie, session token or e-mail. (SKL-61)

**Independent Test**: Executar cada operação capturando os logs da API e procurar o evento e os valores proibidos.

---

## Edge Cases

- WHEN `name` chega com espaços nas pontas ou internos repetidos THEN a API SHALL gravar o nome aparado e com um espaço entre palavras (coberto por SKL-01 e SKL-11).
- IF `POST /skills` chega sem corpo ou com `name` que não é texto THEN a API SHALL responder `400` (coberto por SKL-15).
- WHEN a busca tem acento ou caixa diferente ("COMUNICAÇÃO") THEN a API SHALL achar a skill "Comunicação" (coberto por SKL-01 e SKL-05).
- IF o banco fica indisponível THEN o comportamento é o da infraestrutura já existente (`503` em Problem Details); esta feature não acrescenta um tratamento próprio.

Implicit-requirement sweep: validação de entrada coberta por SKL-09, SKL-15, SKL-31, SKL-37, SKL-66 e SKL-68; falha parcial N/A because cada operação é uma única instrução no banco (criar, promover, gravar apelido); idempotência e duplicata cobertas por SKL-12, SKL-20, SKL-29; auth e papéis cobertos por SKL-22, SKL-23, SKL-71 e SKL-16, com a declaração de acesso de cada rota provada pelo teste de arquitetura de Identity (AUTH-19); limite de taxa N/A because o cadastro é só por convite e `POST /skills` fica sem limite por ora; concorrência coberta por SKL-13, SKL-24 e SKL-32 (que inclui as edições); ciclo de vida de dados N/A because nenhuma operação apaga skill e não existe exclusão de usuário; observabilidade coberta por SKL-60 e SKL-61; falha de dependência externa N/A because o único recurso é o Postgres, tratado pela infraestrutura existente; integridade de transição de estado coberta por SKL-17 a SKL-20, SKL-25 e SKL-65 (privada vira global, uma só vez e sem volta, e só a global é editável).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SKL-01 | P1: Seed e chave normalizada | Design | Pending |
| SKL-02 | P1: Seed e chave normalizada | Design | Pending |
| SKL-03 | P1: Seed e chave normalizada | Design | Pending |
| SKL-04 | P1: Seed e chave normalizada | Design | Pending |
| SKL-05 | P1: Buscar skills (member) | Design | Pending |
| SKL-06 | P1: Buscar skills (member) | Design | Pending |
| SKL-07 | P1: Buscar skills (member) | Design | Pending |
| SKL-08 | P1: Buscar skills (member) | Design | Pending |
| SKL-09 | P1: Buscar skills (member) | Design | Pending |
| SKL-10 | P1: Buscar skills (member) | Design | Pending |
| SKL-11 | P1: Criar skill privada (member) | Design | Pending |
| SKL-12 | P1: Criar skill privada (member) | Design | Pending |
| SKL-13 | P1: Criar skill privada (member) | Design | Pending |
| SKL-14 | P1: Criar skill privada (member) | Design | Pending |
| SKL-15 | P1: Criar skill privada (member) | Design | Pending |
| SKL-16 | P1: Criar skill privada (member) | Design | Pending |
| SKL-17 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-18 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-19 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-20 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-21 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-22 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-23 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-24 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-25 | P1: Promover skill privada (admin) | Design | Pending |
| SKL-26 | P1: Apelidos (admin) | Design | Pending |
| SKL-27 | P1: Apelidos (admin) | Design | Pending |
| SKL-28 | P1: Apelidos (admin) | Design | Pending |
| SKL-29 | P1: Apelidos (admin) | Design | Pending |
| SKL-30 | P1: Apelidos (admin) | Design | Pending |
| SKL-31 | P1: Apelidos (admin) | Design | Pending |
| SKL-32 | P1: Apelidos (admin) | Design | Pending |
| SKL-33 | P1: Lista do catálogo para o admin (API) | Design | Pending |
| SKL-34 | P1: Lista do catálogo para o admin (API) | Design | Pending |
| SKL-35 | P1: Lista do catálogo para o admin (API) | Design | Pending |
| SKL-36 | P1: Lista do catálogo para o admin (API) | Design | Pending |
| SKL-37 | P1: Lista do catálogo para o admin (API) | Design | Pending |
| SKL-38 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-39 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-40 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-41 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-42 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-43 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-44 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-45 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-46 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-47 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-48 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-49 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-50 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-51 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-52 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-53 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-54 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-55 | P2: Widget de privadas no painel do admin | Design | Pending |
| SKL-56 | P2: Widget de privadas no painel do admin | Design | Pending |
| SKL-57 | P2: Widget de privadas no painel do admin | Design | Pending |
| SKL-58 | P2: API pública do módulo | Design | Pending |
| SKL-59 | P2: API pública do módulo | Design | Pending |
| SKL-60 | P2: Registros de operação | Design | Pending |
| SKL-61 | P2: Registros de operação | Design | Pending |
| SKL-62 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-63 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-64 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-65 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-66 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-67 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-68 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-69 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-70 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-71 | P1: Editar skill e apelidos (admin) | Design | Pending |
| SKL-72 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-73 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-74 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-75 | P1: Tela do catálogo (admin) | Design | Pending |
| SKL-76 | P1: Tela do catálogo (admin) | Design | Pending |

**Coverage:** 76 total, 0 mapped to tasks, 76 unmapped ⚠️

---

## Differences from the source

Cada diferença entre as cartas e o produto, aprovada pelo usuário.

| Source shows | Product shows | Confirmed |
| ------------ | ------------- | --------- |
| Em cada linha "18 vagas", "14 vagas"… e o grupo "Mais usadas · por número de vagas" | Sem a coluna e sem o grupo; as linhas ficam em ordem alfabética | y - [AD-013] |
| Apelido "drizzle" numa skill privada ("Drizzle ORM", selo "Privada") | A linha de uma privada mostra "—" nos apelidos | y - [AD-014] |
| "Linguagem/runtime" na linha do Node.js, "Linguagem" no chip | "Linguagem" nos dois | y - [AD-015] |

## Sources

- [.design/application-manager.md](../../../.design/application-manager.md) - fatia Skill, Key decisions 1, 2 e 4 e as convenções do projeto - contrato, tabelas, estados e o default 1
- [components/PageSkills](../../../docs/design/system/components/PageSkills/preview.html) - binding - tela `/admin/skills`
- [components/PageAdminDashboard](../../../docs/design/system/components/PageAdminDashboard/preview.html) - binding - terceiro widget do painel do admin
- [components/ListPage, DashboardPage, SkillTag, ConfirmDialog, EmptyState, Alert, Field, Button, AppShell](../../../docs/design/system/components/) - binding - README e prévia de cada componente e arquétipo
- [docs/design/system/prumo.md](../../../docs/design/system/prumo.md) - binding - guia do Prumo
- [.specs/features/identity/spec.md](../identity/spec.md) - AUTH-14, AUTH-15, AUTH-16 e AUTH-19: papéis, sessão e declaração de acesso por rota
- [.specs/STATE.md](../../STATE.md) - AD-005, AD-006, AD-007, AD-008, AD-013, AD-014, AD-015
- Pedido do usuário (2026-11-08) - editar e remover apelido e editar o nome (e a categoria) de uma skill; não estão no `.design`

---

## Success Criteria

- [ ] O seed entrega pelo menos 200 skills globais sem colisão de chave nem de apelido, provado por teste.
- [ ] Um member cria uma privada pela API, o admin a promove em `/admin/skills` e outro member a encontra na busca com o mesmo id, provado por um teste E2E no navegador.
- [ ] Nenhuma privada de uma pessoa aparece na busca de outra, e nenhuma resposta do admin identifica o dono de uma privada.
- [ ] `pnpm lint`, `pnpm typecheck` e `pnpm test` passam, e as telas novas passam no axe.
