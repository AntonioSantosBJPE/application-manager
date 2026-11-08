Valor somente leitura com ação de copiar, que continua selecionável se a cópia falhar.

Fonte: `packages/ui/src/components/copy-field/copy-field.tsx` (prévia estática com os tokens novos).

## Props
- `value`, `valueLabel` (nome acessível), `onCopy` (quem chama faz a cópia), `status`: `idle` | `copied` | `failed`.
- `copyLabel`, `copiedLabel`, `failureMessage`: todo o texto vem de fora.

## Regras
- Valor em `mono` sobre `surface-raised`; o foco seleciona tudo.
- Depois de copiar o rótulo vira "Copiado" com ícone `check`; em falha aparece `Alert` `danger` abaixo.
- Na tela de convites, vem acompanhado da nota "este link só aparece desta vez".
