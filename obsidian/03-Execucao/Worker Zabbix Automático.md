# Worker Zabbix Automático

Data: 2026-08-06

## Implementado

O backend agora inicia um worker interno quando `ZABBIX_API_URL` e `ZABBIX_API_TOKEN` estão configurados.

- Executa uma primeira sincronização após 5 segundos da inicialização.
- Repete a sincronização a cada 60 segundos por padrão.
- Permite alterar o intervalo com `ZABBIX_SYNC_INTERVAL_MS`.
- Descobre os tenants ativos no banco.
- Usa um JWT temporário interno, sem armazenar a senha do usuário.
- Executa o endpoint persistente de sincronização para cada tenant.
- Registra falhas no log da API.

## Configuração

`ZABBIX_SYNC_INTERVAL_MS=60000`

Após alterar `.env`, reiniciar a API:

```powershell
npm.cmd run dev
```

## Validação

`npm.cmd run typecheck` executado com sucesso.
# Ciclo rápido de telemetria - 2026-08-11

- A sincronização foi dividida em dois ritmos para reduzir a latência visual sem repetir consultas pesadas.
- O ciclo completo permanece controlado por `ZABBIX_SYNC_INTERVAL_MS`, com padrão de 60 segundos, e continua responsável por hosts, problemas, eventos, estados e saúde do conector.
- O ciclo leve usa `ZABBIX_TELEMETRY_INTERVAL_MS`, com padrão de 2 segundos, e consulta apenas `item.get` para os hosts já vinculados.
- A tela consulta `GET /v1/monitoring/link-telemetry` a cada 2 segundos. Uma amostra nova já coletada pelo Zabbix tende a aparecer no painel em poucos segundos.
- Os schedulers possuem trava em memória: ciclos iguais não se sobrepõem e a coleta leve não inicia durante uma sincronização completa.
- O intervalo mínimo aceito para telemetria é 2 segundos. A velocidade efetiva continua limitada pelo intervalo de atualização dos itens no próprio Zabbix; a latência a cada 2 segundos exige `icmppingsec` configurado com `2s`.
- A coleta rápida preserva tenant, JWT interno, RBAC, RLS e persistência em `metric_samples`.
