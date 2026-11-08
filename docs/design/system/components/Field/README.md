Campo composto: rótulo, controle, dica e erro ligados por ids gerados.

Fonte: `packages/ui/src/components/field/field.tsx` (prévia estática com os tokens novos).

## Partes
- `Field.Root` (`invalid`): gera os ids e marca o estado.
- `Field.Label`: estilo `label` (12px/500).
- `Field.Control`: `<input>` de `control-md`, borda `border-control`; inválido = borda `danger`. Recebe `aria-describedby` e `aria-invalid` sozinho.
- `Field.Hint`: `caption` em `text-muted`.
- `Field.Error`: só aparece quando `invalid`, em `danger`, com ícone `circle-alert`.

## Regras
- O erro substitui o silêncio, não a dica: os dois podem coexistir.
- Validação no envio; a mensagem diz a regra ("Use de 12 a 128 caracteres.").
- Campo somente leitura usa fundo `surface-raised` e texto `text-muted` (e-mail do convite).
- Opcional é dito no rótulo ("· opcional"), obrigatório não é marcado.
- Textarea (nova): mesma borda, `min-height` 88px, para descrição da vaga e notas.
