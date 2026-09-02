---
type: status
updated: 2026-08-07
phase: foundation
---

> Atualização visual 2026-09-02: a barra lateral passou a usar um glider ciano luminoso no item ativo, com gradiente discreto nos níveis principal e secundário e no acesso ao Zabbix. A estrutura React, o RBAC e o comportamento recolhível foram preservados; a regressão está coberta por `apps/web/src/sidebar-collapse.test.ts`.

> Atualização 2026-09-02: incidentes de indisponibilidade do agente passaram a ser persistidos. Um watchdog avalia agentes ativos a cada 15 segundos; após 30 segundos sem heartbeat, abre **Agente sem comunicação** em `alerts` e grava eventos em `alert_events`/`monitoring_events`. O primeiro heartbeat ou lote de telemetria posterior resolve o mesmo incidente e registra a recuperação. Pulsos normais não entram no histórico para evitar volume operacional inútil.

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

> Atualização 2026-08-28: a exclusão de unidades fixas e móveis passou a ser permanente e transacional. O detalhe da unidade e o menu contextual dos cards exibem “Excluir unidade” com confirmação; a API remove dados operacionais dependentes, incluindo equipamentos, links, agentes, vínculos, telemetrias, alertas e eventos relacionados.

> Atualização 2026-08-24: a barra lateral desktop passou a ficar compacta por padrão, exibindo apenas ícones, e expande como sobreposição ao receber hover ou foco de teclado. A gestão de usuários também passou a empilhar formulário e lista em larguras de tablet e reorganizar filtros/ações em telas móveis.

> Atualização 2026-08-24: unidades agora possuem tipo estruturado (`mobile` ou `fixed`) pela migration `012_unit_types.sql`. A navegação separa **Unidades** e **Unidades móveis**; o perfil `mobile_unit_supervisor` recebe somente dados móveis também no backend, enquanto infraestrutura/administradores mantêm visão das duas categorias.

> Atualização 2026-08-21: o ambiente de desenvolvimento local foi colocado em HTTPS ponta a ponta. A API Fastify usa `HTTPS=true` com certificado em `.certs/localhost*.pem`, e o Vite usa o mesmo par em `https://localhost:5173`; a API local fica em `https://localhost:3002`. Os certificados são gerados sob demanda por `npm.cmd run dev:cert` e não são versionados.
> Atualização 2026-08-24: publicação de agente calcula automaticamente a próxima versão patch, embute a versão no `.cjs` baixável e valida o conteúdo com SHA-256. A conferência local usa `node <bundle>.cjs --version`.
> O HTTPS direto no Docker usa o override `docker-compose.local-https.yml`. O Compose base continua HTTP interno, compatível com o proxy reverso do ambiente de produção.
> Correção: o build de produção não exige certificados locais; o Vite só configura HTTPS quando encontra `.certs/`.

> Regra de retenção 2026-08-21: o PostgreSQL do HealthLink deve preservar permanentemente inventário, usuários, permissões, unidades, equipamentos, vínculos, configurações, agentes, versões publicadas, estado atual e auditoria. Telemetria detalhada deve ser mantida por 30 dias; heartbeats por 7 dias; eventos resolvidos por 90 dias; logs técnicos por 30 dias; diagnósticos Ping/Tracert por 7 dias. A projeção operacional reserva 100 GB para o volume do PostgreSQL, incluindo margem e backups temporários. A rotina automática de limpeza ainda precisa ser implementada para fazer cumprir esses prazos.

> Atualização 2026-08-21: criada a rotina `scripts/postgres-retention.sql`, executada diariamente pelo serviço Docker `retention`. Ela limpa `metric_samples` após 30 dias, `monitoring_events`/`alert_events` após 90 dias, lotes temporários do agente após 30 dias e sessões/enrollments expirados. Inventário, estado atual e `audit_logs` permanecem preservados.

> Atualização 2026-08-21: a porta única do HealthLink foi padronizada para `3002` no container, healthcheck, Docker Compose, override de servidor e documentação. GLPI permanece em `8090` e Uptime Kuma em `3001`.

> Atualização 2026-08-21: o Compose passou a executar o serviço `bootstrap` após as migrations e antes da aplicação. Ele garante de forma idempotente o usuário sysadmin do tenant `default` com perfil `tenant_administrator`; a senha fica somente no ambiente local/secret e não é sobrescrita em reinícios, salvo quando `HEALTHLINK_SYSADMIN_RESET_PASSWORD=true`. O domínio canônico passou a ser `PUBLIC_APP_URL`, com fallback compatível para `PUBLIC_API_URL`, e é usado na geração dos instaladores dos agentes. No servidor, o HealthLink fica em HTTP local `127.0.0.1:3003` e o proxy reverso publica HTTPS externo em `:3002`.

> Atualização 2026-08-19: o Centro Operacional passou a ter a visão **Agentes** no lugar de VPN. A visão lista as unidades móveis e diferencia agente em execução (heartbeat até 30s), agente parado e unidade sem agente vinculado; a API agrega a fonte `local_agent`, última amostra e versão sem expor segredos.
> Atualização 2026-08-19: a aba **Integração Zabbix** passou a ter o repositório de versões do agente, separado por Windows/Linux. A migração `010_agent_versions.sql` cria o catálogo inicial `1.0.0` para os dois sistemas; a interface publica o arquivo, calcula SHA-256 no servidor e disponibiliza download autenticado para atualização.
> Atualização 2026-08-20: concluído o provisionamento do agente em arquivo único. No detalhe da unidade, cada servidor ativo exibe **Gerar agente**; o fluxo valida Starlink/MikroTik/link ativo, pergunta Windows/Linux e baixa um instalador sem prompts. O backend grava atribuições, cria enrollment de uso único por 30 minutos, configura a fonte local da Starlink e monitora `pending`, `online`, `offline` e `unlinked`. O bundle real `1.0.0` é sincronizado no catálogo de versões e o agente atualiza automaticamente por SHA-256.
> Atualização 2026-08-20: criado o manual `docs/MANUAL-IMPLANTACAO-PRODUCAO.md`, cobrindo servidor Docker real, HTTPS, `.env`, migrations, backup, geração do agente, atualização e troubleshooting.
> Pendência para amanhã: homologar o agente `1.0.0` como serviço Windows e `systemd` Linux, validar reinício, coleta contínua, atualização automática e rollback.

> Atualização 2026-08-18: o painel Starlink passou a mostrar explicitamente a unidade vinculada e sua cidade/UF junto das métricas da antena, incluindo coordenadas e obstrução quando fornecidas pelo agente.

> Atualização 2026-08-19: o painel de usuários deixou de exigir CPF/coligada não suportados pela API, passou a validar senha somente no cadastro e a API impede o auto-bloqueio do usuário logado. Teste dedicado, typecheck e build web aprovados.

> Atualização 2026-08-19: ambiente Docker Compose validado de ponta a ponta. O serviço `migrate` aplica as migrations, a aplicação sobe na porta única `5174` e o health check retorna 200. O registro do fallback SPA foi isolado para evitar rota wildcard duplicada no Fastify.

> Correção 2026-08-19: o modal desktop de novo equipamento não cria mais rolagem vertical quando o seletor de tipo é aberto. O dropdown fica sobreposto ao card e a rolagem continua disponível somente como proteção em telas móveis. Testes, typecheck, build web e rebuild do serviço Docker aprovados.

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

- Em 2026-08-19, o painel geográfico passou a agrupar a lateral por unidade, renderizar todos os links da unidade e listar equipamentos sem telemetria. A regressão de múltiplos links foi coberta por `apps/web/src/state-map-telemetry.test.ts`; testes, typecheck e build foram aprovados.

- Em 2026-08-19, foram provisionados no tenant `default` os dois acessos solicitados: infraestrutura (`tenant_administrator`) e técnico de unidade móvel (`supervisor`). O provisionamento é idempotente e executado no container por `apps/api/src/scripts/seed-requested-users.ts`; senhas não são documentadas.

- Em 2026-08-19, o modal de edição de usuário deixou de limitar a altura e criar scrollbar interna quando há espaço disponível. A largura foi ampliada e a regra foi coberta por `apps/web/src/user-modal-layout.test.ts`; o dropdown mantém rolagem própria somente quando sua lista exceder o limite.

- Em 2026-08-19, a lateral do mapa geográfico recebeu expansão/recolhimento por unidade com chevron animado e `aria-expanded`; a unidade escolhida no mapa é aberta automaticamente e as demais ficam recolhidas por padrão. A regressão foi coberta por `apps/web/src/state-unit-collapse.test.ts`; 12 testes, typecheck e build foram aprovados dentro do Docker.

- Em 2026-08-19, o card de unidade foi refinado para usar o mesmo botão lateral de 34px dos cards de link, com resumo básico dos links (total, operacionais e em atenção). A seleção do marcador abre somente aquela unidade e o fechamento do popup limpa a expansão.

- Em 2026-08-19, Ping/Tracert do menu rápido passaram a selecionar explicitamente um equipamento da unidade com endereço de gerenciamento. O frontend não usa mais o primeiro equipamento arbitrariamente; sem endereço válido, os comandos ficam desabilitados e a interface orienta o cadastro. Foram validados 14 testes, typecheck e build dentro do Docker.

- Em 2026-08-19, a interação dos cards do mapa foi corrigida para manter o ativo clicado como alvo real: links abrem sua análise com ações Ping/Tracert específicas, equipamentos sem telemetria abrem a ação rápida já selecionada e unidades sem ativos oferecem “Cadastrar equipamento” no próprio card. A regressão foi coberta por `apps/web/src/state-map-interactions.test.ts`.

- Em 2026-08-19, a área lateral de ativos recebeu o botão “Adicionar unidade”, que abre o cadastro já contextualizado na UF do mapa. A oscilação visual de telemetria foi corrigida com janela de frescor por fonte: 90s para amostras Zabbix e 30s para agente Starlink; quando só a métrica detalhada do Zabbix atrasa, o estado operacional do host permanece visível. Teste dedicado e suíte completa aprovados no Docker.

- Em 2026-08-19, o menu de unidade foi completado: botão direito no card agora abre “Adicionar equipamento” sem o menu nativo do navegador, e o popup aberto ao clicar no marcador do mapa oferece a mesma ação diretamente. Build, typecheck e suíte completa foram validados no Docker.

- Em 2026-08-19, o botão global “Adicionar unidade” foi removido do cabeçalho da lateral do mapa conforme o fluxo solicitado. O cadastro de equipamento permanece contextual ao card da unidade via clique direito/menu flutuante; o cadastro de nova unidade segue no fluxo administrativo próprio.

- Em 2026-08-19, o menu rápido flutuante da unidade passou a ser fechado junto com o recolhimento do card e com o fechamento do popup/seleção do mapa. A regressão foi coberta em `apps/web/src/state-unit-collapse.test.ts`.

- Em 2026-08-19, erros retornados pela API durante o cadastro de unidade aberto pelo mapa passaram a ser exibidos dentro do próprio modal, sem depender do banner da tela de fundo. A regressão foi coberta em `apps/web/src/form-modal-layout.test.ts`.

- Em 2026-08-19, o worker do MapLibre foi incluído no bundle público do Docker (`maplibre-gl-worker.mjs`, `maplibre-gl-shared.mjs` e alias `.js`), evitando que o fallback SPA devolvesse HTML com MIME incorreto. Assets ausentes passaram a responder 404; a API foi rebuildada e o health check retornou 200.

- A imagem runtime do Docker foi atualizada para instalar `iputils-ping` e `traceroute`; a presença de `/usr/bin/ping` e `/usr/bin/traceroute` foi conferida no container após o rebuild.

- O gráfico de latência exibe tooltip por amostra; itens Zabbix de descarte/erro não são mais aceitos como download/upload, aguardando itens de tráfego válidos quando o host não os fornecer.

- A coleta leve da telemetria usa intervalo padrão de 2 segundos (`ZABBIX_TELEMETRY_INTERVAL_MS`), alinhada ao polling visual do gráfico; a frequência final continua limitada pelo intervalo dos itens configurados no Zabbix.

- Definir mecanismo de provisionamento seguro e rotação de credenciais Zabbix.
- Definir a política de retenção de métricas e eventos técnicos.
- Confirmar se haverá uma instância Zabbix por cliente ou compartilhada entre clientes antes do conector produtivo.

## Tarefa para próxima sessão — homologar provisionamento do agente

- Validar no frontend o fluxo: unidade móvel → equipamento servidor → requisito Starlink/MikroTik → botão de gerar agente.
- Implementar/homologar a escolha Windows/Linux e a geração de um único arquivo instalável, já vinculado à unidade, servidor e fontes permitidas.
- Confirmar execução única no servidor, coleta contínua após reinício e atualização automática da versão do agente.
- Homologar instalação como serviço Windows e como `systemd` no Linux, incluindo reinício automático após atualização.
- Testar aviso de requisito ausente, download, vínculo, heartbeat online/offline e publicação da versão `1.0.0` no catálogo Zabbix.
- Antes de considerar concluído, executar `npm.cmd run typecheck`, `npm.cmd run build:web` e validar o cenário dentro do Docker.
Atualização 2026-08-24: filtros da tela principal ampliados com tipo de unidade (fixa/móvel), situação e UF. O bloco usa o padrão visual dark/glass existente, possui botão de limpeza e quebra responsiva; typecheck e build web aprovados.

Atualização 2026-08-24: implementada a tela Relatórios de incidentes com filtros operacionais, resumo de indicadores, tabela auditável, atualização manual e impressão. A lógica foi coberta por `apps/web/src/incident-reports.test.ts`; suíte completa, typecheck e build web aprovados.

Atualização 2026-08-25: a branch `codex/reestruturacao-visual` iniciou a fundação visual compartilhada. `apps/web/src/styles.css` agora concentra tokens semânticos para texto/estado, sombras, curva de movimento e animações de entrada/expansão/feedback, além da redução automática de movimento para acessibilidade. Próximas etapas aplicarão esses tokens por tela.

Atualização 2026-08-25: o login passou a usar uma revelação única por névoa ciano e blur progressivo, com brilho suave de passagem e sem animação individual dos campos. O bundle foi rebuildado no Docker local e o serviço `healthlink` reiniciado para validar o comportamento.

Atualização 2026-08-25: o hero do login agora usa título dividido em letras, com entrada vertical/blur inspirada na referência Apple Music. O estado final foi validado sem blur residual; o fundo usa gradientes ciano com movimento contínuo discreto.

Atualização 2026-08-25: a animação do hero foi ajustada para o padrão corporativo aprovado: palavras em blocos, entrada única com elevação/blur mínimo e gradiente ciano sem loop contínuo. Typecheck e rebuild Docker foram validados.

Atualização 2026-08-25: aplicado o primeiro refinamento visual no Centro Operacional: resumo, chamada de operação, mapa e ranking usam entrada coordenada e hover sutil, preservando o comportamento operacional existente. Typecheck, build web e rebuild Docker passaram.

Atualização 2026-08-25: aplicado o refinamento minimalista no Centro Operacional. Foram reduzidas sombras, contornos e elementos decorativos dos indicadores; filtros, mapa e ranking ganharam mais respiro sem alterar dados ou interações.

Atualização 2026-08-25: corrigido o modal do mapa estadual que ficava deslocado e cortava o seletor de tema após a animação do Centro Operacional. A janela agora usa portal no `body`, limites de largura/altura baseados na viewport e regras responsivas para o painel de ativos. Typecheck, build web e rebuild Docker foram validados.

Atualização 2026-08-25: o mapa estadual passou a ocupar a viewport em larguras CSS muito amplas, evitando que o zoom reduzido do navegador deixe o card visualmente pequeno. O comportamento padrão em zoom normal foi preservado; typecheck, build web e rebuild Docker passaram novamente.

Atualização 2026-08-25: adicionada sinalização visual de incidentes no pin da unidade no mapa estadual. A severidade mais alta entre os alertas ativos define pin âmbar ou vermelho, com animação de pulso e rótulo acessível; alertas resolvidos são ignorados. A regra foi coberta por teste unitário e validada com typecheck, build web e rebuild Docker.

Atualização 2026-08-28: concluída a hotfix do agente Linux após o `agent.json` ser atualizado. O agente agora usa a versão persistida no startup; o catálogo aceita bundles Node `.cjs` e `.js`, mantendo `.sh`/`.ps1` exclusivos do provisionamento.
Atualização 2026-08-28: corrigido o aviso do Chrome DevTools sobre campos de formulário sem `id`/`name`. Os campos reutilizáveis de data e combobox, além das buscas de unidades e usuários, agora possuem `name`; a regressão foi coberta por `apps/web/src/form-field-identifiers.test.ts`.

Atualização 2026-08-28: corrigido o loop de reinício do agente Linux após atualização automática. A versão baixada agora é persistida no `agent.json`, evitando que o serviço reinstale a mesma versão em cada inicialização. Suíte completa, typecheck, build do agente e build web aprovados.
Atualização 2026-08-28: a distribuição built-in passou a gerar/sincronizar o agente `1.0.2` automaticamente, permitindo que a produção atualizada por `git pull` ofereça a hotfix aos agentes existentes sem depender de um arquivo fora do repositório.
