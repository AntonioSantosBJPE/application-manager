# Project Brief — Application Manager

> Entrada para a discovery (`tlc-discover`). Registra o contexto e as decisões já alinhadas; o que ainda está aberto fica em **Questões para a discovery**.
>
> Alinhado em 2026-11-02.

## Contexto

Desenvolvedor full stack (Node.js, React, Next.js, Tailwind, shadcn/ui, SQL) se preparando para uma possível recolocação. O projeto tem dois objetivos de peso igual:

1. **Conhecimento** — entregar de ponta a ponta: produto, arquitetura, infraestrutura própria (VPS), CI/CD, observabilidade, segurança e IA.
2. **Ferramenta real** — um sistema usado no dia a dia da busca por vagas.

Não há prazo. O foco é aprender bem; o sistema evolui aos poucos.

## Problema

Gerenciar candidaturas, adaptar o currículo para cada vaga e entender quais tecnologias o mercado está pedindo é um trabalho manual, espalhado e difícil de analisar.

## Visão por fases

O que está em andamento e as ideias futuras ficam em [roadmap.md](roadmap.md).

| Fase | Entrega |
|---|---|
| 0. Fundação | Monorepo, CI, walking skeleton, VPS com deploy automático, auth |
| 1. Candidaturas | Cadastro de vagas, pipeline de status, skills (técnicas e soft) da vaga como tags normalizadas |
| 2. Currículo | Currículo mestre estruturado e geração de PDF no formato ATS, sem IA |
| 3. IA | Extração de skills da descrição da vaga; currículo adaptado por vaga, com revisão humana antes de exportar |
| 4. Insights | Skills mais pedidas por nível técnico; roadmap de estudo derivado das vagas |
| 5. Automação | Busca automática de vagas em fontes que permitem (APIs/páginas públicas; LinkedIn proíbe scraping) |

Regra de domínio da fase 3: o currículo adaptado **seleciona, reordena e reescreve** o que existe no currículo mestre. Nunca inventa experiência.

## Decisões já tomadas

- **Prioridade de futuro:** portfólio público vem antes de virar SaaS. Se virar SaaS, o repositório passa a ser privado.
- **Multiusuário desde a modelagem:** dados sempre pertencem a um usuário, mesmo com um único usuário no início.
- **IA começa manual:** tudo funciona sem IA; ela entra como assistência. Há chaves Gemini/OpenRouter e créditos Claude disponíveis.
- **Stack:** TanStack Start no front (escolhido para aprender SSR fora do Next), NestJS como monolito modular no back, PostgreSQL. Detalhes em [engineering-guidelines.md](engineering-guidelines.md).
- **Infra:** VPS própria (2 vCPU/8 GB, ou 4 vCPU/8 GB) com Coolify, domínio próprio, Cloudflare free (DNS, proxy/WAF, R2 para backups).
- **Cronograma:** VPS e domínio contratados por volta de 2026-11-05. Até lá, tudo local; depois disso, o pipeline de deploy vira prioridade.

## Fora de escopo (por enquanto)

- Cobrança, planos e qualquer coisa de SaaS comercial.
- Scraping de plataformas que proíbem nos termos de uso.
- App mobile.

## Questões para a discovery

> Respondidas em [.design/application-manager.md](../.design/application-manager.md), exceto a licença, que segue pendente.

- Modelo de auth com SSR: cookie em subdomínios (`app.` / `api.`) ou Start como proxy (BFF)?
- Biblioteca de auth: própria no Nest ou solução pronta (ex.: Better Auth)?
- Taxonomia de skills: lista fechada, livre com normalização, ou híbrida? Como tratar sinônimos ("Node", "Node.js", "NodeJS")?
- Status do pipeline de candidatura: quais estados e transições?
- Geração de PDF ATS: HTML → PDF (Gotenberg/Playwright), react-pdf ou Typst?
- ORM: Drizzle (preferência inicial) ou Prisma?
- Métrica de sucesso pessoal: como saber que o sistema está ajudando na busca?
- Licença do repositório (ver [engineering-guidelines.md](engineering-guidelines.md#segurança-e-repositório-público)).
