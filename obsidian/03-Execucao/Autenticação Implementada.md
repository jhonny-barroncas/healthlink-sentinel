---
type: implementation
status: foundation
updated: 2026-08-05
---

# Autenticação Implementada

## Entregue

- Hash de senha com `scrypt` e comparação em tempo constante.
- Login por email e senha.
- Seleção de tenant no login quando o usuário possui mais de um vínculo.
- JWT de curta duração com `userId`, `tenantId` e papéis.
- Refresh token opaco, armazenado apenas como hash.
- Revogação de sessão no logout.
- Endpoint autenticado `/v1/auth/me`.
- Tabela `user_sessions` e permissões base aplicadas na migration `002_auth_sessions.sql`.

## Endpoints

- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

## Validação

Migration aplicada no PostgreSQL local e `npm run typecheck` aprovado.

## Próximo passo

Criar o comando seguro de provisionamento do primeiro Administrador Global e então implementar CRUD de clientes, usuários, unidades e equipamentos.
