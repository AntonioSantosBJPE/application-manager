Arquétipo de painéis: cabeçalho e grade de 12 colunas de widgets.

Fonte: `packages/ui/src/layouts/dashboard-page/dashboard-page.tsx` (prévia estática com os tokens novos).

## Partes
- `DashboardPage.Root` (`main`): padding `space-6`, largura máx. `content-max`.
- `DashboardPage.Header`: h1 `heading-lg` e uma linha de contexto em `text-muted`.
- `DashboardPage.Grid`: 12 colunas, gap `space-4`; widgets ocupam 3, 4, 5, 6, 7, 8 ou 12.

## Widget
- `surface`, borda `border`, `radius-md`, padding `space-4`. Título `heading-sm`; número em `heading-xl` com números tabulares; legenda `caption`.
- Lista dentro de widget: linhas `am-row` com padding lateral `space-4`.
- Todo widget leva a algum lugar: ação `ghost` "Ver …" no cabeçalho.
