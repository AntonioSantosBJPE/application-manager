Arquétipo de edição extensa: índice de seções, seções e ações.

## Partes
- Índice (`nav`, 200px, sticky) com contagem por seção e avisos da página.
- Seções com título `heading-md` e ação "+ Item" `secondary sm`; itens em caixas `radius-md` arrastáveis (`grip-vertical`).
- Ações: barra inferior ou topbar. Salvamento automático com "Salvo às 14:32" em `caption`.

## Regras
- Largura de leitura `form-max` (720px); grades de 2 colunas para campos curtos.
- Bullets do currículo em `body-lg`, com `SkillTag` abaixo; bullet sem skill mostra aviso `warning` "sem skill".

Adição intencional: prevista em `docs/design/principles.md`, existe em `packages/ui` como `FormPage.Root`, `Index`, `IndexLink` (contagem em `mono`, omitida quando zero), `Content`, `Section`, `Item` (com `ItemHeader` e `ItemBody`) e `Actions`; a alça de arrastar vem do `Sortable`.
