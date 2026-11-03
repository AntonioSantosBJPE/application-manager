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
