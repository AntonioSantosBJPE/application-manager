Arquétipo de um item com propriedades: conteúdo à esquerda, propriedades à direita.

## Partes
- `DetailPage.Main`: padding `space-6`/`space-8`, seções com título `heading-sm`.
- `DetailPage.Sidebar` (`aria-label="Propriedades"`): `properties-width` (280px), borda esquerda. Lista de definição: nome em `caption` `text-muted`, valor em linha de 28px editável no lugar (hover `surface-hover`, abre menu).

## Regras
- Ação destrutiva no fim da sidebar, `ghost` em `danger`, sempre com `ConfirmDialog`.
- Sugestões (sem retorno) entram no topo do Main como `Alert` `warning` com ação.
- Linha do tempo: eventos com ícone de 20px, texto em `text-muted` com os termos em `text`, data em `mono` à direita; notas em caixa `surface-raised`.

Adição intencional: previsto em `docs/design/principles.md`, ainda não existe em `packages/ui`.
