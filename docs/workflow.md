# Workflow

Como uma feature sai do roadmap e chega à `main`.

```
roadmap → (tlc-discover / tlc-prd) → spec + design + tasks (na main, sem commitar)
  → tasks aprovadas → branch feat/<feature> → commit do plano → tasks → verificação → PR → main
```

## Onde trabalhar

| Trabalho | Onde |
|---|---|
| O que vale para o projeto inteiro: discovery (`.design/`), PRD (`.prd/`), roadmap, diretrizes, decisões de projeto (`.specs/STATE.md`) | checkout principal, branch `main` (ou uma branch `docs/*` curta) |
| Planejamento de uma feature: spec, design e tasks (`.specs/features/<feature>/`) | checkout principal, na `main`, **sem commitar** |
| Execução de uma feature: o plano commitado, código, provas e verificação | checkout principal, **uma branch `feat/<feature>` por feature**, criada a partir da `main` quando as tasks são aprovadas |

A `main` recebe código só por PR, então o plano nunca é commitado nela. Os arquivos de spec, design e tasks ficam no working tree da `main` enquanto são escritos e revisados. Quando as tasks são aprovadas, a branch `feat/<feature>` é criada a partir da `main` (os arquivos não commitados vão junto na troca) e o primeiro commit dela é o plano. O PR leva plano e código juntos.

Por que não commitar o plano na `main` local: ela ficaria à frente da `origin/main`, e o `git pull --ff-only` depois do merge quebraria.

Por que o plano não muda na `main` depois que a branch existe: o `tasks.md` é um arquivo vivo. Cada task é marcada como concluída no mesmo commit do seu código, e a verificação grava `proofs.md` e `verification.md` na pasta da feature. A partir da criação da branch, o plano só muda nela; mudar nos dois lugares geraria conflito. Um plano abandonado nunca chega à `main`, porque nunca foi commitado nela.

Revisão do plano no GitHub é opcional: para uma feature grande, faça push da branch depois do commit do plano e abra o PR em rascunho (`gh pr create --draft --base main`). O mesmo PR recebe o código depois.

## Ciclo de uma feature

1. **Partir da `main` atualizada**, no checkout principal:
   ```bash
   git switch main
   git pull --ff-only
   ```

2. **Abrir o agente de código no checkout principal.** Qualquer agente que leia o [AGENTS.md](../AGENTS.md) serve (Claude Code, Codex, Cursor, Windsurf...). Ele trabalha na `main`, sem commitar nada durante o planejamento.

3. **Especificar e planejar** com a skill `tlc-spec-driven`: spec → aprovação → design (quando a feature pede) → tasks → aprovação. Os arquivos ficam em `.specs/features/<feature>/`, não commitados.

4. **Criar a branch quando as tasks forem aprovadas** e commitar o plano como primeiro commit:
   ```bash
   git switch -c feat/<feature>
   git add .specs/features/<feature>
   git commit -m "docs(specs): plan <feature>"
   ```

5. **Executar** com a mesma skill: um commit por task, depois as provas e a verificação independente. Faça push conforme avança (`git push -u origin feat/<feature>`).

6. **Abrir o PR** (`gh pr create --base main`, ou `gh pr ready` se abriu o rascunho) e fazer o merge com o CI verde.

7. **Depois do merge**, voltar para a `main` atualizada e apagar a branch local:
   ```bash
   git switch main
   git pull --ff-only
   git branch -d feat/<feature>
   ```

Regras:
- Uma feature por vez. Se uma feature depende de outra, a segunda começa depois do merge da primeira. Isso também evita dois planos não commitados misturados no mesmo working tree.
- Planejar na `main` não inclui commitar nela: se for preciso trocar de branch no meio do planejamento, guarde os arquivos (`git stash -u`) ou crie a branch da feature antes.
- Uma decisão de projeto (`AD-NNN` em `.specs/STATE.md`) tomada dentro de uma feature chega à `main` com o PR dela.

## Gates e tempo

Os gates têm orçamento de tempo; se um estoura, o gate muda, não a paciência.

| Camada | Quando | Orçamento | O que roda |
|---|---|---|---|
| Commit | a cada commit | até 30 s | `pnpm lint`, `pnpm typecheck`, `pnpm test` (inclui as verificações de padrão de `tooling/guardrails/src/code-patterns.test.ts`) |
| PR | CI, jobs em paralelo | até 3 min | sempre: lint, typecheck, `pnpm test`, `pnpm test:integration`, scan de segredos, actionlint; pelo escopo do PR: `pnpm test:repo-rules`, E2E e infraestrutura |
| Push na `main` | Deploy, antes de publicar | até 4 min de gates | todas as suítes, sem escopo |
| Fim da feature | uma vez | ~3 min | os gates acima, `pnpm test:e2e` local e a revisão independente (Verifier) lendo o diff e os testes |

- **Este projeto não usa `check_proofs.py` nem `validate_verification.py` para fechar uma feature.** Rodar todas as provas de novo a cada commit custou mais de 35 min numa spec sem acrescentar nada ao que o CI e a revisão já provam. A skill continua intacta em `.agents/skills/`; só não é parte do fluxo daqui.
- A rastreabilidade (critério → check → teste) continua em `spec.md` e `tasks.md`, e a revisão independente continua: o Verifier julga se o teste de cada check segura o critério e registra o que achou em `verification.md`.
- Regra de qualidade vira script rápido, não rodada longa: quando o lint não pega um padrão (teste pulado, `console`, componente sem story, controle HTML cru), acrescenta-se uma verificação em `code-patterns.test.ts`.

### Como o CI se mantém dentro do orçamento quando o projeto cresce

O tempo do CI não pode crescer junto com o número de features. Cada suíte tem um mecanismo que a mantém plana (AD-025):

- **Escopo por caminho** (`scripts/ci-scopes.sh`, provado em `ci-scopes.test.ts`): no PR, `test:repo-rules` só roda quando mudam comandos e configuração da raiz (`package.json`, `turbo.json`, `tsconfig`, ESLint, Vitest, dependency-cruiser, `tooling/guardrails`); o E2E, quando muda o que vai para as imagens ou para o navegador (`apps/`, `packages/`, `tests/e2e/`, compose, lockfile); a infraestrutura, quando mudam `infra/`, Dockerfiles, migrations ou os testes de deploy. Mudar o próprio CI roda tudo. O label `ci:full` (ou a variável `CI_FULL=true`) roda tudo num PR. O push na `main` roda tudo, sempre, antes do deploy.
- **Cache do turbo no CI** (`.turbo/cache`): lint, typecheck e `pnpm test` de um workspace que o PR não tocou são reaproveitados, então o job de qualidade paga pelo que mudou, não pelo tamanho do monorepo.
- **E2E em shards**: o CI roda o grupo `platform` (imagens, stack, disrupção) e o grupo `browser` dividido por arquivo com `--shard`, cada um com a própria stack (`E2E_GROUP` em `tests/e2e/playwright.config.ts`). Quando um shard de browser passar de ~2 min, acrescente uma entrada na matriz do job `e2e` e suba o total de todas (`1/3`, `2/3`, `3/3`); o teste do workflow exige que os shards cubram `1..n`. Localmente, `pnpm test:e2e` continua rodando a cadeia inteira numa stack só.
- **Imagens construídas uma vez por job, sem job de build duplicado**: o job `images` saiu, porque E2E, infraestrutura e deploy já constroem as imagens. Aquecer um builder BuildKit com o cache do deploy foi medido e descartado: exportar e carregar cada imagem no Docker custou mais do que o cache economizou.
- **`test:repo-rules` com custo constante**: uma violação plantada em cada workspace e uma execução de cada comando raiz (`turbo --continue`), em vez de uma execução por workspace. Um workspace novo não acrescenta execuções.
- Cada job do CI usa a action `.github/actions/setup` (Node, pnpm, install e Chromium); um job novo a reaproveita.
- Os testes de infraestrutura de deploy (`pnpm --filter @am/guardrails test:infra`) e o E2E (`pnpm test:e2e`) também rodam localmente: rode-os ao mudar `infra/`, compose, Dockerfile, cookies ou a pilha.
- Nenhuma suíte roda o repositório inteiro dentro de um teste do `pnpm test`: isso vira `test:repo-rules`, em job próprio.
