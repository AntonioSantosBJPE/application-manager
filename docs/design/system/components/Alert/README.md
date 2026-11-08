Mensagem em linha: erro, atenção ou nota calma.

Fonte: `packages/ui/src/components/alert/alert.tsx` (prévia estática com os tokens novos).

## Quando usar
- `danger`: algo falhou (`role="alert"`, interrompe o leitor de tela).
- `info`: nota calma, como sessão expirada ou "o link só aparece desta vez" (`role="status"`).
- `warning` (nova): uma sugestão que pede decisão, como 21 dias sem atividade. Pode levar uma ação à direita (`.am-alert__action`).

## Props
- `intent`: `danger` | `info` | `warning`. Obrigatória.
- `children`: a frase, vinda de quem chama. Ícone à esquerda: `circle-alert`, `info`, `clock`.

## Regras
- Uma frase. Diga o que houve e o que fazer.
- Fundo `danger-subtle` / `warning-subtle` / `info-subtle`, texto na cor do intent; raio `radius-md`.
