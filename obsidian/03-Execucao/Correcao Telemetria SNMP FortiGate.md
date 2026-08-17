---
type: execution-note
project: HealthLink Sentinel
module: Zabbix telemetry
updated: 2026-08-13
status: validated
---

# Correção da telemetria SNMP FortiGate

## Problema

O host `FW-LAV-IRANDUBA` aparecia com download e upload em `0 bps`, apesar de possuir itens SNMP de tráfego ativos no Zabbix.

## Diagnóstico confirmado

- O Zabbix retornou 321 itens para o host `FW-LAV-IRANDUBA` (`hostid 10680`).
- Existem várias interfaces `net.if.in` e `net.if.out` coletadas no mesmo instante.
- O seletor anterior atribuía a mesma prioridade a todos os itens `Bits received/sent`.
- Com prioridade e horário empatados, uma interface inativa, `Interface b()`, era mantida com `0 bps`.
- A interface operacional correta é `wan1 (LINK-ICOM-100Mb)`.

## Correção

- A classificação foi isolada em `apps/api/src/modules/integrations/zabbix/telemetry.ts`.
- A pontuação agora é acumulativa e prioriza `wan1`, outras WANs, Internet/uplink/Starlink e links identificados.
- Interfaces internas, VPN, IPsec e loopback recebem prioridade menor.
- Entrada e saída usam o mesmo critério determinístico.
- Valores em `Bps` são convertidos para `bps`.
- Contadores de erros, descartes e drops continuam rejeitados.

## Validação real

Após o hot reload do worker, o banco passou a registrar pelos itens `51754` e `51799`:

- download: aproximadamente `13,1 Mbps`;
- upload: aproximadamente `0,75 Mbps`;
- interface: `wan1 (LINK-ICOM-100Mb)`.

O histórico anterior com a interface incorreta foi preservado; as amostras atuais já utilizam a interface correta.

## Validações automatizadas

- `telemetry.test.ts`: 2 testes aprovados.
- `npm.cmd run typecheck`: aprovado.
- `npm.cmd run build:web`: aprovado.

## Relacionados

- [[Centro Operacional - Mapa Geografico Dark]]
- [[Worker Zabbix Automático]]
- [[Estado Atual]]
- [[../00-Mapa Mestre do Vault]]
