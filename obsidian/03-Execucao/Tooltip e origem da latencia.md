---
type: execution-note
project: HealthLink Sentinel
module: link telemetry
updated: 2026-08-13
status: validated
---

# Tooltip e origem da latência

## Fluxos de atualização

- A telemetria automática vem dos itens do Zabbix e é consultada pela API em ciclo leve padrão de 2 segundos.
- A frequência efetiva depende do intervalo de atualização do item no próprio Zabbix; no ambiente atual, alguns itens são renovados aproximadamente a cada 60 segundos.
- O frontend consulta `GET /v1/monitoring/link-telemetry` a cada 2 segundos.
- Para que a latência produza uma amostra realmente nova nesse ritmo, o item `icmppingsec` também precisa usar intervalo de atualização de `2s` no Zabbix. Consultar o mesmo item mais rapidamente não altera sozinho a frequência da coleta feita pelo Zabbix.
- O Ping manual é executado a partir do servidor HealthLink e atualiza imediatamente a latência apresentada na sessão atual.
- Ping manual não força o Zabbix a atualizar download, upload ou perda de pacotes e não substitui permanentemente a série histórica automática.

## Correção visual

- O gráfico de latência recebeu tooltip HTML próprio ao passar o mouse sobre cada ponto.
- O tooltip mostra o valor em milissegundos e o instante completo da amostra.
- Enquanto um ponto está selecionado, o valor destacado no cabeçalho acompanha essa amostra.
- Latências menores que 10 ms preservam duas casas decimais, evitando que valores abaixo de 1 ms apareçam como `0 ms`.
- O elemento `<title>` do SVG foi mantido como fallback de acessibilidade.

## Validação

- `npm.cmd run typecheck`: aprovado.
- `npm.cmd run build:web`: aprovado.

## Relacionados

- [[Centro Operacional - Mapa Geografico Dark]]
- [[Worker Zabbix Automático]]
- [[Diagnosticos Ping e Tracert]]
- [[Correcao Telemetria SNMP FortiGate]]
- [[../00-Mapa Mestre do Vault]]
