Os oito status de uma candidatura, cada um com cor e forma próprias.

## Props
- `status`: `saved` | `applied` | `interviewing` | `offer` | `accepted` | `rejected` | `withdrawn` | `ghosted`.
- `label`: o rótulo vem de quem chama ("Enviada"); com `iconOnly`, vira `aria-label`.

## Regras
- Ícone de 14px (`am-sicon`): o preenchimento cresce com o avanço do processo (tracejado → vazio → meio → três quartos → cheio). Finais negativos ganham marca própria (X, barra, pontilhado).
- Cor em `status-*`; rótulo em `text`. Nunca só a cor: verde (aceita) e vermelho (recusada) têm a mesma luminosidade.
- Em linhas densas, só o ícone; em propriedades, timeline e menus, ícone + rótulo.

Adição intencional: a fatia Application (fase 1) define os oito status.
