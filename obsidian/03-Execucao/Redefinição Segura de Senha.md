# Redefinição Segura de Senha

Data: 2026-08-06

Foi criado o utilitário local `admin:reset-password` para redefinir senhas diretamente no PostgreSQL.

## Segurança

- A senha é digitada localmente em uma janela protegida.
- Somente o hash é gravado no banco.
- A senha não é armazenada no código, terminal, documentação ou Obsidian.
- O usuário precisa existir e estar ativo.

O utilitário fica em `apps/api/src/scripts/reset-password.ts`.
