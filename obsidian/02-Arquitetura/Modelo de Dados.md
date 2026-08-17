---
type: architecture
status: accepted
---

# Modelo de Dados

## Limites principais

`tenant → health_units → equipment → status snapshots / alerts`

## Entidades

- Tenant, usuário, papel, permissão e vínculo usuário-cliente.
- Unidade móvel e equipamento.
- Equipamento pode registrar `contracted_download_mbps` e `contracted_upload_mbps` opcionais como dados comerciais confirmados do link; telemetria não preenche esses campos.
- Integração e vínculo host Zabbix–equipamento.
- Snapshot de status da unidade e do equipamento.
- Alerta, evento de alerta e log de auditoria.

## Isolamento

As entidades de domínio têm `tenant_id`. A API define o contexto do tenant por requisição e o PostgreSQL aplica RLS. O esquema efetivo está em `apps/api/database/migrations/001_initial.sql`.

## Saúde das integrações

`integration_sync_status` mantém uma projeção por integração e tenant com última tentativa, última coleta válida, falhas consecutivas, último erro e contadores da sincronização. A tabela foi adicionada pela migration `006_integration_sync_status.sql` e também possui RLS.
