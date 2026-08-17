# HealthLink Sentinel

Base técnica do SaaS corporativo para monitoramento operacional de unidades móveis de saúde.

## Princípios implementados nesta fundação

- Multi-tenancy por cliente desde o banco, aplicação e políticas RLS.
- Frontend desacoplado: esta fase não contém telas.
- Zabbix tratado como fonte de coleta; o HealthLink mantém o estado operacional.
- Arquitetura modular, com jobs e adaptadores de integração isolados.
- Auditoria e RBAC como requisitos de plataforma, não complementos.

## Estrutura

```
apps/api/                 API HTTP e módulos de domínio
apps/api/database/        schema e migrations PostgreSQL
docker-compose.yml        PostgreSQL, Redis e API
docs/                     decisões de arquitetura
```

## Execução local

1. Copie `.env.example` para `.env` e defina os segredos.
2. Suba infraestrutura com `docker compose up -d postgres redis`.
3. Execute, em ordem numérica, as migrations de `apps/api/database/migrations`.
4. Instale dependências com `npm.cmd install`.
5. Inicie a API com `npm.cmd run dev`.

O endpoint `GET /health` é público. Os demais endpoints serão protegidos por autenticação e contexto de tenant.
