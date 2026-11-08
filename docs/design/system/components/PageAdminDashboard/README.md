Painel do admin: `/admin`.

- Arquétipo `DashboardPage`. Widgets: status do sistema (API e banco com `StatusBadge` e horário da verificação em `mono`) e convites pendentes (número grande + o mais antigo a expirar + "Convidar pessoa") e skills privadas aguardando promoção (até oito `SkillTag` privadas, "e mais N" e a ação "Abrir catálogo" para `/admin/skills`).
- Cada widget leva à sua tela com uma ação `ghost` no cabeçalho.
