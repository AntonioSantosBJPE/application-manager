Confirmação antes de uma ação destrutiva.

Fonte: `packages/ui/src/components/confirm-dialog/confirm-dialog.tsx` (prévia estática com os tokens novos).

## Props
- `trigger` (o controle que abre), `title`, `description` (nomeia o que será afetado), `confirmLabel`, `cancelLabel`, `onConfirm`.

## Regras
- `surface-overlay`, `border-strong`, `radius-lg`, `shadow-overlay`, largura máx. 440px; véu `backdrop`.
- Ações à direita: `secondary` para cancelar, `danger` para confirmar, com o mesmo verbo do título ("Revogar").
- Foco preso no diálogo, `esc` cancela e nunca chama `onConfirm`.
- Só para o que não se desfaz: excluir candidatura, revogar convite, recomeçar a versão do mestre.
