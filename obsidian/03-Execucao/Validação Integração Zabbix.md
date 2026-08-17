# Validação da integração Zabbix

Em 2026-08-06, o endpoint `GET /v1/integrations/zabbix/test` respondeu com sucesso usando autenticação do HealthLink:

```json
{
  "connected": true,
  "hostsReturned": 5
}
```

Isso confirma que o HealthLink consegue acessar a API JSON-RPC do Zabbix 7.4.1 com o token técnico configurado no ambiente local.

Próxima etapa: sincronizar periodicamente problemas, eventos e métricas, relacionando hosts do Zabbix aos equipamentos e unidades do HealthLink.
