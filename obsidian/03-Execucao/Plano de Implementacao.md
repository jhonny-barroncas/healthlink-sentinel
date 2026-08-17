---
type: implementation-plan
project: HealthLink Sentinel
status: active
updated: 2026-08-07
---

# Plano de implementação

Este é o plano operacional vigente. A ordem prioriza segurança de dados, operação real e integração Zabbix.

## Fase 1 — Consolidar inventário
- Editar unidades.
- Desativar equipamentos sem apagar histórico.
- Validar permissões e isolamento multi-tenant.
- Situação: concluída em 2026-08-07.

Entrega da fase: edição visual de unidades via `PATCH /v1/units/:id`, desativação controlada de equipamentos via `DELETE /v1/equipment/:id`, confirmação no frontend, isolamento por tenant e auditoria preservada.

## Fase 2 — Gestão de vínculos Zabbix
- Listar todo o catálogo autorizado.
- Vincular host a equipamento.
- Trocar ou desvincular host.
- Exibir status do vínculo.
- Situação: concluída em 2026-08-07.

Entrega da fase: catálogo autorizado de até 1.000 hosts, indicação visual do vínculo atual, troca controlada, desvinculação com confirmação, isolamento por tenant, reinicialização segura da telemetria afetada e trilha de auditoria. O histórico operacional não é apagado.

## Fase 3 — Operação de monitoramento
- Sincronização manual.
- Scheduler automático.
- Estados online, degradado e offline.
- Tratamento de falhas de comunicação.
- Situação: concluída em 2026-08-07.

Entrega da fase: projeção do estado de cada host vinculado mesmo sem alertas, sincronização manual, scheduler automático, persistência da saúde do conector, última coleta válida e proteção contra telemetria obsoleta após três falhas consecutivas. Detalhes em [[Operacao de Monitoramento - Fase 3]].

## Fase 4 — Centro operacional
- Mapa interativo do Brasil.
- Filtros por UF e unidade.
- Indicadores derivados dos eventos reais.
- Detalhe operacional da unidade.
- Situação: fundação operacional concluída em 2026-08-07; próxima iteração é refinamento visual e testes de aceitação.

Entrega inicial da fase: mapa vetorial com cores semânticas por UF, tooltip operacional, seleção de estado com lista de todas as unidades, filtros por UF e situação e acesso direto ao detalhe da unidade. Os indicadores continuam derivados dos dados reais sincronizados pelo Zabbix.

## Fase 5 — Alertas e auditoria
- Separação entre alertas ativos e histórico.
- Reconhecimento e resolução.
- Detalhes do incidente.
- Trilha de auditoria.

## Fase 6 — Segurança e produção
- Testes automatizados.
- Logs e variáveis de ambiente.
- Backup e recuperação.
- Deploy e documentação operacional.

## Critério de avanço
Cada fase deve ter implementação, validação técnica e atualização do estado no Obsidian antes da próxima fase.

## Links
- [[../00-Índice e Contexto Atual]]
- [[Estado Atual]]
- [[Frontend - Cadastro e Vinculo Zabbix]]
