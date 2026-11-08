Convites: `/admin/invitations`, logo depois de criar um convite.

- Arquétipo `ListPage`. A linha de filtros vira o formulário de convite (e-mail + "Convidar").
- O link recém-criado aparece numa faixa `surface-raised` com `CopyField` e o aviso de que só aparece uma vez.
- Pendentes em linhas de 40px: e-mail, quem convidou, quanto falta para expirar (em `warning` quando faltam ≤ 2 dias) e "Revogar" `ghost`, que abre o `ConfirmDialog`.
