Arquétipo das telas de entrada: coluna estreita, sem card, sem hero.

Fonte: `packages/ui/src/layouts/auth-page/auth-page.tsx` (prévia estática com os tokens novos).

## Partes
- `AuthPage.Root` (`main`): fundo `surface`, coluna de `auth-max` (360px) um pouco acima do centro.
- `AuthPage.Header`: símbolo do `Logo` (20px), título `heading-xl`, uma linha `text-muted`.
- `AuthPage.Form`: campos com gap `space-4`; botão de largura total.
- `AuthPage.Footer`: filete `border` e nota `caption` em `text-muted`.

## Regras
- Usado por `/login`, `/admin/login`, `/invite/$token` e pelas telas de acesso (sem acesso, indisponível, convite inválido).
- Alerts ficam entre o header e o primeiro campo.
