Moldura do app: navegação lateral e área de conteúdo.

Fonte: `packages/ui/src/layouts/app-shell/app-shell.tsx` (prévia estática com os tokens novos).

## Partes
- `AppShell.Root`: flex de altura total.
- `AppShell.Sidebar` (`aria-label` obrigatório): `sidebar-width`, `surface-raised`, borda direita `border`. Cabeçalho com o logotipo (`Logo`: símbolo + "rumo"), botão de busca `⌘K`, itens agrupados por seção (`Currículo`, `Análise`) e a pessoa no rodapé com "Sair".
- `AppShell.NavItem` (`current`, `asChild`): 30px, ícone 14px + rótulo + contagem em `mono`. Atual = `accent-subtle` + `accent-text`.
- `AppShell.Main` (`asChild`): recebe o arquétipo, que é o único `main`.

## Regras
- Abaixo de `md` a sidebar vira uma barra no topo (mesmo markup).
- Cada página abre com a topbar de 48px: breadcrumb ou título `heading-md` à esquerda, ações à direita.
- Itens de navegação aparecem quando a fatia correspondente existe.
