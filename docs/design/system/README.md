# Prumo — o design system do Rumo Carreira

> **Rumo Carreira** é o nome do produto; **Prumo**, o do design system. "Application Manager" continua sendo só o nome do repositório.
>
> Registrado em 2026-11-08 e aplicado no código na feature `prumo-design-system`: os tokens, os componentes e os arquétipos de `packages/ui`, o Storybook e as telas atuais de `apps/web` seguem este design. Ele continua sendo a referência para as telas das fases futuras.

## O que tem aqui

| Caminho | O que é |
|---|---|
| [prumo.md](prumo.md) | O guia: princípios, voz, cor, tipografia, espaço, foco, marca, ícones, arquétipos, padrões de interação e o que é proibido. Comece por ele. |
| [tokens.json](tokens.json) | Fonte dos tokens: cor (claro e escuro, em OKLCH), tipografia, espaçamento, raio, sombra e tamanhos, cada um com nota de uso. |
| [tokens.css](tokens.css) | Os mesmos tokens compilados em CSS custom properties, na convenção de `packages/ui/src/styles/tokens.css` (claro por padrão, escuro por `prefers-color-scheme`, `[data-theme]` força um dos dois). Só referência. |
| [components/bundle.css](components/bundle.css) | Estilos das prévias. As classes (`.am-btn`, `.am-input`, `.am-row`…) espelham as partes React de `@am/ui`; servem de especificação visual, não para importar no app. |
| `components/<Nome>/` | Um `README.md` (guia de uso: partes, props, regras) e um `preview.html` (renderização estática). |
| [assets/logos/](assets/logos/) | Símbolo, favicon e ícone de app do Rumo Carreira, em SVG, com as regras de uso. |
| [index.html](index.html) | Galeria com todas as prévias, em claro e escuro. |

## Como ver

Abra [index.html](index.html) no navegador; cada carta também abre sozinha (`components/<Nome>/preview.html`) e segue o tema do sistema. As prévias carregam Geist do Google Fonts e os ícones Lucide do jsDelivr, então precisam de internet.

## Inventário

- **Componentes existentes em `packages/ui`, redesenhados:** `Button` (+ intent `ghost`), `Alert` (+ intent `warning`), `Field` (+ textarea), `StatusBadge`, `CopyField`, `ConfirmDialog`.
- **Arquétipos existentes, redesenhados:** `AppShell`, `AuthPage`, `ListPage` (+ cabeçalho de grupo), `DashboardPage` (grade de 12 colunas).
- **Novos:** `Logo`, `PipelineStatus`, `SkillTag`, `Kbd`, `CommandMenu`, `EmptyState`, e os arquétipos `DetailPage` e `FormPage` previstos em [principles.md](../principles.md).
- **Telas atuais (aplicadas em `apps/web`):** `PageLogin` (`/login` e `/admin/login`), `PageInvite`, `PageAccessStates` (convite inválido, sem acesso, indisponível), `PageMemberHome`, `PageAdminDashboard`, `PageAdminInvitations`, `PageSkills` (`/admin/skills`), `PageStatus`, `PageApplications` (`/applications`), `PageNewApplication` (o diálogo de `/applications`) e `PageApplicationDetail` (`/applications/$id`).
- **Telas futuras (referência para as fases 1 a 4):** `PageMasterResume`, `PageResumeVersion`, `PageHomeDashboard`, `PageInsights`, `PageCommandPalette`.
- **Capa:** `components/Cover`.

## Decisões que este design toma

- Accent verde-petróleo (`oklch(0.5 0.08 195)` no claro, `oklch(0.74 0.105 195)` no escuro) no lugar do placeholder azul-violeta; neutros levemente frios.
- Geist e Geist Mono (OFL); texto base de 13px. No app e no Storybook as duas são auto-hospedadas via `@fontsource` (AD-012); só as prévias deste diretório as carregam do Google Fonts.
- Lucide como conjunto de ícones (`lucide-react` no app).
- Oito status de candidatura, cada um com cor e ícone próprios (o anel que se preenche); a marca do Rumo Carreira usa a mesma forma.
- Os nomes de token de `packages/ui/src/styles/tokens.css` foram mantidos; os novos tokens só acrescentam.
- Todo texto passa 4.5:1 e toda borda de controle e anel de foco passam 3:1, nos dois temas (conferido por script).

## Pendências

- Logotipo vetorizado: o texto "rumo carreira" ainda não foi contornado a partir da Geist; hoje o logotipo é o símbolo + texto em Geist.
- Disponibilidade do nome Rumo Carreira (domínio, INPI, organização no GitHub) não foi verificada.
