# Mapeamento Zabbix → equipamentos

Em 2026-08-06 foram implementadas as rotas para preparar o vínculo entre inventário Zabbix e equipamentos HealthLink:

- `GET /v1/integrations/zabbix/mapping-candidates`: retorna hosts, equipamentos ativos e vínculos existentes.
- `POST /v1/integrations/zabbix/mappings`: salva ou atualiza um vínculo por `zabbixHostId` e `equipmentId`.

O backend cria/recupera a integração Zabbix do tenant sem armazenar o token; o segredo continua no `.env`. O vínculo é validado contra o tenant e requer `integrations.manage`.

Próximo passo operacional: consultar os candidatos, associar cada host ao equipamento correspondente e executar novamente o preview para confirmar `mappedHosts`.
