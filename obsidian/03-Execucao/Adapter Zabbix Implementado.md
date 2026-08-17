# Adapter Zabbix implementado

Em 2026-08-06, o backend recebeu a configuração `ZABBIX_API_URL` e `ZABBIX_API_TOKEN`, além do transporte HTTP JSON-RPC autenticado por Bearer token.

O adapter agora suporta chamadas para `host.get`, `problem.get`, `history.get` e `event.get`, com tratamento de erros HTTP/API sem expor o token nos logs.

O token deve permanecer somente no `.env` local. O typecheck foi executado com sucesso.

Também foi criada a rota autenticada `GET /v1/integrations/zabbix/test`, que valida a configuração e confirma a quantidade de hosts retornados sem revelar credenciais.
