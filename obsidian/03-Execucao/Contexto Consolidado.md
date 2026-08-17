---
type: context
source: PRD oficial + implementação
updated: 2026-08-05
---

# Contexto Consolidado

> **Nota canônica atualizada:** [[../00-Índice e Contexto Atual]]. Este documento mantém o contexto histórico e decisões de implementação.

## Atualização vigente — 2026-08-07

- O frontend deixou de estar fora do escopo: a fundação corporativa, mapa, alertas, detalhe de unidade, cadastro de inventário e vínculo Zabbix já estão implementados.
- O fluxo ativo é unidade → equipamento → host Zabbix; a integração sugere unidade/tipo por nome, tags e interface, mas exige confirmação.
- A próxima evolução de integração é padronizar tags/nomenclatura no Zabbix e permitir desfazer/editar vínculos pela interface.

## Produto

O HealthLink Sentinel é um SaaS corporativo de monitoramento operacional para unidades móveis de saúde. O Zabbix coleta dados de servidores Linux, Mikrotik, Starlink, VPN e links de internet; o HealthLink interpreta esses dados para operação NOC.

## Arquitetura já criada

- API modular TypeScript/Fastify.
- PostgreSQL como núcleo transacional e Redis preparado para fila/cache.
- Frontend não iniciado; telas continuam deliberadamente fora do escopo desta fundação.
- Contexto de tenant e RLS no banco.
- Fronteira de adaptador Zabbix sem acesso direto do frontend.

## Requisitos funcionais rastreados

Dashboard NOC, mapa do Brasil com verde/amarelo/vermelho, cadastro de unidades, monitoramento, alertas/incidentes, usuários/RBAC, auditoria, relatórios e integração oficial Zabbix.

## Próxima implementação recomendada

Autenticação completa e autorização por tenant/permission, seguida de CRUD de unidades e equipamentos. O sincronizador Zabbix só deve avançar após existir identidade, tenant e mapeamento de ativos.

## Pendência que exige decisão

Confirmar a topologia de integração: uma instância Zabbix por cliente ou uma instância compartilhada. A estrutura atual está segura por cliente; não deve ser alterada sem ADR.
