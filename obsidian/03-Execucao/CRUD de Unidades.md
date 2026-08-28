---
type: implementation
status: ready
updated: 2026-08-06
---

# CRUD de Unidades

## Endpoints implementados

- `GET /v1/units` — lista unidades do tenant.
- `GET /v1/units/:id` — detalha uma unidade.
- `POST /v1/units` — cria unidade.
- `PATCH /v1/units/:id` — atualiza unidade.
- `DELETE /v1/units/:id` — exclui permanentemente a unidade e os dados operacionais dependentes em cascata.

Todos exigem JWT, verificam permissões RBAC e gravam auditoria nas alterações. A exclusão permanente é transacional, limitada ao tenant, remove alertas/eventos e deixa o PostgreSQL cascatear equipamentos, vínculos, agentes, snapshots e telemetrias. A validação exige código, nome, UF, cidade e coordenadas opcionais.

## Próximo passo

Testar os endpoints usando o token do sysadmin e implementar o CRUD de equipamentos.
