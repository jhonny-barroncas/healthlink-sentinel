# Solicitação e aprovação de acesso

- Login agora possui o link `Criar conta (sujeito a aprovação)`.
- A solicitação abre em janela flutuante glassmorphism.
- O pedido é salvo como pendente na API.
- Usuários com `users.manage` acessam o botão **Aprovações** na área de usuários.
- Aprovar cria o usuário, vínculo ao tenant e perfil selecionado.
- Rejeitar encerra a solicitação sem criar acesso.
- A tabela `access_requests` é criada automaticamente pela API na inicialização.

Rotas: `POST /v1/access-requests`, `GET /v1/users/access-requests`, `POST /v1/users/access-requests/:id/approve` e `DELETE /v1/users/access-requests/:id`.
