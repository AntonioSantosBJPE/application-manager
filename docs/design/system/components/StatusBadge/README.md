Selo de saúde do sistema: operacional ou indisponível.

Fonte: `packages/ui/src/components/status-badge/status-badge.tsx` (prévia estática com os tokens novos).

## Props
- `intent`: `operational` | `unavailable`. Opcional: sem ela o selo é neutro (sem ponto, borda `border-strong`, texto `text`).
- `asChild`, demais props de `<span>`. O texto vem de quem chama.

## Regras
- Borda e texto na cor do status, com um ponto (`am-dot`) antes do texto; fundo transparente.
- Para os status de uma candidatura use `PipelineStatus`, não este.
- Sem intent, `.am-badge` é um selo neutro ("Pendente", "Enviado", "Privada").
