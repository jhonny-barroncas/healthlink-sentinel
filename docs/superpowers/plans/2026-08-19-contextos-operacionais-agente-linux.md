# Plano: Contextos operacionais, mapas encapsulados e agente Linux

> **Para execução:** usar a skill `superpowers:executing-plans` e a skill `superpowers:test-driven-development`. Executar cada tarefa em uma branch/worktree isolada, com revisão e verificação ao final de cada fatia.

**Especificação aprovada:** [2026-08-19-contextos-operacionais-agente-linux-design.md](../specs/2026-08-19-contextos-operacionais-agente-linux-design.md)  
**Data:** 2026-08-19  
**Status:** plano aguardando aprovação para execução

## Objetivo

Implementar, no HealthLink Sentinel, dois contextos operacionais no mesmo tenant:

- painel de infraestrutura com visão operacional completa;
- painel de unidades móveis com acesso restrito ao contexto `mobile`;
- CRUD de unidades/equipamentos respeitando esse escopo no backend;
- mapa com um único marcador por unidade e ativos agrupados dentro dela;
- provisionamento automático de um agente por unidade;
- enrollment de uso único e credencial específica do agente;
- setup Linux interativo e serviço `systemd` com inicialização automática, restart e logs no `journald`.

## Restrições e decisões de implementação

- Não duplicar unidades, equipamentos ou telemetrias para criar a segunda visão.
- Manter `equipment_id` como identidade canônica do ativo.
- Usar a permissão existente `units.manage` para CRUD de unidades/equipamentos nesta entrega; não introduzir `equipment.manage` sem necessidade.
- Aplicar o escopo no backend antes de calcular agregações, contagens, alertas e telemetria.
- O papel `mobile_operator` terá escopo exclusivamente móvel, salvo quando houver um papel administrativo explícito com precedência de tenant completo.
- Usuários de infraestrutura manterão suas permissões funcionais atuais, mas as consultas operacionais não móveis terão escopo de tenant completo.
- O agente atual Starlink continuará funcionando durante a transição; o caminho novo usará credencial dedicada.
- O coletor novo suportará Starlink primeiro. A estrutura de atribuições permitirá adicionar MikroTik e outros links sem nova instalação.
- O primeiro alvo de instalação será Linux com `systemd`. Windows não será implementado nesta fatia.
- O padrão visual existente — dark, vidro fosco, baixa ornamentação e foco em missão crítica — deve ser preservado.
- Não abrir, copiar ou registrar nenhum segredo local do ambiente.

## Estratégia de testes

Cada fatia seguirá TDD:

1. escrever o teste de comportamento que deve falhar;
2. executar somente o teste e confirmar a falha pelo motivo esperado;
3. implementar a menor mudança necessária;
4. executar o teste da fatia;
5. executar typecheck/build/testes relacionados antes de avançar.

Como o repositório não possui hoje uma suíte de integração HTTP completa com banco descartável, as regras puras de escopo, hash/enrollment, agrupamento de ativos e geração da unidade `systemd` serão isoladas em funções testáveis. As rotas usarão esses serviços e terão testes de contrato com doubles de `PoolClient` ou um harness de banco quando disponível.

## Tarefa 0 — Preparar isolamento de execução

**Objetivo:** evitar que a implementação misture as alterações do usuário já presentes no workspace.

**Arquivos:** nenhum arquivo de produto.

**Passos:**

1. Antes de tocar no código, executar a skill `superpowers:using-git-worktrees`.
2. Confirmar que as alterações atuais em `obsidian/.obsidian`, `.tmp/`, a fila local e os arquivos de apresentação permanecem fora do escopo.
3. Criar, após consentimento para isolamento, uma worktree/branch com prefixo `codex/`, por exemplo `codex/operational-context-agent`.
4. Conferir `git status --short --branch` na worktree e registrar o commit da especificação como base.

**Verificação:** a worktree de implementação começa limpa em relação aos arquivos do produto e não contém os artefatos locais não relacionados.

## Tarefa 1 — Adicionar contexto operacional e regras de autorização

**Objetivo:** tornar `infrastructure`/`mobile` parte do domínio e impedir que o escopo móvel dependa de filtros do frontend.

**Arquivos a criar/modificar:**

- criar `apps/api/database/migrations/010_operational_context.sql`;
- atualizar os seeds de unidades móveis em `apps/api/database/seed_demo_units.sql`, `seed_demo_all_states.sql`, `seed_demo_expansion.sql`, `seed_demo_more_units.sql` e `seed_demo_unknown_units.sql` para gravar `operational_context = 'mobile'` explicitamente;
- modificar `apps/api/src/platform/authorization.ts`;
- criar `apps/api/src/platform/operational-scope.ts`;
- modificar `apps/api/src/modules/units/repository.ts`;
- modificar `apps/api/src/modules/units/routes.ts`;
- modificar `apps/api/src/modules/users/routes.ts`;
- modificar `apps/api/src/scripts/seed-demo-users.ts`;
- criar `apps/api/src/platform/operational-scope.test.ts`;
- criar `apps/api/src/modules/units/authorization.test.ts`.

**Passos TDD:**

1. Testar que `mobile_operator` possui `units.read`, `units.manage`, `monitoring.read` e `alerts.read`, mas não `users.manage`, `integrations.manage` ou `alerts.acknowledge`.
2. Testar que `resolveOperationalScope(['mobile_operator'])` retorna `mobile` e que papéis administrativos/operacionais de tenant retornam `all`.
3. Testar que uma requisição móvel não pode criar uma unidade `infrastructure`, editar uma unidade de infraestrutura ou acessar um ID de unidade fora de `mobile`.
4. Implementar `operational_context` como `text NOT NULL DEFAULT 'infrastructure'` com `CHECK` para `infrastructure/mobile`, índice `(tenant_id, operational_context, active)` e backfill fail-closed.
5. Expor `operational_context` na listagem/detalhe e aceitar `operationalContext` no payload de unidade.
6. Fazer a rota forçar `mobile` para `mobile_operator`; para os demais papéis, permitir escolha explícita e manter `infrastructure` como fallback compatível.
7. Aplicar a resolução de escopo nas consultas do repositório e fazer update/delete retornarem `404` quando a unidade existir, mas estiver fora do escopo.
8. Adicionar `mobile_operator` aos schemas de criação/edição de usuário, à lista de papéis demonstrativos e à apresentação de roles do frontend posteriormente.

**Verificações:**

- `npm.cmd test -- apps/api/src/platform/operational-scope.test.ts apps/api/src/modules/units/authorization.test.ts`;
- validar por SQL que unidades existentes sem classificação continuam em `infrastructure`;
- `npm.cmd run typecheck`.

## Tarefa 2 — Aplicar escopo ao CRUD de equipamentos, monitoramento e alertas

**Objetivo:** garantir que nenhum endpoint operacional vaze dados de infraestrutura para o operador móvel e preparar a projeção agrupada por unidade.

**Arquivos a criar/modificar:**

- modificar `apps/api/src/modules/equipment/repository.ts`;
- modificar `apps/api/src/modules/equipment/routes.ts`;
- modificar `apps/api/src/modules/monitoring/repository.ts`;
- modificar `apps/api/src/modules/monitoring/routes.ts`;
- modificar `apps/api/src/modules/integrations/starlink/routes.ts`;
- criar `apps/api/src/modules/monitoring/overview.ts`;
- criar `apps/api/src/modules/monitoring/overview.test.ts`;
- criar `apps/api/src/modules/equipment/scope.test.ts`.

**Contrato planejado:**

`GET /v1/monitoring/overview` retornará unidades já agrupadas, com `operational_context`, estado agregado, contagens por estado/tipo, ativos, links/telemetria recente, resumo de alertas ativos e estado do agente quando houver.

Os endpoints atuais `/v1/monitoring/units`, `/v1/monitoring/equipment` e `/v1/monitoring/link-telemetry` permanecerão durante a transição, mas passarão a incluir contexto e escopo. As novas telas usarão `/overview`; detalhes e compatibilidade poderão continuar usando as rotas antigas.

**Passos TDD:**

1. Testar que `listEquipment` só retorna equipamentos cujo `unit_id` pertence ao escopo autorizado.
2. Testar que diagnóstico por `equipment/:id` falha com `404` para equipamento de unidade fora do escopo, inclusive quando o ID é manipulado.
3. Testar que unidades, equipamentos, links e alertas agregados de um operador móvel não incluem linhas de infraestrutura.
4. Testar que a projeção agrupa quatro links e um servidor sob uma única unidade e mantém os links separados dentro de `assets/links`.
5. Aplicar joins com `health_units.operational_context` ou filtro de escopo em listagem, criação, edição, desativação, reativação, exclusão e diagnóstico.
6. Filtrar alertas por unidade móvel antes do `LIMIT`, mantendo alertas órfãos fora da visão móvel.
7. Aplicar o mesmo escopo às leituras Starlink por `equipmentId` e às fontes Starlink; rotas administrativas de integração continuarão protegidas por `integrations.manage`.
8. Implementar `listUnitOperationalOverview` sem N+1: carregar projeções operacionais, equipamentos, telemetria e alertas em consultas agrupadas e montar o contrato no backend.
9. Garantir que o estado agregado use a pior condição entre ativos ativos, alertas relevantes e ausência de telemetria, preservando a regra atual de `unknown` após 30 segundos.

**Verificações:**

- testes unitários de escopo e agrupamento;
- teste de idempotência/compatibilidade das rotas Starlink existentes;
- `npm.cmd test -- apps/api/src/modules/monitoring/overview.test.ts apps/api/src/modules/equipment/scope.test.ts`;
- `npm.cmd run typecheck`.

## Tarefa 3 — Criar persistência e enrollment do agente por unidade

**Objetivo:** ao cadastrar o primeiro equipamento compatível em uma unidade móvel, gerar automaticamente a instalação pendente e permitir um código de uso único.

**Arquivos a criar/modificar:**

- criar `apps/api/database/migrations/011_agent_provisioning.sql`;
- criar `apps/api/src/modules/integrations/agent/provisioning.ts`;
- criar `apps/api/src/modules/integrations/agent/provisioning.test.ts`;
- criar `apps/api/src/modules/integrations/agent/routes.ts`;
- criar `apps/api/src/modules/integrations/agent/auth.ts`;
- modificar `apps/api/src/modules/equipment/repository.ts`;
- modificar `apps/api/src/modules/equipment/routes.ts`;
- modificar `apps/api/src/modules/units/repository.ts`;
- modificar `apps/api/src/modules/units/routes.ts`;
- modificar `apps/api/src/modules/auth/plugin.ts`;
- modificar `apps/api/src/server.ts`.

**Modelo de dados:**

- `agent_installations`: tenant, unidade, status (`pending/active/revoked`), hash da credencial, versão, heartbeat, última coleta, timestamps;
- `agent_enrollments`: instalação, hash do código, expiração, uso, revogação, usuário criador e timestamps;
- `agent_installation_equipment`: instalação, equipamento, status e timestamps, com unicidade por instalação/equipamento;
- índices/constraints para impedir mais de uma instalação `pending/active` por unidade e impedir cruzamento de tenant/unidade/equipamento;
- RLS multi-tenant para todas as tabelas novas.

**Rotas planejadas:**

- `GET /v1/units/:unitId/agent` — status da instalação e equipamentos atribuídos;
- `POST /v1/units/:unitId/agent/enrollment` — cria/regenera código, revoga código pendente anterior e devolve o valor secreto uma única vez;
- `POST /v1/units/:unitId/agent/revoke` — revoga instalação/código, respeitando o escopo da unidade;
- `POST /v1/integrations/agent/enroll` — troca código por credencial restrita, sem JWT de usuário;
- `GET /v1/integrations/agent/config` — configuração e atribuições permitidas para o agente autenticado;
- `POST /v1/integrations/agent/heartbeat` — atualiza presença e versão;
- `GET /v1/integrations/agent/status` — usado pelo setup/status para diagnosticar a instalação.

**Passos TDD:**

1. Testar geração de código com alta entropia e armazenamento apenas do hash.
2. Testar expiração, revogação e rejeição de segunda utilização do mesmo código.
3. Testar emissão de credencial nova e escopo contendo somente tenant, instalação, unidade e equipamentos atribuídos.
4. Testar que `mobile_operator` pode criar enrollment de sua unidade móvel, mas não de infraestrutura.
5. Implementar `ensureAgentProvisioning` dentro da transação de criação de equipamento.
6. Considerar `starlink`, `internet_link` e `mikrotik` como tipos inicialmente capazes de gerar provisionamento; somente o coletor Starlink será executado na primeira fatia.
7. Se a unidade já tiver instalação ativa, apenas inserir/atualizar a atribuição do novo equipamento.
8. Revogar instalação quando a unidade for desativada ou mudar administrativamente de `mobile` para `infrastructure`.
9. Adicionar autenticação de agente separada de `app.authenticate`, usando bearer opaco com hash e consulta de status para que revogação tenha efeito imediato.

**Verificações:**

- testes de segredo, escopo e ciclo de vida;
- teste que criação de equipamento não compatível não cria instalação;
- teste que criação de Starlink em unidade móvel cria exatamente uma instalação pendente;
- `npm.cmd test -- apps/api/src/modules/integrations/agent/provisioning.test.ts`;
- `npm.cmd run typecheck`.

## Tarefa 4 — Implementar ingestão dedicada e compatibilidade Starlink

**Objetivo:** fazer o agente usar a credencial restrita, enviar telemetria pelo contrato novo e manter o caminho antigo funcional durante a migração.

**Arquivos a criar/modificar:**

- criar `apps/api/src/modules/integrations/agent/telemetry.ts`;
- criar `apps/api/src/modules/integrations/agent/telemetry.test.ts`;
- modificar `apps/api/src/modules/integrations/agent/routes.ts`;
- modificar `apps/api/src/modules/integrations/starlink/telemetry.ts` para compartilhar normalização;
- modificar `apps/api/src/modules/integrations/starlink/routes.ts` para marcar compatibilidade e preservar a rota atual;
- criar/usar tabela de lotes recebidos na migration `011` para idempotência por `(installation_id, batch_id)`.

**Contrato de ingestão:**

```json
{
  "equipmentId": "uuid",
  "source": "local_agent",
  "observedAt": "ISO-8601",
  "batchId": "uuid",
  "payload": {}
}
```

**Passos TDD:**

1. Testar que o agente autenticado só consegue ingerir equipamento atribuído à própria instalação e unidade.
2. Testar que equipamento de outra unidade, equipamento desativado e tipo incompatível retornam erro sem persistir amostras.
3. Testar que o mesmo `batchId` é aceito uma vez e depois retorna `duplicate` sem duplicar métricas.
4. Testar que heartbeat e ingestão atualizam `last_heartbeat_at`/`last_collection_at` sem aceitar `unitId` arbitrário no body.
5. Reusar `normalizeStarlinkPayload` e `deriveStarlinkStatus` no adapter novo.
6. Atualizar snapshots, localização da unidade e amostras somente depois de validar instalação, atribuição e lote.
7. Manter `/v1/integrations/starlink/telemetry` para o agente legado autenticado com integração, sinalizando o caminho deprecado na documentação sem quebrar o ambiente atual.

**Verificações:**

- `npm.cmd test -- apps/api/src/modules/integrations/agent/telemetry.test.ts apps/api/src/modules/integrations/starlink/telemetry.test.ts`;
- confirmar que erros de escopo não alteram `metric_samples` nem snapshots;
- `npm.cmd run typecheck`.

## Tarefa 5 — Refatorar o agente local para setup interativo e configuração persistente

**Objetivo:** eliminar a necessidade de o técnico informar token, tenant e equipment ID no uso normal.

**Arquivos a criar/modificar:**

- criar `apps/agent/src/setup.ts`;
- criar `apps/agent/src/agent-config-store.ts`;
- criar `apps/agent/src/agent-client.ts`;
- criar `apps/agent/src/cli.ts`;
- criar `apps/agent/src/systemd-unit.ts`;
- criar `apps/agent/src/setup.test.ts`;
- criar `apps/agent/src/systemd-unit.test.ts`;
- modificar `apps/agent/src/config.ts`;
- modificar `apps/agent/src/healthlink-auth.ts`;
- modificar `apps/agent/src/collector.ts`;
- modificar `apps/agent/src/index.ts`;
- modificar `apps/agent/README.md`;
- modificar `package.json`;
- criar `apps/agent/tsconfig.json` e script de cópia dos protobufs se necessário para o pacote compilado.

**Fluxo do setup:**

1. `healthlink-agent setup` pede URL da API e código de enrollment.
2. Consulta a configuração autorizada e os equipamentos atribuídos.
3. Pergunta somente parâmetros locais ausentes, com Starlink `192.168.100.1:9200` como padrão.
4. Persiste API URL, credencial do agente, unidade, assignments, polling, timeout e fila em arquivo de sistema protegido.
5. Executa heartbeat e uma coleta de teste antes de concluir.
6. Não imprime código, bearer ou senha nos logs.

**Passos TDD:**

1. Testar parsing de respostas de enrollment e configuração dinâmica sem exigir `HEALTHLINK_EQUIPMENT_ID`.
2. Testar que a configuração local não grava valores secretos no stdout e que o arquivo usa modo restrito.
3. Testar que o agente escolhe apenas assignments ativos e que uma nova atribuição aparece no próximo refresh de configuração.
4. Testar que o modo legado por `HEALTHLINK_API_TOKEN`/e-mail continua disponível somente como compatibilidade.
5. Implementar `HealthLinkAgentClient` com chamadas autenticadas para config, heartbeat e ingestão.
6. Adaptar o coletor Starlink para produzir lotes usando o `equipmentId` atribuído pelo servidor, mantendo fila local e retry.
7. Criar comandos `setup`, `status`, `restart` e `uninstall`, com mensagens específicas para ausência de root/systemd.

**Build do agente:**

- criar build TypeScript separado para gerar runtime em `dist/agent`;
- copiar `apps/agent/proto` para o pacote final sem depender do checkout original;
- adicionar scripts `agent:build`, `agent:setup`, `agent:status`, `agent:restart` e `agent:uninstall` para desenvolvimento/diagnóstico;
- manter `agent:starlink:check` para teste de rota local sem credencial.

**Verificações:**

- `npm.cmd test -- apps/agent/src/setup.test.ts apps/agent/src/systemd-unit.test.ts`;
- `npm.cmd run agent:build`;
- executar `node dist/agent/cli.js --help` ou equivalente;
- `npm.cmd run typecheck`.

## Tarefa 6 — Instalar e operar o serviço `systemd`

**Objetivo:** fazer o agente iniciar sozinho depois de reboot, aguardar rede e reiniciar após falha.

**Arquivos a criar/modificar:**

- modificar `apps/agent/src/setup.ts`;
- modificar `apps/agent/src/systemd-unit.ts`;
- criar `apps/agent/systemd/healthlink-agent.service.template`;
- modificar `apps/agent/README.md`;
- modificar `docs/DEPLOYMENT.md` com procedimento Linux sem segredos.

**Unidade gerada:**

- `Wants/After=network-online.target`;
- usuário/grupo de sistema `healthlink-agent` sem shell interativo;
- `EnvironmentFile=/etc/healthlink/agent.env` com permissão `0600`;
- runtime instalado em `/opt/healthlink-agent`;
- fila/estado em `/var/lib/healthlink-agent`;
- `Restart=on-failure` e `RestartSec=15`;
- `NoNewPrivileges`, `PrivateTmp` e proteção de filesystem compatíveis com a escrita da fila;
- logs no `journald` via stdout/stderr;
- `WantedBy=multi-user.target`.

**Passos TDD/operacionais:**

1. Testar o conteúdo da unidade e confirmar ausência de tokens/códigos no template.
2. Implementar criação idempotente do usuário de sistema, diretórios, permissões e arquivo de ambiente.
3. Implementar `systemctl daemon-reload`, `enable --now`, `is-active` e mensagens de falha acionáveis.
4. Fazer `status` consultar serviço local e status remoto da instalação.
5. Fazer `uninstall` exigir ação explícita, desabilitar/remover o serviço e informar que a revogação remota é uma ação separada do painel.
6. Documentar comando de instalação para Debian/Ubuntu/systemd e troubleshooting com `journalctl -u healthlink-agent`.

**Verificações:**

- teste unitário do template;
- validação estrutural com `systemd-analyze verify` quando disponível em ambiente Linux;
- em host Linux de teste: reboot, `systemctl is-enabled`, `systemctl is-active`, falha simulada e confirmação de restart;
- nenhum segredo no arquivo de service, template ou documentação versionada.

## Tarefa 7 — Implementar os dois painéis e o mapa encapsulado

**Objetivo:** entregar a separação visual por público e eliminar a apresentação de links/equipamentos como pontos independentes.

**Arquivos a criar/modificar:**

- criar `apps/web/src/operational-view.ts`;
- criar `apps/web/src/operational-view.test.ts`;
- criar `apps/web/src/agent-provisioning-panel.tsx`;
- modificar `apps/web/src/App.tsx`;
- modificar `apps/web/src/styles.css`;
- modificar `apps/web/src/user-form.ts` se o papel novo aparecer na gestão de usuários.

**Passos TDD:**

1. Testar `getDashboardMode` para roles de infraestrutura e `mobile_operator`.
2. Testar agrupamento de ativos: uma unidade com quatro links e servidor resulta em uma unidade com cinco ativos, nunca em cinco marcadores.
3. Testar seleção do pior estado e contagem de links/equipamentos/alertas.
4. Adicionar roles à resposta de login armazenada no frontend e derivar capacidades (`canManageUnits`, `canManageUsers`, `canManageIntegrations`, `canAcknowledgeAlerts`).
5. Criar navegação contextual: painel Infraestrutura para escopo completo e painel Unidades móveis forçado ao contexto móvel; esconder Zabbix, conexões e usuários para o operador móvel.
6. Consumir `/v1/monitoring/overview` no centro operacional, mantendo as rotas detalhadas para inventário e análise.
7. Atualizar formulário de unidade com contexto; para operador móvel, ocultar o seletor e enviar `mobile` automaticamente.
8. Atualizar cards de resumo para mostrar uma unidade como unidade e os ativos dentro de popover/painel agrupado.
9. Alterar `StateLocationMap` para receber overview/equipamentos e renderizar somente um `Marker` por unidade.
10. Adicionar resumo por hover, foco de teclado e clique, com status, quantidade de ativos, links, última coleta e alertas.
11. Manter análise detalhada por `equipment_id`, permitindo escolher qualquer link da unidade em vez de usar somente `telemetryByUnit[0]`.
12. Exibir `AgentProvisioningPanel` no detalhe da unidade móvel: status, última presença/coleta, equipamentos atribuídos, botão para gerar enrollment e apresentação única do código.
13. Esconder ações de acknowledge/resolve para quem não tiver `alerts.acknowledge`, sem confiar nessa ocultação para autorização.
14. Adicionar estilos dark/glass para popover, agrupamento de ativos, badges de contexto e painel de instalação sem criar poluição visual.

**Verificações:**

- `npm.cmd test -- apps/web/src/operational-view.test.ts apps/web/src/user-form.test.ts`;
- `npm.cmd run typecheck`;
- `npm.cmd run build:web`;
- teste manual com usuário móvel: não aparece infraestrutura, integração Zabbix ou usuários; quatro Carretas da Mulher aparecem como quatro unidades;
- teste manual com usuário de infraestrutura: os dois contextos aparecem no mapa e nos indicadores.

## Tarefa 8 — Documentar, migrar e verificar a entrega completa

**Objetivo:** deixar o comportamento operável e registrado no vault compartilhado sem armazenar segredos.

**Arquivos a criar/modificar:**

- criar `obsidian/03-Execucao/Contextos Operacionais e Agente Linux.md`;
- atualizar `obsidian/00-Handoff Novo Chat.md`;
- atualizar `obsidian/03-Execucao/Estado Atual.md`;
- atualizar `obsidian/00-Mapa Mestre do Vault.md` com o link da nova nota;
- atualizar `apps/agent/README.md` e `docs/DEPLOYMENT.md`;
- opcionalmente atualizar a nota específica de mapa e a nota de coleta Starlink com links para a nova decisão.

**Passos:**

1. Documentar o modelo `operational_context`, o papel `mobile_operator`, endpoints de agente, ciclo de enrollment e comandos Linux.
2. Documentar o backfill: seeds móveis explícitos e registros produtivos sem classificação permanecendo em infraestrutura para revisão administrativa.
3. Registrar limitações atuais: coletor Starlink implementado primeiro; MikroTik/link preparados no modelo, mas não coletados ainda.
4. Não registrar tokens, senhas, códigos de enrollment, URLs privadas ou credenciais.
5. Executar a migração em banco de teste, carregar seeds e validar classificação, escopo, CRUD e enrollment.
6. Executar `npm.cmd run typecheck`, `npm.cmd run build:web` e `npm.cmd test` completos.
7. Fazer revisão final de diff, `git diff --check`, status da worktree e logs de teste antes de qualquer claim de conclusão.

## Critérios de conclusão

- Todas as tarefas TDD possuem testes passando.
- O operador móvel não acessa dados de infraestrutura por nenhuma rota operacional.
- A equipe de infraestrutura visualiza os dois contextos sem duplicação de cadastro.
- O mapa tem um marcador por unidade e agrupa links/equipamentos no detalhe visual.
- Criar um equipamento compatível móvel gera enrollment pendente automaticamente.
- O agente troca o código uma vez, usa credencial própria, envia heartbeat/telemetria e pode ser revogado.
- O serviço Linux inicia no boot, aguarda a rede, reinicia após falha e registra no `journald`.
- O agente não depende de `HEALTHLINK_EQUIPMENT_ID`, senha de usuário ou checkout de desenvolvimento no fluxo normal.
- `npm.cmd run typecheck`, `npm.cmd run build:web` e `npm.cmd test` passam com evidência registrada.
- Handoff, estado atual, nota de execução e mapa mestre estão atualizados.

