# Correção da Integração Zabbix

Data: 2026-08-07

## Problema

Cada chamada de sincronização criava uma nova linha de integração Zabbix. O mapeamento era gravado em uma integração e a sincronização seguinte consultava outra, resultando em `unmapped: 1`.

## Correção

- `ensureZabbixIntegration` agora reutiliza uma integração ativa estável por tenant.
- As integrações duplicadas do tenant HealthLink Demo foram consolidadas.
- O mapeamento do host `10084` foi preservado no equipamento `Zabbix Server`.
- Foi criado índice único para impedir novas duplicações.
- Typecheck concluído com sucesso.

## Próximo teste

Reiniciar o processo da API para carregar o código atualizado e executar novamente `POST /v1/integrations/zabbix/sync`. O esperado é `unmapped: 0` e `persisted: 1`.
