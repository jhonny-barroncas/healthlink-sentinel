---
type: status
updated: 2026-08-07
phase: foundation
---

> Atualização 2026-08-13: núcleo do módulo Starlink implementado com estratégia híbrida; consulte [[Modulo Starlink - Estrategia Hibrida]].

> Atualização 2026-08-15: planejamento da coleta em unidade móvel definido com servidor local obrigatório, Starlink via gRPC local e MikroTik opcional; consulte [[Plano de Coleta Starlink e Unidade Movel]].

> Atualização 2026-08-15: agente local Starlink inicial implementado; ainda pendente validação em antena real e coleta MikroTik.

> Atualização 2026-08-15: conectividade real validada entre o PC na porta 3 do MikroTik e a API gRPC local da Starlink (`192.168.100.1:9200`) pela Ethernet. Pendente executar o agente com equipamento/token configurados.

> Atualização 2026-08-17: criado o perfil RBAC `service_agent` e autenticação do agente por usuário de serviço com renovação automática via refresh token. Pendente cadastrar a conta de serviço no tenant e validar coleta real.

> Atualização 2026-08-13: corrigida a seleção de interfaces SNMP FortiGate. O `FW-LAV-IRANDUBA` agora usa `wan1 (LINK-ICOM-100Mb)` para download/upload. Detalhes em [[Correcao Telemetria SNMP FortiGate]].

# Estado Atual

> **Atualização vigente:** o texto histórico abaixo foi preservado. Para o estado canônico mais recente, consulte [[../00-Índice e Contexto Atual]].

## Atualização — 2026-08-07

- Backend de autenticação, unidades, equipamentos, alertas e integração Zabbix está implementado.
- Frontend corporativo está ativo com centro operacional, mapa interativo, unidades, alertas e Integração Zabbix.
- Cadastro visual de unidade/equipamento e vínculo host → equipamento → unidade estão implementados.
- Catálogo Zabbix consulta até 1.000 hosts; interfaces, tags e sugestões por convenção de nomes foram adicionadas.
- Typecheck e build web aprovados.
- Fase 2 concluída: vínculos Zabbix podem ser consultados, criados, trocados e removidos pela interface, com isolamento multi-tenant e auditoria.
- Fase 3 concluída: disponibilidade dos hosts, saúde da integração, última coleta e falhas consecutivas são projetadas e exibidas no frontend.
- Tela de detalhe da unidade reorganizada: equipamentos aparecem em uma lista operacional única, sem duplicar inventário e monitoramento.
- Ações de editar, desativar e excluir ficam no próprio item do equipamento, com confirmação para ações destrutivas.

## Atualização — 2026-08-11

- Equipamentos de conectividade passaram a aceitar download e upload contratados em Mbps por meio da migration `007_equipment_contracted_bandwidth.sql`.
- O painel de links separa plano contratado cadastrado de tráfego atual coletado pelo Zabbix e apresenta `N/D` quando não houver cadastro confiável.
- O diagnóstico Ping extrai a média real do comando executado e a aplica temporariamente ao card e gráfico do link, distinguindo `Último ping local` das amostras coletadas pelo Zabbix.

## Concluído

- Estrutura da API TypeScript/Fastify criada, sem telas.
- Configuração por ambiente e Docker Compose para PostgreSQL e Redis.
- Migration inicial com multi-tenancy, RBAC, unidades, equipamentos, alertas, integração e auditoria.
- Políticas RLS para dados operacionais por cliente.
- Fronteira de integração Zabbix criada.
- Typecheck aprovado e auditoria das dependências de produção sem vulnerabilidades.

## Histórico da fundação

Os itens abaixo descrevem o ponto de partida histórico e não representam o estado atual: login, CRUDs, worker Zabbix, agregação de estado, alertas, dashboard e mapa já possuem implementação incremental documentada nas notas específicas.

## Implementação validada — 2026-08-07

- Fase 1 do plano concluída: unidade pode ser editada pelo frontend com validação da API.
- Equipamentos podem ser desativados com confirmação explícita; o backend marca `active = false` e grava auditoria, preservando eventos e histórico.
- Equipamentos desativados deixam de aparecer no inventário operacional e nos candidatos de vínculo Zabbix.
- `npm.cmd run typecheck` e `npm.cmd run build:web` aprovados após a entrega.
- Gestão de vínculos Zabbix concluída: o vínculo atual é exibido com equipamento/unidade, mudanças exigem confirmação quando deslocam outro host e a desvinculação preserva o histórico.
- Estados de telemetria afetados por troca/desvinculação retornam para `unknown` até nova coleta, evitando informação operacional obsoleta.
- Após três falhas consecutivas de comunicação com o Zabbix, equipamentos vinculados passam para `unknown`; uma sincronização válida restaura a projeção e zera o contador.
- Validação real identificou 29 hosts autorizados, 2 vínculos ativos e saúde `healthy`.

## Riscos e pendências

- O gráfico de latência exibe tooltip por amostra; itens Zabbix de descarte/erro não são mais aceitos como download/upload, aguardando itens de tráfego válidos quando o host não os fornecer.

- A coleta leve da telemetria usa intervalo padrão de 2 segundos (`ZABBIX_TELEMETRY_INTERVAL_MS`), alinhada ao polling visual do gráfico; a frequência final continua limitada pelo intervalo dos itens configurados no Zabbix.

- Definir mecanismo de provisionamento seguro e rotação de credenciais Zabbix.
- Definir a política de retenção de métricas e eventos técnicos.
- Confirmar se haverá uma instância Zabbix por cliente ou compartilhada entre clientes antes do conector produtivo.
