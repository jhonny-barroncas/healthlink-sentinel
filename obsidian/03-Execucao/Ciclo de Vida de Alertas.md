# Ciclo de Vida de Alertas

Data: 2026-08-06

## Endpoints implementados

- `POST /v1/monitoring/alerts/:id/acknowledge` — reconhece um alerta aberto e registra o usuário responsável.
- `POST /v1/monitoring/alerts/:id/resolve` — encerra um alerta e registra o evento operacional.

Ambos exigem autenticação, permissão `alerts.acknowledge` e validam o tenant do token.

## Validação

`npm.cmd run typecheck` executado com sucesso.

## Próximo passo

Implementar a execução automática da sincronização Zabbix em um worker seguro.
