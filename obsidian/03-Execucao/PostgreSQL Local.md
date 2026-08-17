---
type: infrastructure
status: ready
updated: 2026-08-05
---

# PostgreSQL Local

- PostgreSQL 17.10 instalado como serviço `postgresql-x64-17`.
- Porta: `5432`.
- Banco: `healthlink`.
- Usuário de aplicação: `healthlink`.
- Migration inicial aplicada e validada.
- Configuração da API: `.env` local (não versionado).

## Próximo passo

Provisionar Redis ou ajustar temporariamente o modo de desenvolvimento para iniciar a API sem Redis; depois implementar autenticação completa.
