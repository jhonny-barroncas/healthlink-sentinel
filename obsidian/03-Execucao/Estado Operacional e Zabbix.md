# Estado Operacional e Zabbix

## Implementado em 2026-08-06

Foi criada a primeira fundação do módulo de monitoramento operacional.

### Fluxo

`Zabbix (futuro) → adapter → POST /v1/monitoring/events → monitoring_events → equipment_status_snapshots → agregação por unidade`

O backend continua sendo o único ponto de contato do frontend. A rota de eventos recebe um formato normalizado, permitindo trocar o transporte do Zabbix sem acoplar a interface ao fornecedor.

### Rotas disponíveis

- `GET /v1/monitoring/equipment`: estado atual de cada equipamento ativo.
- `GET /v1/monitoring/units`: estado agregado de cada unidade (online, degradada, offline ou desconhecida).
- `POST /v1/monitoring/events`: entrada controlada de evento normalizado; exige `integrations.manage`.

### Persistência

- `monitoring_events`: trilha idempotente dos eventos recebidos, com payload original.
- `metric_samples`: base para séries temporais de métricas (CPU, memória, latência, sinal etc.).
- `equipment_status_snapshots`: último estado operacional por equipamento.
- `unit_status_snapshots` e `alerts`: já previstos no modelo e serão atualizados na próxima etapa de regras de correlação.

### Contrato mínimo de evento

```json
{
  "equipmentId": "uuid opcional",
  "integrationId": "uuid opcional",
  "externalEventId": "id do Zabbix",
  "eventKind": "status | problem | recovery",
  "operationalStatus": "online | degraded | offline | unknown",
  "severity": 0,
  "title": "descrição",
  "observedAt": "2026-08-06T12:00:00.000Z",
  "payload": {}
}
```

### Próxima etapa

Implementar o adapter HTTP real do Zabbix, sincronização periódica (problems, events e history), atualização de `unit_status_snapshots` e criação/recuperação de alertas a partir de problemas do Zabbix.
