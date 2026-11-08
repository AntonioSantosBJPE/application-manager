Entrar: `/login` (member) e `/admin/login` (admin), mesmo layout com outro título.

- Arquétipo `AuthPage`. Monograma, "Entrar" em `heading-xl`, o nome do produto abaixo.
- Estado mostrado: voltando de sessão expirada (`?reason=expired`), com `Alert` `info` acima dos campos.
- Erro de credencial: `Alert` `danger` no mesmo lugar ("E-mail ou senha incorretos."); bloqueio (429) diz quando tentar de novo.
- Rodapé explica o acesso por convite e o caminho para senha esquecida.
- O que mudou: título com hierarquia, coluna fixa de 360px, botão de largura total, rodapé com orientação.
