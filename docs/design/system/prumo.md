**Prumo** é o design system do **Rumo Carreira**, uma ferramenta de trabalho para quem está procurando emprego: registrar candidaturas, adaptar o currículo para cada vaga em até 10 minutos e enxergar quais skills o mercado pede. A interface é densa, sóbria e operável pelo teclado. O conteúdo (empresas, vagas, bullets do currículo) é o protagonista; a interface recua.

Os componentes vivem em `packages/ui` (`@am/ui`, React + Tailwind 4 + Radix). As prévias deste sistema são **renderizações estáticas** desses componentes com os tokens novos, feitas com `components/bundle.css`; os nomes de classe espelham as partes React (`Button` → `.am-btn`, `Field.Control` → `.am-input`, `ListPage.Row` → `.am-row`).

## Princípios

1. **Ferramenta, não vitrine.** Densidade alta, decoração mínima. Listas antes de cards; card só para conteúdo realmente heterogêneo (widgets do dashboard, itens do currículo).
2. **Um accent, cor com significado.** Neutros levemente frios, um verde-petróleo (`accent`) para ação e seleção; o resto da cor é estado: os oito status da candidatura, erro, atenção.
3. **Teclado primeiro.** Toda ação frequente tem atalho visível em `Kbd`; `⌘K` (`CommandMenu`) é a porta de entrada global.
4. **Estrutura gera consistência.** Toda página usa um arquétipo: `AuthPage`, `ListPage`, `DetailPage`, `FormPage` ou `DashboardPage`, sempre dentro do `AppShell` (exceto `AuthPage` e `/status`).
5. **Movimento só orienta.** 100–200ms, `ease`, só em cor e opacidade; nada se move com `prefers-reduced-motion`.

## Voz e conteúdo

- Português do Brasil, frases curtas, sem exclamação e sem emoji.
- Fale com a pessoa em segunda pessoa implícita: "Cadastre a primeira vaga", "Sua sessão expirou. Entre de novo para continuar."
- Botões são verbos no infinitivo e dizem o que acontece: "Criar candidatura", "Revogar", "Marcar sem retorno". Nunca "OK" ou "Confirmar" sozinhos.
- Títulos em caixa de frase ("Currículo mestre", não "Currículo Mestre").
- Erros dizem o que houve e o que fazer: "Este convite expirou ou já foi usado. Peça um novo link a quem te convidou."
- Empty states: uma frase e uma ação. Sem ilustração.
- Os componentes não trazem texto de produto: todo rótulo, `aria-label` e mensagem vem de quem chama.
- Dados de exemplo são sempre fictícios (o repositório é público): `@exemplo.com`, empresas inventadas.

## Cor

- Fundo de página em `surface`; sidebar, cabeçalhos de grupo e widgets elevados em `surface-raised`; hover em `surface-hover`; o que flutua (menus, diálogos, `⌘K`) em `surface-overlay` com `border-strong` e `shadow-overlay`.
- Texto em `text`; metadados, dicas e contagens em `text-muted`. Os dois passam 4.5:1 em todas as superfícies nos dois temas.
- `accent` só para: botão primário, links, item de navegação atual (`accent-subtle` + `accent-text`), seleção e foco. Nunca como decoração ou fundo de seção.
- Texto sobre `accent` e `danger` é `on-accent`, nunca branco literal: no escuro o accent clareia e o texto escurece.
- Divisórias em `border` (1px, baixo contraste, decorativa). Bordas de campos e checkboxes em `border-control` (3:1).
- Erro e ação destrutiva em `danger` / `danger-subtle`. Atenção que não é erro (21 dias sem atividade, bullet sem skill) em `warning` / `warning-subtle`.
- A prévia do PDF usa `paper`, `paper-ink` e `paper-rule`: branca nos dois temas, porque mostra o documento como ele sai.
- Cores definidas em OKLCH: os dois temas têm contraste equivalente por construção.

### Status da candidatura

Cada status tem cor **e** forma; a cor nunca aparece sozinha. Em linhas densas pode aparecer só o ícone, com o rótulo no `aria-label`.

| Status | Rótulo | Token | Ícone |
|---|---|---|---|
| `saved` | Salva | `status-saved` | círculo tracejado |
| `applied` | Enviada | `status-applied` | círculo vazio |
| `interviewing` | Em entrevistas | `status-interviewing` | meio cheio |
| `offer` | Proposta | `status-offer` | três quartos |
| `accepted` | Aceita | `status-accepted` | cheio com check |
| `rejected` | Recusada | `status-rejected` | cheio com X |
| `withdrawn` | Desisti | `status-withdrawn` | com barra |
| `ghosted` | Sem retorno | `status-ghosted` | pontilhado |

`status-accepted` e `status-rejected` têm a mesma luminosidade (verde e vermelho): são distinguidos pelo ícone e pelo rótulo, nunca pela cor. A saúde do sistema usa `status-operational` e `status-unavailable` no `StatusBadge`.

## Tipografia

- Família `sans` (Geist) para tudo; `mono` (Geist Mono) para datas, ids, contagens, pontuações e atalhos, sempre com números tabulares. As duas são OFL e vêm auto-hospedadas via `@fontsource` no app e no Storybook, sem chamada a terceiro (AD-012); só as prévias estáticas as carregam do Google Fonts.
- `body` (13/20) é o padrão da interface. `body-lg` (14/22) para texto longo: descrição da vaga, bullets, resumo.
- `heading-lg` (18px) é o h1 de toda página do app; `heading-xl` (24px) só nas telas de entrada e em números de widget. `heading-md` para seção, widget e diálogo; `heading-sm` para cabeçalho de grupo.
- `label` (12px/500) para rótulos de campo e nomes de propriedade; `caption` (12px) para metadados e chips.
- Peso máximo 600. Sem itálico na interface, sem caixa alta (exceto os títulos de seção dentro do PDF ATS).

## Espaço, forma e camadas

- Grade de 4px: `space-1` (4) a `space-12` (48). O conteúdo tem gutter horizontal `space-6`; widgets e diálogos usam padding `space-4`.
- Linhas de lista têm no mínimo `row-height` (40px); controles `control-md` (32px) ou `control-sm` (28px) dentro de linhas.
- Raios pequenos: `radius-sm` (4px) em botões, campos, chips; `radius-md` (6px) em widgets, alerts, menus; `radius-lg` (8px) só em diálogos e `⌘K`. `radius-full` só no ícone de status e no avatar.
- Hierarquia por fundo e borda, nunca por sombra. `shadow-overlay` existe apenas para o que flutua.
- Larguras: `sidebar-width` 232px, `properties-width` 280px, `content-max` 1120px, `form-max` 720px, `auth-max` 360px.

## Foco e acessibilidade

- Foco: anel sólido de 2px em `focus`, afastado 2px (`outline-offset: 2px`); em campos, `-1px` com a borda também em `focus`. `focus` passa 3:1 em todas as superfícies nos dois temas.
- Contraste AA nos dois temas para todo texto; 3:1 para bordas de controle, ícones de status e o anel de foco.
- Tudo operável por teclado. Diálogos prendem o foco e fecham com `esc`; listas devolvem o foco a uma linha vizinha ou ao título quando um item some.
- Um único landmark `main` por página: o arquétipo é o `main`, e `AppShell.Main` o recebe com `asChild`.

## Marca

- O produto se chama **Rumo Carreira**; o design system, **Prumo** (o fio que garante o alinhamento). "Rumo Carreira" sozinho não está disponível como marca: aparece só como forma curta dentro do app. "Application Manager" é só o nome do repositório.
- O símbolo é o anel de status três quartos cheio, com o quarto aberto apontando para a frente: uma candidatura em andamento. Ele usa a mesma geometria do `PipelineStatus`, então a marca e a interface são a mesma forma.
- No app, o símbolo é SVG inline em `accent` (`.am-mark`); o logotipo junta o símbolo a "rumo" (Geist 600, `text`) e "carreira" (Geist 400, `text-muted`), em caixa baixa (`.am-wordmark`). Regras e arquivos: carta `Logo` e o grupo de assets `Logos`.
- Arquivos (`assets/Logos`): `rumo-mark.svg` para fundos claros, `rumo-mark-dark.svg` para escuros, `rumo-favicon.svg` (acompanha o tema) e `rumo-app-icon.svg`.

## Ícones

- Um conjunto só: **Lucide** (ISC), traço 1.75, 16px (`am-icon`) ou 14px (`am-icon-sm`), cor herdada (`currentColor`). Nas prévias vem do pacote `lucide@0.469.0`; no app, `lucide-react`.
- Ícone acompanha texto; ícone sozinho só em botão com `aria-label`.
- Lucide é uma escolha deste design, aplicada no código via `lucide-react`, por importação nomeada de cada ícone.

## Arquétipos de página

| Arquétipo | Uso | Partes |
|---|---|---|
| `AuthPage` | Entrar (`/login`, `/admin/login`), criar conta por convite, telas de acesso | Header, Form, Footer — coluna de `auth-max`, sem card e sem hero |
| `ListPage` | Candidaturas, convites, catálogo de skills | Header (topbar), Filters (`role="search"`), Content com grupos e `Row` |
| `DetailPage` | Uma candidatura | Main + Sidebar de propriedades editáveis no lugar |
| `FormPage` | Currículo mestre | Índice de seções, Sections, Actions |
| `DashboardPage` | Início, painel do admin, insights | Header + grade de 12 colunas de widgets |

Todas as páginas do app (exceto `AuthPage` e `/status`) ficam dentro do `AppShell`: sidebar em `surface-raised` com busca `⌘K`, navegação agrupada e a pessoa no rodapé; topbar de 48px com breadcrumb e as ações da página.

## Padrões de interação

- **Edição no lugar**: propriedades (status, nível, modelo, skills) mudam por menu/popover sobre a própria linha ou a sidebar de propriedades, sem formulário separado.
- **Cadastro rápido**: nova candidatura abre em diálogo sobre a lista (atalho `C`), cria como "Salva" e aceita `⌘↵`.
- **Skills** se buscam por nome ou apelido; o que não existe vira skill privada na hora.
- **Sugestões, não automações**: "sem retorno" aparece como Alert de atenção com ação; nada muda sozinho.
- **Imutável é visível**: documentos PDF gerados mostram data e template e nunca são editados; gerar de novo cria outro.

## Intentional additions

Componentes que o código ainda não tem e que este design acrescenta, cada um porque uma página futura (ou um princípio) pede:

- `PipelineStatus` — os oito status da candidatura com ícone próprio (fase 1).
- `SkillTag` — skill obrigatória, desejável, privada ou coberta pelo currículo (fases 1–2).
- `Kbd` — atalhos visíveis (princípio "teclado primeiro").
- `CommandMenu` — a `⌘K` dos princípios.
- `EmptyState` — "uma frase e uma ação".
- `Logo` — a marca do Rumo Carreira; o projeto ainda não tinha uma.
- `DetailPage` e `FormPage` — arquétipos já previstos em `docs/design/principles.md`, ainda não construídos.

## Telas

As cartas `Page*` mostram as telas a 1280px. **Páginas atuais**: `PageLogin`, `PageInvite`, `PageAccessStates`, `PageMemberHome`, `PageAdminDashboard`, `PageAdminInvitations`, `PageSkills`, `PageStatus`, `PageApplications`, `PageNewApplication`, `PageApplicationDetail`. **Páginas futuras**: `PageMasterResume`, `PageResumeVersion`, `PageHomeDashboard`, `PageInsights`, `PageCommandPalette`.

## Proibido

- Gradientes, glassmorphism, sombras na página, cards para tudo, hero centralizado, emoji como ícone.
- Cores cruas do Tailwind e valores arbitrários (`p-[13px]`): só tokens (verificado por lint).
- Componente fora de `packages/ui` ou página sem arquétipo.
- Status comunicado só por cor.
