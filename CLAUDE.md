# Application Manager

Sistema para gerenciar candidaturas, adaptar currículos (PDF ATS) e analisar skills pedidas pelo mercado. Projeto de estudo ponta a ponta e ferramenta de uso real.

Leia antes de qualquer trabalho:
- [docs/project-brief.md](docs/project-brief.md) — contexto, fases, decisões e questões abertas
- [docs/engineering-guidelines.md](docs/engineering-guidelines.md) — arquitetura, testes, portabilidade, infra, observabilidade, segurança
- [docs/design/principles.md](docs/design/principles.md) — direção visual (inspirada no Linear), arquétipos de página, o que é proibido na UI

## Regras inegociáveis

- **Repositório público.** Nunca commitar segredos, dados pessoais reais, IPs ou detalhes internos da infraestrutura. Seeds e fixtures usam dados fictícios.
- **Regra de negócio fica no Nest.** Server functions do TanStack Start são só BFF.
- **Módulos do back e features do front não importam o interior uns dos outros.**
- **UI só via `packages/ui`, com composition pattern e tokens.** Toda página usa um arquétipo; todo componente novo tem story no Storybook.
- **Toda mudança vem com testes (Vitest; Playwright no E2E).** Nunca enfraquecer ou pular teste para passar.
- **Tudo portável:** container, config por env, APIs S3-compatíveis, OpenTelemetry.
- **Currículo adaptado nunca inventa experiência:** só seleciona, reordena e reescreve o currículo mestre.

## Fluxo

`tlc-discover` (`.design/`) → `tlc-prd` (`.prd/`) → `tlc-spec-driven` por feature (`.specs/`). Backend com `nestjs-modular-monolith`.

Cada feature pode rodar no próprio worktree (`feat/<feature>`, portas próprias) via `scripts/worktree.sh` ou a skill `feature-worktree` — ver [docs/workflow.md](docs/workflow.md). A `main` recebe código só por PR.

Conversa com o usuário em português (pt-BR); identificadores de código em inglês.
