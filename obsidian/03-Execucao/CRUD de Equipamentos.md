---
type: implementation
status: ready
updated: 2026-08-06
---

# CRUD de Equipamentos

## Tipos cadastrados

- `linux_server` — Servidor Linux
- `mikrotik` — Mikrotik
- `starlink` — Starlink
- `vpn` — VPN
- `internet_link` — Link de internet

## Endpoints implementados

- `GET /v1/units/:unitId/equipment` — lista equipamentos da unidade.
- `POST /v1/units/:unitId/equipment` — cria e vincula equipamento.
- `PATCH /v1/equipment/:id` — atualiza equipamento.
- `DELETE /v1/equipment/:id` — desativa sem apagar histórico.

Todos exigem JWT, respeitam o tenant com filtros explícitos na aplicação, verificam RBAC e gravam auditoria. A migration `003_equipment_types.sql` foi aplicada no PostgreSQL local.

## Próximo passo

Criar equipamentos fictícios para as unidades, validar os endpoints e depois iniciar o modelo de métricas/estado operacional para a integração Zabbix.

## Banda contratada do link — 2026-08-11

- A migration `007_equipment_contracted_bandwidth.sql` adicionou ao equipamento os campos opcionais `contracted_download_mbps` e `contracted_upload_mbps`.
- Os valores são armazenados em Mbps com precisão decimal, devem ser maiores que zero e permanecem isolados pelo `tenant_id` do próprio equipamento.
- `POST /v1/units/:unitId/equipment` e `PATCH /v1/equipment/:id` aceitam `contractedDownloadMbps` e `contractedUploadMbps` opcionais.
- O cadastro e a edição exibem esses campos para Mikrotik, Starlink, VPN e link de internet. Campo vazio significa informação não cadastrada e deve aparecer como `N/D`.
- A banda contratada é exclusivamente cadastral. Ela não pode ser inferida de `net.if.speed`, `net.if.in`, `net.if.out` ou de teste pontual de velocidade.
- As alterações continuam protegidas por JWT, permissão `units.manage`, escopo de tenant/RLS e auditoria do CRUD de equipamento.
