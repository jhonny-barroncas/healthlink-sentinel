# Sync preview validado

Em 2026-08-06, a rota `POST /v1/integrations/zabbix/sync-preview` retornou com sucesso:

```text
connected: true
hostsFound: 5
problemsFound: 0
mappedHosts: 0
unmappedHosts: 5
```

Interpretação: a integração consulta o Zabbix corretamente; não há problemas ativos; os cinco hosts ainda não foram associados a equipamentos HealthLink. O próximo trabalho é criar os mapeamentos por tenant e equipamento.
