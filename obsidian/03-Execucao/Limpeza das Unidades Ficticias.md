# Limpeza das Unidades Fictícias

Data: 2026-08-06

## Ação realizada

As unidades de demonstração `UMS-001` até `UMS-010` foram desativadas no banco de dados do tenant HealthLink Demo. Seus 50 equipamentos fictícios também foram desativados.

## Preservado

- Unidade `ZBX-001 — Zabbix Server` permanece ativa.
- Equipamento real associado ao Zabbix Server permanece ativo.
- Histórico, alertas e mapeamentos não foram apagados; a limpeza foi reversível por desativação.

## Resultado

- 10 unidades fictícias desativadas.
- 50 equipamentos fictícios desativados.
- Nenhum dado da unidade Zabbix foi alterado.
