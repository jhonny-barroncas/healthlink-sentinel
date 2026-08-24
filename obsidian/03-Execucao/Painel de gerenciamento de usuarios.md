# Painel de gerenciamento de usuários

## Entrega

- Criada a área **Usuários** no menu lateral do HealthLink Sentinel.
- Listagem por cliente/tenant com nome, e-mail, perfil, status e data de acesso.
- Cadastro de usuário com nome, e-mail, senha e perfil.
- A senha é definida diretamente no formulário; no modo de edição, pode ser trocada sem depender de envio de e-mail. A senha nunca é exibida ou armazenada em texto puro.
- Edição de nome, perfil e senha.
- Bloqueio/desbloqueio por desativação lógica.
- Exclusão lógica do vínculo com o cliente; o histórico do usuário é preservado.
- Impedida a exclusão do próprio usuário logado.

## API

- `GET /v1/users`
- `POST /v1/users`
- `PATCH /v1/users/:id`
- `DELETE /v1/users/:id`

Todas as rotas exigem autenticação e a permissão `users.manage`. A implementação respeita o tenant do token e os perfis existentes: Administrador, Supervisor, Operador NOC e Visualizador.

## Verificação

- `npm.cmd run typecheck` passou.
- `npm.cmd run build:web` passou.

## Correção da listagem de bloqueados

O painel apresentava erro SQL e ficava vazio porque `ut.active` era retornado no `SELECT`, mas não estava incluído no `GROUP BY`. A consulta foi corrigida para agrupar por `u.id, ut.active`.

Usuários bloqueados continuam visíveis na lista com status bloqueado; o bloqueio apenas impede o login. O desbloqueio deve usar o botão de edição/ação de ativar, sem recriar o usuário.
## Correção do botão Excluir

O botão agora solicita confirmação e remove somente o vínculo `user_tenants` do tenant atual. O usuário sai da lista, mas o cadastro global e o histórico permanecem preservados. Bloquear continua separado e mantém o usuário visível como bloqueado.
## Correção do carregamento visual (10/08/2026)

Corrigido erro de sintaxe no CSS do painel de usuários: a regra do formulário de solicitação estava truncada (`padding`), fazendo o Vite acusar `Unclosed block` e impedir o carregamento da aplicação. A regra foi restaurada e o CSS separado da media query responsiva.

Validação concluída com `npm run typecheck` e `npm run build:web`.
## Ajuste do cabeçalho (10/08/2026)

Removido o botão visual de troca de tema do cabeçalho para manter o produto em modo escuro corporativo e evitar o ícone solto no topo. O perfil do usuário permanece disponível.

## Correção do cadastro e auto-bloqueio (19/08/2026)

O formulário deixou de exigir CPF e coligada, pois esses campos não fazem parte do contrato atual da API e impediam o cadastro de usuários válidos. A mensagem de sucesso também foi ajustada para refletir que a senha é definida diretamente no formulário. A API agora impede que o usuário logado bloqueie a própria conta, mantendo a proteção já existente contra autoexclusão.

Foi adicionada validação automatizada para o formulário, cobrindo criação sem campos desconectados do modelo e senha obrigatória apenas no cadastro.

## Validação e mensagens amigáveis (24/08/2026)

As mensagens de erro de autenticação e da API não expõem mais o payload bruto de validação no painel. O frontend traduz erros conhecidos para textos operacionais, sem exibir JSON, detalhes internos ou SQL. E-mail passou a ter limite de 254 caracteres e senha de 8 a 200 caracteres na autenticação, criação/edição de usuários e solicitação de acesso. A API aplica os mesmos limites com Zod.

As consultas de usuários continuam usando parâmetros posicionais; a atualização dinâmica de usuário aceita somente nomes de colunas definidos internamente pelo código. Foi adicionada cobertura automatizada para mensagens amigáveis, rejeição de e-mail inválido e limites de senha.
