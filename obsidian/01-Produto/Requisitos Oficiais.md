---
type: requirements
source: HEALTHLINK-SENTINEL-PRD.zip
status: active
---

# Requisitos Oficiais

## Módulos exigidos

- Dashboard NOC
- Mapa interativo do Brasil
- Unidades
- Monitoramento de Linux, Mikrotik e Starlink
- Alertas: incidentes, reconhecimento e histórico
- Usuários com RBAC completo
- Auditoria

## Mapa operacional

- Verde: todas as unidades online.
- Amarelo: uma ou mais unidades degradadas.
- Vermelho: uma ou mais unidades offline.
- Ao selecionar um estado: unidades, disponibilidade, alertas e status.

## Integração Zabbix

Usar a API oficial para criar hosts, associar templates e buscar problemas, métricas, histórico e eventos. O frontend não acessa o Zabbix diretamente.

## Roadmap

MVP: Dashboard, unidades, mapa, usuários e integração Zabbix.

Enterprise: IA operacional, WhatsApp, Telegram, relatórios avançados, SLA e multi-clientes exposto na experiência.
