# Frontend — Cadastro e vínculo Zabbix

## Entregue

- A navegação ganhou o módulo **Integração Zabbix**.
- A tela consulta `GET /v1/integrations/zabbix/mapping-candidates` e lista host, nome, ID, status e situação do vínculo.
- Busca por nome, host ou ID do Zabbix.
- A consulta do catálogo usa `limit: 1000`, evitando o corte padrão de cinco hosts usado apenas no endpoint de teste de conectividade.
- A consulta também importa interfaces e tags do host.
- A tela sugere unidade e tipo de equipamento a partir de padrões no nome do host (`UMS-xxx`, `MIKROTIK`, `STARLINK`, `VPN`, `LINUX`, `LINK`). A sugestão é sempre confirmada pelo operador antes de gravar.
- Seleção do equipamento do HealthLink agrupado pela unidade móvel.
- Vínculo visual usando `POST /v1/integrations/zabbix/mappings`.
- O painel mostra o equipamento e a unidade do vínculo atual.
- O operador pode trocar o equipamento associado ao host; se o equipamento já estiver ligado a outro host, a interface avisa e exige confirmação.
- O operador pode desvincular pelo próprio SaaS usando `DELETE /v1/integrations/zabbix/mappings/:zabbixHostId`.
- Criar, trocar e remover vínculos gera registro em `audit_logs`, sempre no tenant autenticado.
- Ao alterar um vínculo, a telemetria afetada volta para `unknown` até a próxima sincronização, impedindo que o estado do host anterior seja atribuído ao equipamento novo.
- Alertas, eventos e histórico já coletados são preservados após a desvinculação.
- O modelo permanece: **Host Zabbix → Equipamento → Unidade móvel**. O usuário escolhe a unidade indiretamente pelo equipamento, evitando ambiguidade quando uma unidade possui vários ativos.
- A tela de Unidades ganhou cadastro de unidade (`POST /v1/units`) e cadastro de equipamento (`POST /v1/units/:unitId/equipment`).

## Operação

1. Abrir **Unidades móveis** e cadastrar a unidade.
2. Abrir a unidade e cadastrar seus equipamentos (Mikrotik, Linux, Starlink, VPN ou link de internet).
3. Abrir **Integração Zabbix** e atualizar os hosts.
4. Selecionar um host pendente.
5. Selecionar o equipamento correspondente.
6. Confirmar **Vincular host ao equipamento**.
7. Executar a sincronização Zabbix para alimentar estado operacional e alertas.

## Arquivos

- `apps/web/src/App.tsx`: componentes `InventoryActions`, `UnitForm`, `EquipmentForm` e `ZabbixIntegration`.
- `apps/web/src/styles.css`: estilos do inventário, catálogo de hosts e painel de vínculo.

## Validação

- `npm.cmd run typecheck` passou em 2026-08-07.
- `npm.cmd run build:web` passou em 2026-08-07.

## Gestão completa do vínculo — 2026-08-07

Fluxo disponível na interface: **selecionar host → consultar vínculo atual → vincular, trocar ou desvincular**. A relação continua sendo um host por equipamento dentro de cada integração Zabbix.

## Atualização — edição de equipamentos (2026-08-07)
- Rota PATCH /v1/equipment/:id utilizada para editar sem perder vínculos Zabbix.
- Tela de unidades agora exibe **Editar** em cada equipamento.
- Formulário permite alterar tipo, nome, endereço de gerenciamento e número de série.
- A API de inventário retorna serial e endereço para preencher o formulário.
- Validação executada: `npm.cmd run typecheck` e `npm.cmd run build:web`.

