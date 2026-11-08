Arquétipo de coleções: topbar, filtros e linhas densas agrupáveis.

Fonte: `packages/ui/src/layouts/list-page/list-page.tsx` (prévia estática com os tokens novos).

## Partes
- `ListPage.Root` (`main`) e `ListPage.Header`: topbar com título `heading-md`, contagem em `mono` e a ação primária `sm` com atalho.
- `ListPage.Filters` (`role="search"`, `aria-label` obrigatório): chips de 26px (`aria-pressed`) + busca à direita. Filtros refletidos na URL.
- Cabeçalho de grupo (novo): 36px, `surface-raised`, ícone de status, rótulo `heading-sm`, contagem e "+" para criar já no grupo.
- `ListPage.Row`: `row-height` 40px, gutter `space-6`, hover `surface-hover`, selecionada `accent-subtle`. `RowText` à esquerda, metadados em colunas fixas à direita (`text-muted`, datas em `mono`).

## Regras
- Sem card ao redor da lista. Linhas, não cards.
- Paginação por cursor: "Carregar mais" `secondary` no fim, com o foco indo para a primeira linha nova.
- Lista vazia: `EmptyState`.
