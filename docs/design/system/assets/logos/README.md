Logos do Rumo Carreira. O símbolo é o anel de status do sistema três quartos cheio, com o quarto aberto apontando para a frente: a candidatura em andamento.

- `rumo-mark.svg`: símbolo em `accent` claro (#157171), sobre `surface`, `surface-raised` e `paper`.
- `rumo-mark-dark.svg`: símbolo em `accent` escuro (#48bfbf), sobre as superfícies do tema escuro.
- `rumo-favicon.svg`: favicon; troca de cor sozinho com `prefers-color-scheme`. Traço mais grosso para 16px.
- `rumo-app-icon.svg`: ícone de app e de PWA, símbolo em `surface` sobre bloco `accent`, raio 14/64.

Regras:
- Os arquivos são de uma tinta só e têm a cor gravada (um `<img>` não herda `currentColor`). No código, desenhe o símbolo inline com `fill`/`stroke` em `var(--accent)`.
- Logotipo: símbolo + "rumo" em Geist 600 (`text`) + "carreira" em Geist 400 (`text-muted`), caixa baixa, tracking -0.03em; altura do símbolo = 1.15× a altura das minúsculas, espaço entre os dois = metade do símbolo. Ainda não existe versão vetorizada do texto; ela deve ser contornada a partir da Geist (OFL).
- Área de respiro: um quarto do símbolo em volta. Tamanho mínimo: 16px (use o favicon).
- Não girar, não trocar a cor por outra que não seja `accent`, `text` ou `surface`, não preencher o quarto aberto.
