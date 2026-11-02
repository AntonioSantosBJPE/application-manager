# Design Principles

> Direção visual: **inspirada no design do Linear**, com tema claro e escuro. Inspiração significa adotar os princípios (densidade, sobriedade, teclado em primeiro lugar), não copiar marca, logo, ícones ou assets.

## Princípios

1. **Ferramenta de trabalho, não vitrine.** A tela existe para gerenciar dados com rapidez. Densidade de informação alta, decoração mínima.
2. **Conteúdo é o protagonista.** A interface recua: neutros com contraste bem calibrado, um único accent, cor reservada para significado (estado, prioridade, erro).
3. **Teclado em primeiro lugar.** Toda ação frequente tem atalho; command palette (`⌘K`) é a porta de entrada global.
4. **Consistência por estrutura.** Toda página usa um arquétipo; todo componente vem de `packages/ui`.
5. **Movimento serve à orientação.** Animações curtas e sutis que explicam mudança de estado, nunca enfeite.

## Fundamentos visuais

| Área | Decisão |
|---|---|
| Cor | Escala de neutros levemente fria; um accent; cores semânticas de status (cada estado da candidatura tem a sua); tokens definidos em espaço perceptual (OKLCH) para os dois temas terem contraste equivalente |
| Temas | Claro e escuro como cidadãos de primeira classe; segue o sistema por padrão, com escolha manual |
| Superfícies | Hierarquia por variação sutil de fundo e bordas de 1px de baixo contraste, não por sombras |
| Tipografia | Sans-serif neo-grotesca com escala compacta (texto base de interface ~13–14px), pesos e tracking deliberados; monoespaçada para identificadores e dados técnicos |
| Raio | Pequeno e consistente (4–8px); nada de `rounded-2xl` genérico |
| Espaçamento | Grade de 4px; densidade compacta em listas e tabelas |
| Ícones | Um único conjunto, traço fino, tamanho consistente; ícones de status com cor semântica |
| Movimento | 100–200ms, easing suave; respeitar `prefers-reduced-motion` |

## Padrões de interação

- **Navegação:** sidebar fixa com as áreas do produto; conteúdo em listas agrupáveis e filtráveis.
- **Listas antes de cards:** dados tabulares em linhas compactas; cards só quando o conteúdo é realmente heterogêneo.
- **Edição no lugar:** propriedades (status, skills, datas) editáveis inline via menus e popovers, sem navegar para um formulário.
- **Menus de contexto e atalhos** em itens de lista.
- **Empty states sóbrios:** uma frase e uma ação. Sem ilustrações genéricas.
- **Acessibilidade:** contraste AA nos dois temas, foco visível, tudo operável pelo teclado.

## Arquétipos de página

| Arquétipo | Uso | Slots |
|---|---|---|
| `ListPage` | Coleções (vagas, candidaturas) | Header, Filters, Content |
| `DetailPage` | Um item com propriedades | Header, Main, Sidebar (propriedades) |
| `FormPage` | Criação/edição extensa (currículo mestre) | Header, Sections, Actions |
| `DashboardPage` | Insights | Header, Grid de widgets |

## Proibido (sinais de layout genérico)

- Gradientes decorativos, glassmorphism, sombras pesadas.
- Cores cruas do Tailwind (`bg-purple-500`) ou valores arbitrários (`p-[13px]`): só tokens. Verificado por lint.
- Hero centralizado, emojis como ícones, cards para tudo.
- Componentes shadcn com estilo padrão: todo componente é reestilizado com os tokens.
- Página sem arquétipo ou componente fora de `packages/ui`.

## Fonte de verdade

O **Storybook** de `packages/ui` é a referência viva: tokens, componentes, arquétipos e exemplos de uso. Componente novo só entra com story, nos dois temas.

Valores concretos (paleta, fonte, escala) serão definidos numa etapa de design dedicada e registrados aqui.
