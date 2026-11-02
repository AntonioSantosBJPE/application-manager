# Workflow

Como uma feature sai do roadmap e chega à `main`.

```
roadmap → (tlc-discover / tlc-prd) → worktree → tlc-spec-driven → PR → main
```

## Onde trabalhar

| Trabalho | Onde |
|---|---|
| Discovery, PRD, roadmap, diretrizes | checkout principal, branch `main` (ou uma branch `docs/*` curta) |
| Spec, tasks e implementação de uma feature | **um worktree por feature**, branch `feat/<feature>` |

A `main` recebe código só por PR. Cada feature vive na sua branch do começo (spec) ao fim (verificação), então a spec chega à `main` junto com o código que a implementa.

## Ciclo de uma feature em worktree

1. **Criar o worktree** (no checkout principal):
   ```bash
   scripts/worktree.sh new <feature>
   ```
   Cria `../application-manager.worktrees/<feature>` na branch `feat/<feature>`, gera o `.env` com portas próprias e instala as dependências.

2. **Abrir o agente de código no worktree.** Qualquer agente que leia o [AGENTS.md](../AGENTS.md) serve (Claude Code, Codex, Cursor, Windsurf...): abra uma sessão ou janela apontando para a pasta do worktree. No terminal, por exemplo:
   ```bash
   cd ../application-manager.worktrees/<feature>
   ```
   e inicie o agente ali.

3. **Especificar e executar** com a skill `tlc-spec-driven`: spec → aprovação → tasks → aprovação → execução com um commit por task → verificação. Tudo fica na branch da feature.

4. **Publicar e abrir o PR**:
   ```bash
   git push -u origin feat/<feature>
   gh pr create --base main
   ```

5. **Depois do merge, remover o worktree** (no checkout principal):
   ```bash
   scripts/worktree.sh remove <feature>
   ```
   Derruba os containers e volumes do worktree, remove a pasta e apaga a branch se já estiver mergeada.

Worktree criado por outra ferramenta (por exemplo, um agente que já abre a sessão num worktree próprio)? Rode `scripts/worktree.sh init` dentro dele para gerar `.env` e portas.

## Várias features ao mesmo tempo

Cada worktree recebe um **slot** e roda sua própria stack sem conflito:

| Slot | Onde | web | api | postgres | Projeto do compose |
|---|---|---|---|---|---|
| 0 | checkout principal | 3000 | 3333 | 5432 | padrão |
| n | worktree | 3000 + 10n | 3333 + 10n | 5432 + 10n | `am-<feature>` |

`scripts/worktree.sh list` mostra os worktrees, as branches e os slots.

Regras:
- Duas features em paralelo só quando não tocam os mesmos arquivos. Se uma depende da outra, a segunda espera o merge da primeira.
- Depois de um merge na `main`, atualize os worktrees abertos com `git rebase main` (ou `git merge main`) antes de continuar.
- Uma decisão de projeto (`AD-NNN` em `.specs/STATE.md`) tomada dentro de uma feature chega à `main` com o PR dela; outras features em andamento a recebem no próximo rebase.
