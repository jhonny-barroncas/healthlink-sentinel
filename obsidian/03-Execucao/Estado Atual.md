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

> Atualização 2026-08-17: iniciada a Fase 1 do coletor Starlink. O transporte foi isolado em `apps/agent/src/starlink-client.ts`, com protobufs derivados do repositório Eitol e comando de diagnóstico `npm.cmd run agent:starlink:check`. Pendente executar o teste no servidor da unidade com a rota real até `192.168.100.1:9200`.

> Atualização 2026-08-17: o diagnóstico do agente passou a testar as interfaces IPv4 locais e identificou a rota Ethernet `192.168.88.254` até `192.168.100.1:9200` neste ambiente; a antena respondeu ao gRPC, com campos indisponíveis representados como `N/D`.

> Atualização 2026-08-17: o agente passou a exibir a mensagem sanitizada retornada pela API junto do status HTTP no login, facilitando o diagnóstico do `HTTP 500` sem expor credenciais.

> Atualização 2026-08-17: o formulário de usuários passou a permitir definir a senha diretamente no cadastro e alterá-la na edição. Isso permite provisionar usuários de serviço com e-mail técnico/fictício sem depender de convite por e-mail.

> Validação 2026-08-17: agente Starlink autenticou no HealthLink, coletou 5 métricas reais e enviou o lote com sucesso (`pendentes=0`). A conectividade foi confirmada pela Ethernet `192.168.88.254` até `192.168.100.1:9200`.

> Atualização 2026-08-17: telemetria Starlink passou a alimentar um painel no detalhe da unidade e a localização da Starlink preenche automaticamente a unidade somente quando latitude/longitude ainda estão vazias. Coordenadas manuais têm precedência.

> Correção 2026-08-17: painel Starlink deixou de assumir que valores `numeric` do PostgreSQL chegam como número no navegador; a conversão explícita evita falha de renderização/tela preta.

> Correção 2026-08-17: estados Starlink antigos não permanecem operacionais indefinidamente. Sem latência/perda/cobertura ou após 30 segundos sem nova coleta, o frontend recebe `unknown`/sem telemetria.

> Correção 2026-08-17: o painel Starlink deixou de apresentar a última amostra persistida como dado atual. Após 30 segundos sem coleta, as métricas também são exibidas como `N/D`.

> Atualização 2026-08-17: o detalhe da unidade passou a exibir um erro explícito de coletor quando a Starlink fica sem amostra por mais de 30 segundos; a mensagem diferencia ausência do agente/rota de uma métrica válida.

> Atualização 2026-08-17: a branch `frontend-padronizacao` do repositório remoto foi incorporada à `main`; conflitos do `App.tsx` foram resolvidos preservando as funções Starlink e o fluxo de usuários.

> Atualização 2026-08-18: a regra de expiração de telemetria foi estendida aos links alimentados pelo Zabbix. Após 30 segundos sem amostra, o estado passa a `unknown`, os indicadores atuais são zerados na interface e o histórico de erros sinaliza a perda de comunicação.

> Atualização 2026-08-18: o mapa geográfico estadual permite escolher `Dark` ou `Claro` no cabeçalho; a preferência fica persistida no navegador e também altera o fallback cartográfico.

> Atualização 2026-08-13: corrigida a seleção de interfaces SNMP FortiGate. O `FW-LAV-IRANDUBA` agora usa `wan1 (LINK-ICOM-100Mb)` para download/upload. Detalhes em [[Correcao Telemetria SNMP FortiGate]].

# Estado Atual

> Atualização 2026-08-18: o painel Starlink passou a mostrar explicitamente a unidade vinculada e sua cidade/UF junto das métricas da antena, incluindo coordenadas e obstrução quando fornecidas pelo agente.

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
