# API Operacional de Alertas

Data: 2026-08-06

## Implementado

Endpoint autenticado:

`GET /v1/monitoring/alerts`

Permite filtrar por status (`open`, `acknowledged`, `resolved`, `suppressed`) e limitar a quantidade retornada (1 a 200). A resposta inclui unidade, equipamento, severidade, datas, integração e payload original.

O endpoint respeita o tenant do token e exige a permissão `alerts.read`.

## Validação

`npm.cmd run typecheck` executado com sucesso.

## Próximo passo

Criar o agendador automático da sincronização Zabbix e, depois, os endpoints de reconhecimento e encerramento de alertas.
