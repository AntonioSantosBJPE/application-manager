Controle de ação: a intenção nomeia o significado, nunca a cor.

Fonte: `packages/ui/src/components/button/button.tsx` (prévia estática com os tokens novos).

## Quando usar
- `primary`: a ação principal da tela (uma por região). `secondary`: ações de apoio, "Cancelar", ações dentro de linhas. `ghost`: ações terciárias e botões só de ícone na topbar e nas linhas. `danger`: só a confirmação de algo destrutivo, dentro do `ConfirmDialog`.
- `size="sm"` (`control-sm`, 28px) dentro de linhas, widgets e topbar; padrão (`control-md`, 32px) em formulários.

## Props
- `intent`: `primary` | `secondary` | `ghost` (nova) | `danger`. Padrão `primary`.
- `size`: `default` | `sm`.
- `asChild`: renderiza o filho (o `Link` do router) com as classes do botão.
- Demais props de `<button>`; `type` é `button` por padrão.

## Regras
- O rótulo é um verbo que diz o que acontece. Atalho, quando existir, vai num `Kbd` dentro do botão.
- Botão só com ícone exige `aria-label`.
- Desabilitado = opacidade .5; enquanto uma chamada está aberta o botão fica desabilitado (evita envio duplo).
- Texto sobre `accent` e `danger` é `on-accent`.
