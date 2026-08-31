# Sincronização Zabbix Persistente

Data: 2026-08-06

## Implementado

- Endpoint `POST /v1/integrations/zabbix/sync`.
- Consulta problemas recentes no Zabbix com os hosts relacionados.
- Usa somente os hosts previamente mapeados no tenant.
- Persiste alertas em `alerts` e o histórico em `alert_events`.
- Persiste eventos normalizados em `monitoring_events`.
- Atualiza `equipment_status_snapshots`.
- Recalcula `unit_status_snapshots`, incluindo contagem de alertas ativos.
- Problemas de hosts sem mapeamento são contabilizados como `unmapped` e não alteram unidades.

## Resultado esperado

O host Zabbix `10084`, associado ao equipamento **Zabbix Server** da unidade `ZBX-001`, passa a atualizar o estado operacional e os alertas quando houver problemas no Zabbix.

## Validação

`npm.cmd run typecheck` executado com sucesso.

## Compatibilidade Zabbix 7.4.1

O método `problem.get` não aceita `selectHosts` nesta versão. A implementação foi ajustada para consultar os problemas com `problem.get` e buscar os hosts relacionados com `event.get`.

## Próximo passo

Testar o endpoint com o JWT do HealthLink e, em seguida, criar a rotina agendada de sincronização (worker/cron), antes de iniciar as telas frontend.

## Correção 2026-08-31

O scheduler interno passou a usar `app.inject` para executar as rotas persistentes de sincronização e telemetria. Isso elimina a dependência do protocolo e da porta publicados pelo container e corrige a falha no servidor, onde a API interna usa HTTPS. O comportamento foi coberto em `apps/api/src/modules/integrations/zabbix/internal-request.test.ts`.
