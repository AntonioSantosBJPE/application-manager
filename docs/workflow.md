# Workflow

Como uma feature sai do roadmap e chega à `main`.

```
roadmap → (tlc-discover / tlc-prd) → branch feat/<feature> → tlc-spec-driven → PR → main
```

## Onde trabalhar

| Trabalho | Onde |
|---|---|
| O que vale para o projeto inteiro: discovery (`.design/`), PRD (`.prd/`), roadmap, diretrizes, decisões de projeto (`.specs/STATE.md`) | checkout principal, branch `main` (ou uma branch `docs/*` curta) |
| O que é de uma feature: spec, design, tasks, código, provas e verificação (`.specs/features/<feature>/`) | checkout principal, **uma branch `feat/<feature>` por feature**, criada a partir da `main` |

A `main` recebe código só por PR. Cada feature vive na sua branch do começo (spec) ao fim (verificação), então o plano chega à `main` junto com o código que o implementa.

Por que o plano não fica na `main`: o `tasks.md` é um arquivo vivo. Cada task é marcada como concluída no mesmo commit do seu código, e a verificação grava `proofs.md` e `verification.md` na pasta da feature. Com o plano na `main`, ele mudaria em dois lugares e geraria conflito; um plano abandonado também ficaria para trás na `main`, em vez de morrer com a branch.

**Revisar o plano antes do código:** quando as tasks forem aprovadas, faça push da branch e abra o PR como rascunho (`gh pr create --draft --base main`) só com spec, design e tasks. O plano fica visível para revisão no GitHub, e o mesmo PR recebe o código depois.

Exceção registrada: a spec do `walking-skeleton` foi escrita na `main`, antes de este fluxo existir. A partir dela, design e tasks seguem na branch.

## Ciclo de uma feature

1. **Criar a branch** a partir da `main` atualizada, no checkout principal:
   ```bash
   git switch main
   git pull --ff-only
   git switch -c feat/<feature>
   ```

2. **Abrir o agente de código no checkout principal.** Qualquer agente que leia o [AGENTS.md](../AGENTS.md) serve (Claude Code, Codex, Cursor, Windsurf...). Ele trabalha na branch `feat/<feature>`.

3. **Especificar e planejar** com a skill `tlc-spec-driven`: spec → aprovação → design (quando a feature pede) → tasks → aprovação. Spec, design e tasks são commitados na branch.

4. **Abrir o PR em rascunho com o plano** (opcional, recomendado para features grandes):
   ```bash
   git push -u origin feat/<feature>
   gh pr create --draft --base main
   ```

5. **Executar** com a mesma skill: um commit por task, depois as provas e a verificação independente. Faça push conforme avança.

6. **Marcar o PR como pronto** (`gh pr ready`, ou `gh pr create --base main` se não abriu o rascunho) e fazer o merge com o CI verde.

7. **Depois do merge**, voltar para a `main` atualizada e apagar a branch local:
   ```bash
   git switch main
   git pull --ff-only
   git branch -d feat/<feature>
   ```

Regras:
- Uma feature por vez. Se uma feature depende de outra, a segunda começa depois do merge da primeira.
- Uma decisão de projeto (`AD-NNN` em `.specs/STATE.md`) tomada dentro de uma feature chega à `main` com o PR dela.
