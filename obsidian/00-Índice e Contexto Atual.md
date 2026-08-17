---
type: project-index
project: HealthLink Sentinel
status: active
updated: 2026-08-07
---

# HealthLink Sentinel — índice e contexto atual

Esta é a nota de entrada para recuperar o contexto do projeto. A documentação oficial do produto prevalece sobre notas de execução; decisões registradas prevalecem sobre suposições.

> **Leitura rápida:** [[00-Contexto Atual]] contém o estado consolidado para iniciar uma nova sessão.

## Ordem de leitura recomendada

1. [[00-Mapa Mestre do Vault]] — navegação completa e notas específicas por módulo.
2. [[01-Produto/Fonte PRD/README — Índice da fonte oficial]] — requisitos oficiais.
3. [[01-Produto/Requisitos Oficiais]] — resumo funcional rastreado.
4. [[02-Arquitetura/Arquitetura de Referência]] — limites técnicos.
5. [[02-Arquitetura/Modelo de Dados]] — entidades e isolamento.
6. [[03-Execucao/Estado Atual]] — situação real do código.
7. [[03-Execucao/Próximos Passos]] — próximo trabalho verificável.
8. [[04-Decisoes/ADR-001 Multi-tenancy desde o MVP]] — decisão estrutural obrigatória.

## Produto

O HealthLink Sentinel é um SaaS corporativo de missão crítica para monitorar unidades móveis de saúde. A experiência deve parecer um centro de comando operacional, não um dashboard genérico.

- [[02-Arquitetura/Briefing Visual - Como funciona o HealthLink Sentinel]] — visão executiva e técnica ilustrada do sistema, integrações e APIs.
- [[01-Produto/Visão do Produto]]
- [[01-Produto/Fonte PRD/03-DESIGN-SYSTEM]]
- [[01-Produto/Fonte PRD/04-UX-FLUXOS]]
- [[01-Produto/Fonte PRD/MAPA-INTERATIVO]]
- [[01-Produto/Fonte PRD/MODULOS]]

## Implementado no backend

- Autenticação JWT, login, sessão e `/v1/auth/me`: [[03-Execucao/Autenticação Implementada]].
- Multi-tenant, RBAC, RLS e auditoria: [[04-Decisoes/ADR-001 Multi-tenancy desde o MVP]].
- CRUD de unidades: [[03-Execucao/CRUD de Unidades]].
- CRUD de equipamentos: [[03-Execucao/CRUD de Equipamentos]].
- Alertas, reconhecimento, resolução e histórico: [[03-Execucao/Ciclo de Vida de Alertas]].
- Adaptador oficial Zabbix, preview e sincronização: [[03-Execucao/Adapter Zabbix Implementado]], [[03-Execucao/Sincronizacao Zabbix Persistente]], [[03-Execucao/Worker Zabbix Automático]].
- Mapeamento host → equipamento → unidade: [[03-Execucao/Mapeamento Zabbix Validado]].
- Operação, disponibilidade e saúde do conector: [[03-Execucao/Operacao de Monitoramento - Fase 3]].

## Implementado no frontend

- Fundação corporativa: [[03-Execucao/Frontend Corporativo - Fundação]].
- Centro operacional com mapa vetorial interativo do Brasil: [[03-Execucao/Centro Operacional - Mapa Interativo]].
- Central de alertas ativos e histórico resolvido: [[03-Execucao/Frontend - Central de Alertas]].
- Detalhe operacional da unidade: [[03-Execucao/Frontend - Detalhe Operacional da Unidade]].
- Cadastro de unidade/equipamentos e gestão visual completa dos vínculos (criar, trocar e desvincular): [[03-Execucao/Frontend - Cadastro e Vinculo Zabbix]].

## Fluxo operacional canônico

```text
Cadastrar unidade
  → cadastrar equipamentos
  → listar hosts autorizados do Zabbix
  → sugerir unidade/tipo por nome, tags e interface
  → confirmar vínculo host → equipamento
  → sincronizar problemas/eventos
  → projetar estado operacional
  → exibir mapa, alertas e histórico
```

## Estado atual em 2026-08-07

- API e frontend compilam sem erros (`npm run typecheck` e `npm run build:web`).
- Zabbix 7.4.1 está conectado ao adaptador.
- A conta técnica do Zabbix precisa ter permissão de leitura nos grupos de hosts desejados.
- O catálogo da integração consulta até 1.000 hosts e importa interfaces/tags.
- A sugestão automática nunca grava vínculo sem confirmação do operador.
- O mapa é interativo e usa `@svg-maps/brazil`; a seleção de UF abre o contexto da unidade.
- A Fase 2 foi concluída: alterações de vínculo são isoladas por tenant, auditadas e preservam o histórico.
- A Fase 3 foi concluída: sincronização real processa os hosts vinculados, registra a última coleta e impede telemetria obsoleta após falhas repetidas.

## Pendências prioritárias

- Confirmar padrões oficiais de nomes/tags do Zabbix para elevar a precisão das sugestões.
- Consolidar a Fase 4, conectando todos os indicadores do centro operacional e do mapa aos estados reais produzidos pela Fase 3.
- Completar telas de gestão de usuários, auditoria e relatórios conforme o PRD.
- Definir retenção de métricas/eventos e topologia produtiva de instâncias Zabbix.

## Regra para novas sessões

Ler [[00-Contexto Atual]], esta nota, [[03-Execucao/Estado Atual]], o PRD oficial e as ADRs antes de alterar código. Ao concluir uma tarefa, atualizar o contexto consolidado e a nota específica do módulo.
