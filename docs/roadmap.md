# Roadmap

> Sem datas, só ordem. Um item sobe para **Agora** quando a anterior está em uso; ao subir, passa pelo fluxo `tlc-discover` → `tlc-prd` → `tlc-spec-driven`.
> Cada item registra **por que não agora** e **o que o tornaria prioridade**.

## Agora

| Item | Fase |
|---|---|
| Fundação: monorepo, CI, walking skeleton, VPS com deploy automático, auth | 0 |
| Candidaturas: vagas, pipeline de status, skills normalizadas | 1 |
| Currículo mestre + versão por candidatura + PDF ATS (sem IA) | 2 |

## Próximo

| Item | Fase | Por que não agora | O que antecipa |
|---|---|---|---|
| IA: extrair skills da descrição da vaga | 3 | Cadastro manual precisa provar o modelo de skills primeiro | Cadastrar uma vaga passar de ~5 min |
| IA: currículo adaptado assistido | 3 | A pré-seleção determinística pode bastar | Adaptação continuar acima de 10 min |
| Insights: skills mais pedidas por nível | 4 | Precisa de volume de vagas cadastradas | ~30 vagas cadastradas |
| Roadmap de estudo derivado das vagas | 4 | Depende dos insights | Insights em uso |

## Depois

| Item | Fase | Por que não agora | O que antecipa |
|---|---|---|---|
| Busca automática de vagas (fontes permitidas) | 5 | Maior complexidade, menor valor imediato | Cadastro manual virar o gargalo |
| Extrair `documents` ou `sourcing` como microsserviço | — | Exercício de estudo, sem necessidade real | Fases 0–2 estáveis em produção |

## Ideias

Ideias sem fase definida. Entram em **Próximo** quando houver um motivo concreto.

| Ideia | Por que não agora | O que antecipa |
|---|---|---|
| Currículo multi-idioma (pt-BR + inglês) | Todas as vagas atuais são em pt-BR (o campo `locale` já existe) | Primeira vaga em inglês que valha a candidatura |
| Mais templates de PDF | Um template ATS bem feito cobre o objetivo | Feedback de que o template atual limita alguma vaga |
| Cadastro aberto (sem convite) | Dados pessoais expostos na internet; obrigações de LGPD | Decisão de virar SaaS |
| Envio de e-mail (convites, recuperação de senha) | Convite por link copiado e reset por linha de comando bastam com poucos usuários | Primeiro usuário além do autor |
| Login social / 2FA | Sessão com senha basta para uso pessoal | Cadastro aberto |
| Erro em produção → issue → PR automático (Sentry + agente) | Precisa de observabilidade e testes maduros | Suite de testes estável e erros recorrentes em produção |
