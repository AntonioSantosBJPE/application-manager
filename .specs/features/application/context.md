# Application Context

**Gathered:** 2026-11-08
**Spec:** `.specs/features/application/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Vaga e candidatura com skills, nível, status e linha do tempo: API do módulo `applications`, lista `/applications`, diálogo de cadastro, detalhe `/applications/$id`, a sugestão de sem retorno, o botão do passo 03 da home e a contagem de vagas no catálogo de skills do admin. Nada que dependa do currículo.

---

## Implementation Decisions

### Partes que dependem do currículo

- Omitidas até MasterResume, ResumeVersion e ResumeDocument existirem; sem `submittedDocumentId` no contrato agora (AD-017). Usuário: "Omitir até existirem".

### "Ainda não" na sugestão de sem retorno

- Adia 21 dias e grava `ghost_snoozed_until`; sem evento (AD-020). Usuário: "Adia 21 dias, salvo".

### Categoria da skill privada criada no diálogo

- O menu troca para as sete categorias e um clique cria. Usuário: "Escolher na hora".

### Editar a vaga

- "⋯" da topbar do detalhe → "Editar vaga" (diálogo da criação, preenchido) e "Excluir candidatura"; "+ Skill" e "×" editam as skills no detalhe. Usuário: "Menu ⋯ → Editar vaga".

### Chip "Filtro" da lista

- Filtro por status, seleção múltipla. Usuário: "Filtro por status". Restrito aos status da aba atual: default do agente.

### Etapa na linha do tempo

- "Etapa {tipo}" + nota, sem "concluída" (AD-018). Usuário: "'Etapa RH' + nota".

### Ordenação e menu da linha

- Ordenação "Última atividade" / "Cadastro"; menu "⋯" e clique direito com Status e Nível. Usuário: "Ordenação + menu na linha".

### Pendências de fatias anteriores

- Botão "Nova candidatura" no passo 03 da home (AD-021) e "N vagas" no catálogo do admin (AD-019). Usuário: "Os dois". No design, o grupo "Mais usadas" e a ordem por uso saíram: "Uma listagem simples, sem carregar primeiro as mais usadas resolve o problema?" → "Sim".

### Agent's Discretion

Nenhuma área foi delegada; os defaults restantes estão na tabela de assumptions do spec com `n`, para o usuário corrigir.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma recusada. Os defaults não perguntados (limites, paginação, rótulos, textos de estado vazio e erro, larguras) estão no spec.

---

## Specific References

As cartas `PageApplications`, `PageNewApplication`, `PageApplicationDetail` e `PageSkills` do Prumo, salvas em `captures/`. Meta da carta do diálogo: cadastrar em menos de 2 minutos.

---

## Deferred Ideas

- Defeito de acessibilidade achado na passada de correções (2026-11-08): depois de mudar o status pelo menu da linha, a linha muda de grupo e o foco vai para o `body`. Todos os controles continuam alcançáveis pelo teclado, mas o foco deveria voltar à linha movida. Fica para uma correção própria.
