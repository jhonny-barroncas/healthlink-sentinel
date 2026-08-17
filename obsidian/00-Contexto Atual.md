---
type: project-context
project: HealthLink Sentinel
status: active
updated: 2026-08-07
---

# Contexto atual — HealthLink Sentinel

Esta é a nota de entrada rápida para qualquer nova sessão de trabalho. Ela não substitui o PRD oficial: em caso de conflito, o PRD e as ADRs têm prioridade.

## Objetivo do produto

O HealthLink Sentinel é um SaaS corporativo de missão crítica para monitorar unidades móveis de saúde. A experiência deve parecer um centro de comando operacional, com leitura rápida, rastreabilidade e ações controladas — não um dashboard genérico.

## Onde está o projeto

- Código: `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel`
- API: `apps/api`
- Frontend: `apps/web`
- Documentação/vault: `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian`
- API local: `http://localhost:3000`
- Frontend local: `http://localhost:5173` (ou pelo IP da máquina na rede)
- Zabbix: `http://10.0.0.37/zabbix/api_jsonrpc.php`

## Estado técnico conhecido

- API Fastify com autenticação JWT, multi-tenant, RBAC, auditoria e CRUD de unidades/equipamentos.
- PostgreSQL é o banco principal do ambiente local.
- Integração Zabbix 7.4.1 funcionando com teste de conexão, catálogo de hosts, mapeamento e sincronização persistente.
- Fluxo confirmado: host Zabbix → equipamento → unidade móvel → eventos/problemas → estado operacional.
- Frontend corporativo em React/Vite com identidade escura, vidro fosco, ciano/verde operacional e estados críticos em vermelho/amarelo.
- Mapa vetorial interativo do Brasil usando `@svg-maps/brazil`, com detalhe geográfico dark por UF em MapLibre/OpenFreeMap e marcadores por coordenadas confirmadas.
- Alertas possuem separação entre ativos e histórico resolvido.
- Cadastro de unidades aceita UF selecionável/digitável e lista de cidades dependente do estado.
- Equipamentos podem ser criados, editados, desativados e excluídos com confirmação; vínculo Zabbix é gerenciado visualmente.

## Decisões de produto e UX

- Cada equipamento deve aparecer uma única vez na tela da unidade; monitoramento e inventário devem ficar organizados em uma única área operacional limpa.
- O centro operacional é a visão principal: mapa, filtros por tipo de ativo, indicadores e ranking de problemas.
- Campos obrigatórios precisam exibir `*` e mensagem de validação junto ao campo.
- Ações destrutivas devem exigir confirmação e preservar auditoria quando aplicável.
- Tooltips devem abrir dentro da área visível, sem ficar escondidos atrás de outros blocos.
- O menu deve separar claramente Centro operacional, Unidades móveis, Alertas, Integração Zabbix e Relatórios.
- O Centro Operacional usa carrossel com `<` e `>` para Ranking de problemas, histórico resolvido (janela visual de 30 minutos) e Cobertura de monitoramento.

## Regras de continuidade

1. Ler esta nota.
2. Ler [[00-Índice e Contexto Atual]], [[00-Mapa Mestre do Vault]], [[03-Execucao/Estado Atual]] e as ADRs relevantes.
3. Consultar o PRD oficial antes de alterar comportamento do produto.
4. Verificar o código existente antes de criar novos módulos ou duplicar componentes.
5. Executar `npm run typecheck` e `npm run build:web` após alterações relevantes.
6. Atualizar esta nota, a nota do módulo e [[03-Execucao/Estado Atual]] ao concluir.

## Próximos passos prioritários

- Consolidar os indicadores do centro operacional com os estados reais da sincronização Zabbix.
- Validar visualmente a visão limpa e unificada de equipamentos na tela de detalhe da unidade.
- Completar gestão de usuários, auditoria e relatórios conforme o PRD.
- Definir retenção de eventos/métricas e topologia produtiva.
- Confirmar com infraestrutura os padrões oficiais de nomes, grupos e tags dos hosts Zabbix.

## Segurança

Senhas, tokens e segredos não devem ser gravados nesta nota nem commitados. Guardar valores apenas no ambiente seguro/configuração local e registrar aqui somente o nome da variável, finalidade e procedimento de rotação.

## Notas relacionadas

- [[01-Produto/Fonte PRD/README — Índice da fonte oficial]]
- [[02-Arquitetura/Arquitetura de Referência]]
- [[02-Arquitetura/Modelo de Dados]]
- [[03-Execucao/Estado Atual]]
- [[03-Execucao/Centro Operacional - Fase 4]]
- [[03-Execucao/Centro Operacional - Mapa Geografico Dark]]
- [[03-Execucao/Frontend - Detalhe Operacional da Unidade]]
- [[03-Execucao/Frontend - Cadastro e Vinculo Zabbix]]
- [[03-Execucao/Worker Zabbix Automático]]
- [[04-Decisoes/ADR-001 Multi-tenancy desde o MVP]]
