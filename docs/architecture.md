# Decisões de arquitetura

## Modelo de implantação

O núcleo é um monólito modular com API, workers e jobs separados no deploy quando a carga exigir. Essa escolha mantém consistência transacional entre unidades, alertas, RBAC e auditoria, sem impedir a evolução de integrações para processos independentes.

## Isolamento multi-tenant

Cada registro de domínio é associado a `tenant_id`. O serviço aplica o contexto do tenant por requisição e a base usa PostgreSQL Row-Level Security. Nesta fundação, cada instância Zabbix pertence a um cliente e os mapeamentos de host para equipamento são explícitos.

## Estado operacional

O Zabbix é a origem de telemetria. Jobs assíncronos capturam problemas, eventos e métricas; o HealthLink grava uma projeção atual de equipamento e unidade. Dashboard e mapa consultam a projeção, não o Zabbix.

## Segurança

Credenciais de integração devem ser criptografadas em repouso. Senhas nunca são armazenadas em texto puro. Logs de auditoria são append-only e não podem ser alterados por papéis de cliente.
