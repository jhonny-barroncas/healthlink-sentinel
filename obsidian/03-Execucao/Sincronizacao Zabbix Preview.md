# Sincronização Zabbix — preview

Em 2026-08-06 foi criada a rota autenticada `POST /v1/integrations/zabbix/sync-preview`.

Ela consulta hosts e problemas reais no Zabbix, conta quantos hosts já possuem mapeamento em `zabbix_host_mappings` e devolve problemas normalizados para validação. Nesta fase não grava eventos nem altera estados, evitando associação incorreta antes do inventário ser mapeado.

Próximo passo: cadastrar os mapeamentos entre `hostid` do Zabbix e cada equipamento HealthLink; depois ativar a sincronização persistente e a correlação de alertas.
