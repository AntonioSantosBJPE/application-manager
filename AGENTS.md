# AGENTS.md

Instruções para qualquer agente de código (Claude Code, Codex, Cursor, Windsurf e outros) que trabalhe neste repositório.

## Projeto

Sistema para gerenciar candidaturas, adaptar currículos (PDF ATS) e analisar as skills pedidas pelo mercado. É ao mesmo tempo projeto de estudo ponta a ponta e ferramenta de uso real.

Leia antes de qualquer trabalho:
- [docs/project-brief.md](docs/project-brief.md) — contexto, fases e decisões de produto
- [docs/engineering-guidelines.md](docs/engineering-guidelines.md) — arquitetura, testes, portabilidade, infra, observabilidade, segurança
- [docs/design/principles.md](docs/design/principles.md) — direção visual, arquétipos de página, o que é proibido na UI
- [.design/application-manager.md](.design/application-manager.md) — design confirmado das fases 0 a 2 (fatias, schema, contratos)
- [docs/workflow.md](docs/workflow.md) — como uma feature vai do roadmap à `main`

## Regras inegociáveis

- **Repositório público.** Nunca commitar segredos, dados pessoais reais, IPs ou detalhes internos da infraestrutura. Seeds e fixtures usam dados fictícios.
- **Regra de negócio fica no Nest.** Server functions do TanStack Start são só BFF.
- **Módulos do back e features do front não importam o interior uns dos outros.**
- **UI só via `packages/ui`, com composition pattern e tokens.** Toda página usa um arquétipo; todo componente novo tem story no Storybook.
- **Toda mudança vem com testes (Vitest; Playwright no E2E).** Nunca enfraquecer, pular ou apagar teste para fazê-lo passar.
- **Tudo portável:** container, config por env, APIs S3-compatíveis, OpenTelemetry.
- **Currículo adaptado nunca inventa experiência:** só seleciona, reordena e reescreve o currículo mestre.
- **A `main` recebe código só por PR.** Push, deploy e qualquer operação remota ou destrutiva precisam de autorização explícita do usuário.

## Fluxo

`tlc-discover` (`.design/`) → `tlc-prd` (`.prd/`) → `tlc-spec-driven` por feature (`.specs/`). Backend com `nestjs-modular-monolith`; manutenção com `codenavi`.

Spec, design e tasks de uma feature são escritos na `main`, sem commitar. Quando as tasks são aprovadas, cria-se a branch `feat/<feature>` a partir da `main` no checkout principal; o plano é o primeiro commit dela e o código vem depois, até o PR — ver [docs/workflow.md](docs/workflow.md).

## Skills

As skills ficam em `.agents/skills/` (formato aberto, lido por vários agentes) e são espelhadas em `.claude/skills/` para o Claude Code; as duas cópias têm o mesmo conteúdo. Se o seu agente não carrega skills, leia o `SKILL.md` da skill indicada e siga-o como instrução.

| Skill | Quando |
|---|---|
| `tlc-discover` | transformar uma ideia em decisões e design |
| `tlc-prd` | fechar o escopo de produto de uma ideia |
| `tlc-spec-driven` | especificar, planejar, implementar e verificar uma feature |
| `nestjs-modular-monolith` | desenhar módulos do backend |
| `codenavi` | investigar e corrigir código existente |

Os scripts das skills são Python 3 (só biblioteca padrão) e rodam a partir da raiz do projeto.

## Convenções

- Conversa com o usuário em português (pt-BR); identificadores de código em inglês.
- Conventional Commits.
