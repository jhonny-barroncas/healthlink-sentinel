---
type: handoff
project: HealthLink Sentinel
updated: 2026-08-11
status: active
---

## Atualização 2026-09-02 — indicador ciano da navegação lateral

- Correção 2026-09-04: a tabela de usuários passou a conter nomes, e-mails, papéis e status dentro das respectivas colunas. Textos longos usam reticências, o avatar não encolhe e o nome completo fica disponível no hover.

- A navegação lateral recebeu o padrão visual de glider da referência fornecida, adaptado à identidade do HealthLink com ciano no lugar do amarelo.
- Itens principais, subitens e o acesso à Integração Zabbix exibem uma barra luminosa e gradiente discreto quando ativos.
- Foram preservados o recolhimento por hover/foco, RBAC, badges, estados operacionais e todos os manipuladores de navegação existentes.
- A regressão foi ampliada em `apps/web/src/sidebar-collapse.test.ts`.
- A validação também revelou e corrigiu uma chave ausente no bloco de redução de movimento de `form-modal.css`, eliminando o aviso de sintaxe emitido pelo build.

## Atualização 2026-09-02 — incidentes de indisponibilidade do agente

- Corrigida a lacuna de persistência: a API agora possui watchdog de heartbeat dos agentes a cada 15 segundos (`AGENT_HEARTBEAT_WATCHDOG_INTERVAL_MS`).
- Após 30 segundos sem heartbeat, o watchdog abre uma única vez o incidente crítico **Agente sem comunicação** em `alerts`, com eventos correlatos em `alert_events` e `monitoring_events`.
- No próximo heartbeat ou envio de telemetria, o incidente é resolvido e a recuperação também é registrada. Heartbeats regulares não geram eventos para evitar ruído.
- A correção independe de alertas internos enviados pela Starlink, que continuam sendo reconciliados separadamente.

## Atualização 2026-08-24 — revisão visual, repositório do agente e padronização do frontend

Atualização 2026-08-24: a Visão geral recebeu filtros operacionais adicionais para tipo de unidade (fixa/móvel), situação e UF. O recorte selecionado agora alimenta indicadores, mapa e visão operacional, com controles responsivos para tablet e celular.

Atualização 2026-08-24: a navegação Relatórios agora abre o relatório operacional de incidentes, com filtros por período, situação, severidade e unidade; indicadores de total, abertos, reconhecidos, resolvidos, críticos e tempo médio; tabela auditável e impressão. Usa alertas ativos/resolvidos reais já carregados pela aplicação.

- Redesenhado o painel **Repositório do Agente** com estética NET-OPS mission-critical: seletor de sistema estilizado, custom file picker elegante (eliminando o botão nativo feio do browser), botão de publicação proporcional com estado desabilitado inteligente, e cartões de pacotes estruturados com tags monospace de versão (`v1.0.0`), tamanho em KB e hash SHA-256.
- Revisada a troca de tema do mapa estadual: o filtro de inversão escura ficou restrito ao fallback raster, preservando as cores nativas dos estilos vetoriais Dark/Claro; teste dedicado adicionado.
- Alertas do mapa estadual agora aparecem em card compacto separado do pin; a cor/formato do pin representa somente o status operacional da unidade.
- A lateral de ativos do mapa estadual ganhou menu contextual por hover/foco/toque para abrir/editar unidade, relatórios e telemetria, sem exibir erros nesse painel, além do seletor `Exibir` para tudo, somente links ou somente equipamentos. A linha de ping acompanha os valores reais em escala de 0–250 ms com pulso animado; a navegação também respeita corretamente unidades fixas e móveis.
- Correção 2026-09-04: o botão `+` controla exclusivamente o submenu contextual, enquanto a seta mantém hover próprio e clique para expandir/recolher o card. Os itens do submenu usam superfície opaca, inclusive quando uma ação está indisponível.
- Refinamento 2026-09-04: ao entrar com o ponteiro na seta, o card da unidade é expandido e permanece aberto para permitir acesso aos ativos; clique, teclado e toque continuam disponíveis para alternar o estado.
- Atualização 2026-09-04: o gráfico de latência detalhado agora seleciona a amostra pelo eixo X inteiro, exibindo `ms` e horário mesmo quando o cursor não está exatamente sobre o ponto.
- Adotada a família tipográfica **Inter** (Google Fonts) integrada com fallback sans-serif e antialiasing/otimização de renderização no `body`.
- Expandido o sistema de tokens CSS no `:root` de `apps/web/src/styles.css` com escala estruturada de `border-radius` (`--radius-xs` a `--radius-full`), superfícies (`--surface-1` a `--surface-3`), transições e z-index padronizados.
- Consolidada a base visual dos botões (`.primary`, `.secondary-button`, `.danger-button`, `.warning-button`, `.positive-button`, `.icon-button`) com elevação uniforme, gradientes refinados e feedback `:focus-visible` em anel ciano para acessibilidade por teclado.
- Removido markup morto de tema em `App.tsx` e classes de `display: none` em `styles.css`.
- Validação: `npm.cmd run typecheck` e `npm.cmd run build:web` aprovados; assets em `dist/web` atualizados para o Docker container.

## Atualização 2026-08-21 — bootstrap do sysadmin e domínio canônico

- O Docker Compose agora executa `bootstrap` depois de `migrate` e antes de `healthlink`.
- `npm run bootstrap:sysadmin` garante o usuário sysadmin do tenant `default` de forma idempotente.
- A senha do sysadmin permanece somente no `.env`/secret local; não deve ser registrada em notas, código, logs ou commits.
- `HEALTHLINK_SYSADMIN_RESET_PASSWORD` controla explicitamente uma troca de senha existente; o padrão é não sobrescrever.
- `PUBLIC_APP_URL` é a URL canônica para os instaladores dos agentes; `PUBLIC_API_URL` continua como fallback legado.
- Validação: build Docker com typecheck e build web passou; Compose subiu; bootstrap foi executado duas vezes com sucesso; `/health` respondeu 200; asset `maplibre-gl-worker.mjs` respondeu 200.

> Atualização 2026-08-13: módulo Starlink iniciado pela estratégia híbrida, com ingestão normalizada e fontes configuráveis. Consulte [[03-Execucao/Modulo Starlink - Estrategia Hibrida]].

> Atualização 2026-08-15: definido o plano de coleta da unidade móvel: servidor local obrigatório como agente/ponte, Starlink via gRPC local como fonte primária e MikroTik opcional para caminho e interfaces. Consulte [[03-Execucao/Plano de Coleta Starlink e Unidade Movel]].

> Atualização 2026-08-15: primeira versão do agente local Starlink implementada em `apps/agent/src`, com cliente gRPC, fila local, retry e envio autenticado. Consulte [[03-Execucao/Modulo Starlink - Estrategia Hibrida]].

> Validação 2026-08-15: a topologia real foi testada. PC na LAN do MikroTik alcança `192.168.100.1:9200` pela Ethernet (`TcpTestSucceeded: True`), liberando o próximo teste do agente contra a antena real. Consulte [[03-Execucao/Plano de Coleta Starlink e Unidade Movel]].

> Atualização 2026-08-17: o agente passou a aceitar usuário de serviço com perfil RBAC `service_agent` e renovar o JWT automaticamente, eliminando a dependência de sessão expirada do usuário operacional. Consulte [[03-Execucao/Modulo Starlink - Estrategia Hibrida]].

> Atualização 2026-08-17: iniciada a Fase 1 da integração baseada no Eitol/starlink-client. O agente agora usa um adapter gRPC isolado com os protobufs do projeto e oferece `npm.cmd run agent:starlink:check` para validar somente a conectividade da unidade antes de configurar o envio ao HealthLink. Consulte [[03-Execucao/Modulo Starlink - Estrategia Hibrida]].

> Atualização 2026-08-17: o diagnóstico passou a identificar a interface local que alcança a Starlink, testando cada IPv4 disponível. Neste ambiente, a conexão foi detectada pela Ethernet `192.168.88.254`; métricas ausentes ou inválidas, como latência `-1`, são exibidas como `N/D`.

> Atualização 2026-08-17: o agente passou a incluir no log de falha de autenticação a mensagem sanitizada da API, limitada e sem credenciais, para diagnosticar respostas `HTTP 500` do backend.

> Atualização 2026-08-17: o cadastro/edição de usuários agora permite definir explicitamente a senha, inclusive para identidades de serviço com e-mail técnico que não recebem convite.

> Validação 2026-08-17: primeira coleta ponta a ponta concluída. O agente consultou a antena Starlink, autenticou com o usuário de serviço e enviou 5 métricas à API, zerando a fila pendente.

> Atualização 2026-08-17: concluída a projeção inicial no frontend. O detalhe da unidade consulta as últimas métricas Starlink a cada 15 segundos e a API preenche a geolocalização da unidade quando a antena fornece um par válido e não há coordenadas manuais.

> Correção 2026-08-17: corrigida a tela preta no painel Starlink convertendo valores numéricos serializados como texto antes da formatação no frontend.

> Correção 2026-08-17: ajustada a projeção operacional para não indicar comunicação com base em snapshot antigo ou métricas auxiliares; Starlink sem coleta recente (30s) aparece como sem telemetria.

> Correção 2026-08-17: o painel Starlink agora oculta valores persistidos antigos e mostra `N/D` quando a amostra mais recente tem mais de 30 segundos, evitando confundir histórico com telemetria atual.

> Atualização 2026-08-17: a API e o painel Starlink agora indicam explicitamente erro do coletor quando não há amostra por mais de 30 segundos, orientando verificar o serviço do agente e a conectividade com a antena.

> Atualização 2026-08-17: a branch remota `frontend-padronizacao` foi incorporada à `main` local a partir do merge publicado no GitHub. A padronização de UI foi combinada manualmente com o painel Starlink, autenticação de usuário de serviço e regras de telemetria stale.

> Atualização 2026-08-18: a mesma regra de ausência de comunicação foi aplicada à telemetria de links/Zabbix: após 30 segundos sem amostra, a projeção fica `unknown`, valores atuais são zerados e o painel registra aviso de telemetria zerada; dados históricos permanecem preservados.

> Atualização 2026-08-19: corrigido o cadastro de usuários para não exigir CPF/coligada fora do contrato atual da API; senha é obrigatória apenas na criação e o backend bloqueia tentativa de auto-bloqueio. Consulte [[03-Execucao/Painel de gerenciamento de usuarios]].

> Atualização 2026-08-19: fluxo Docker validado com `docker compose up -d --build`; migrations executadas pelo serviço `migrate`, frontend/API servidos na porta `5174` e `GET /health` respondendo 200. Corrigido o wildcard duplicado do Fastify ao servir a SPA. Consulte `README.md` e `docs/DEPLOYMENT.md`.

> Atualização 2026-08-18: o usuário agora pode escolher `Dark` ou `Claro` no mapa geográfico estadual. A preferência é salva no navegador e funciona também quando o mapa precisa usar o fallback raster; o mapa nacional continua dark.

> Atualização 2026-08-18: os cards do mapa estadual foram separados por fonte: links com métricas de interface exibem latência/perda/tráfego, VPN/IPsec exibe apenas estado do túnel e Starlink possui card próprio com métricas específicas da antena quando disponíveis.

> Correção 2026-08-18: ajustada a hierarquia visual da análise detalhada e do menu contextual do mapa. Ping manual bem-sucedido agora aparece como medição local mesmo quando o Zabbix não tem amostra recente, sem mascarar essa origem como telemetria do Zabbix.

> Atualização 2026-08-13: o gráfico detalhado de latência possui tooltip próprio com valor em ms e horário da amostra; valores submilissegundo não são mais arredondados para zero. Ping manual e coleta automática permanecem fluxos distintos. Consulte [[03-Execucao/Tooltip e origem da latencia]].

> Atualização 2026-08-13: corrigido o ranking de itens SNMP para hosts FortiGate com múltiplas interfaces. O `FW-LAV-IRANDUBA` foi validado usando `wan1 (LINK-ICOM-100Mb)`. Consulte [[03-Execucao/Correcao Telemetria SNMP FortiGate]].

# Handoff de contexto — HealthLink Sentinel

Atualização 2026-08-28: o agente local Starlink passou a enviar incidentes individuais derivados dos alertas ativos da antena. A API reconcilia esses incidentes por equipamento, abre/recupera registros em `alerts`, registra `alert_events` e `monitoring_events` e evita duplicidade entre coletas. O bundle do agente foi promovido para `1.0.3`. Consulte [[03-Execucao/Modulo Starlink - Estrategia Hibrida]].

Atualização 2026-08-28: unidades fixas e móveis agora podem ser excluídas pelos dois pontos da interface — botão no cabeçalho do detalhe e ação no menu contextual do card. A confirmação chama `DELETE /v1/units/:id`, que apaga transacionalmente os dados operacionais vinculados e preserva somente o registro de auditoria da exclusão.

Atualização 2026-08-27: corrigido o fallback raster do mapa estadual para usar tiles públicos do OpenStreetMap. O fallback anterior do CARTO passou a exigir API key e exibia `API KEY REQUIRED`; a correção foi feita na branch `codex/corrigir-mapa-cartografico` com teste de regressão.

Correção 2026-08-24: clicar em uma opção da barra lateral não mantém mais o menu expandido depois que o ponteiro sai. Interações por ponteiro removem o foco residual do botão; a navegação por teclado continua usando `focus-within`, sem depender de `:has()` nas regras essenciais.

Atualização 2026-08-24: ao receber `401`, a tela de sessão expirada passa a funcionar como uma camada de saída acima dos demais popovers. Qualquer toque/clique, além de Enter, Espaço ou Esc capturados globalmente, remove a sessão local e retorna ao login.

Atualização 2026-08-24: corrigida a regressão visual da barra lateral recolhível. Elementos transparentes não reservam mais largura no modo compacto, mantendo ícones centralizados, e a lateral expandida fica acima do cabeçalho/conteúdo sem cortes por camadas concorrentes.

Atualização 2026-08-24: navegação lateral desktop recolhível por hover/foco implementada sem deslocar o conteúdo; responsividade da gestão de usuários ajustada para tablet e celular. Testes dedicados: `sidebar-collapse.test.ts` e `users-responsive-layout.test.ts`.

Atualização 2026-08-24: a navegação foi renomeada para **Visão geral** e separada em **Unidades** e **Unidades móveis**. A classificação é persistida em `health_units.unit_type`; unidades legadas recebem `mobile`. O perfil `mobile_unit_supervisor` é filtrado no backend para unidades móveis.

Use esta nota como ponto de entrada ao migrar para outro chat do Codex. O projeto é um SaaS corporativo de missão crítica para monitoramento de unidades móveis de saúde. A documentação oficial do PRD e as ADRs têm prioridade sobre qualquer interpretação desta nota.

## Prompt para colar no novo chat

> Você está continuando o projeto HealthLink Sentinel. Antes de responder ou alterar código, leia integralmente:
> 1. `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian\00-Handoff Novo Chat.md`
> 2. `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian\00-Contexto Atual.md`
> 3. `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian\00-Índice e Contexto Atual.md`
> 4. `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian\00-Mapa Mestre do Vault.md`
> 5. `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian\03-Execucao\Estado Atual.md`
> 6. `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian\01-Produto\Fonte PRD\README — Índice da fonte oficial.md`
> 7. A ADR relevante em `obsidian\04-Decisoes` e as notas específicas apontadas pelo Mapa Mestre.
> Considere o vault do Obsidian como memória documental do projeto, mas valide sempre o código atual antes de implementar. Não recrie módulos já existentes. Ao finalizar mudanças, atualize esta nota e a nota do módulo correspondente.

## Localização dos arquivos

Atualização 2026-08-21: o desenvolvimento local agora usa HTTPS ponta a ponta. `npm.cmd run dev` atende a API em `https://localhost:3002` e `npm.cmd run dev:web` atende o Vite em `https://localhost:5173`; os certificados são gerados em `.certs/` por `npm.cmd run dev:cert` e permanecem fora do Git. O certificado é autoassinado, então o navegador precisa aceitá-lo uma vez.

Atualização 2026-08-24: o versionamento do agente passou a ser automático. A publicação calcula o próximo patch por tenant (`1.0.0` → `1.0.1`), embute a versão no bundle baixável, valida o marcador e recalcula o SHA-256. O bundle responde `node healthlink-agent-<versao>.cjs --version`.

Atualização 2026-08-24: erros de validação no login e nos fluxos de usuários passaram a ser traduzidos para mensagens operacionais amigáveis, sem exibir JSON bruto ou detalhes internos. E-mails têm limite de 254 caracteres e senhas de 8 a 200 caracteres na API e nos formulários. As consultas de usuários foram revisadas e permanecem parametrizadas.

Atualização 2026-08-25: iniciada a reestruturação visual geral na branch `codex/reestruturacao-visual`. A primeira camada consolidou tokens semânticos de texto/estado, sombras, curva de movimento e animações reutilizáveis (`motion-enter`, `motion-fade`, `motion-expand`, `status-live`), com fallback global para `prefers-reduced-motion`. Não houve alteração de regras de negócio, RBAC ou contratos da API.

Atualização 2026-08-25: a animação do login foi refinada para uma entrada composta inspirada na referência Apple Music: névoa ciano difusa, brilho de passagem e revelação conjunta do layout por blur/opacidade. A entrada individual sequencial dos campos foi removida para preservar uma apresentação corporativa mais elegante.

Atualização 2026-08-25: a tela de login passou a animar o título principal letra por letra, com deslocamento vertical e blur que termina em nitidez total. O fundo mantém gradientes ciano em movimento suave; a regra de animação foi corrigida para não deixar o texto borrado após a conclusão.

Atualização 2026-08-25: refinada a direção do login para uma linguagem mais corporativa. O título agora entra por blocos de palavras, com deslocamento curto e blur mínimo; o fundo executa somente uma transição de gradiente, sem movimento contínuo ou efeito promocional.

Atualização 2026-08-25: iniciado o segundo lote visual no Centro Operacional. Indicadores, chamada operacional, mapa e ranking agora entram com transição única e hierarquia de elevação/hover discreta, sem alteração no recorte de dados ou nas regras de monitoramento.

Atualização 2026-08-25: o Centro Operacional recebeu um passe minimalista. Cards de indicadores perderam decoração e sombras pesadas, filtros usam divisores sutis e mapa/ranking passaram a ter mais espaço visual e menor ruído de borda.

Atualização 2026-08-21: o HTTPS direto do Docker foi isolado em `docker-compose.local-https.yml`.

Atualização 2026-08-27: o perfil Docker de servidor passou a usar HTTPS ponta a ponta: o proxy reverso encaminha para `https://127.0.0.1:3003` e o Fastify recebe `HTTPS=true` dentro do container. Os certificados são montados somente leitura por `HEALTHLINK_TLS_DIR`, `HEALTHLINK_TLS_KEY_FILE` e `HEALTHLINK_TLS_CERT_FILE`; nenhum certificado ou segredo é versionado.

Correção 2026-08-21: o build Docker não depende mais da existência dos certificados locais; o Vite ativa HTTPS somente quando `.certs/localhost*.pem` está presente.

- Projeto: `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel`
- Backend/API: `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\apps\api`
- Frontend: `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\apps\web`
- Frontend principal: `apps\web\src\App.tsx`
- CSS principal: `apps\web\src\styles.css`
- Banco/migrações: `apps\api\migrations` e módulos da API
- Vault Obsidian: `C:\Users\ADMIN\Documents\Codex\healthlink-sentinel\obsidian`
- API local: `http://localhost:3000`
- Frontend local: `http://localhost:5173` ou `http://<IP-da-máquina>:5173`
- Zabbix API: `http://10.0.0.37/zabbix/api_jsonrpc.php`

## Arquitetura atual

- API Fastify/TypeScript com JWT, multi-tenancy, RBAC, auditoria e PostgreSQL.
- React + Vite no frontend, com identidade dark corporativa e glassmorphism.
- Fluxo central: unidade → equipamento → host Zabbix → problemas/eventos → estado operacional.
- Mapa vetorial do Brasil com `@svg-maps/brazil`.
- Detalhe geográfico por estado com mapa dark em MapLibre/OpenFreeMap, zoom, marcadores e localização manual.
- Integração Zabbix 7.4.1 com teste, catálogo de hosts, mapeamento, preview e sincronização automática.

## Funcionalidades implementadas

- Login, sessão JWT, `/v1/auth/me`, seleção de tenant e permissões.
- CRUD de unidades com UF selecionável/digitável, cidades dependentes e latitude/longitude.
- CRUD de equipamentos: criar, editar, desativar, excluir e confirmação de ações destrutivas.
- Tela visual de integração: lista de hosts, equipamentos, sugestões e vínculo host → equipamento.
- Alertas separados em ativos e histórico resolvido.
- Centro operacional com indicadores, mapa interativo, filtros e ranking/histórico.
- Menu contextual por clique direito em estado/unidade com adicionar unidade/equipamento e diagnósticos Ping/Tracert.
- Diagnóstico exibido em painel flutuante, sem redirecionamento.
- Gestão de usuários: criar, editar, bloquear/desbloquear, excluir e aprovar solicitações de acesso.
- Cadastro de usuário externo via “Criar conta (sujeito a aprovação)”.
- Cards de status, tooltips e modais flutuantes seguindo o padrão visual corporativo.

## Correções mais recentes

- O painel geográfico estadual agora agrupa os ativos por unidade e preserva todos os links retornados pela API; equipamentos sem telemetria também aparecem na lateral, em vez de somente o primeiro link de cada unidade. A seleção de um link mantém a análise detalhada específica.
- O modal desktop de cadastro de equipamento deixou de criar rolagem vertical ao abrir o seletor de tipo: o card usa a altura disponível sem limitar o conteúdo e o dropdown fica visível como sobreposição. Em telas móveis, a rolagem de segurança foi preservada.
- Corrigido SQL da listagem de usuários: `ut.active` foi incluído no `GROUP BY`; usuários bloqueados continuam visíveis.
- Botão Excluir usuário agora remove apenas a associação ao tenant (`DELETE FROM user_tenants`), preservando usuário global/histórico; bloquear continua sendo ação distinta.
- Botão Excluir possui confirmação no frontend.
- Corrigido CSS truncado em `apps/web/src/styles.css` que causava erro Vite `Unclosed block`.
- Removido o botão visual de troca de tema do cabeçalho; o produto permanece em modo escuro corporativo. O perfil do usuário foi mantido.
- Última validação: `npm.cmd run typecheck` e `npm.cmd run build:web` passaram.
- O painel lateral do mapa estadual recebeu cards de telemetria de links com latência, perda, tráfego de entrada/saída, banda nominal e sparkline. A coleta usa itens reais do Zabbix e persiste amostras multi-tenant; dados ausentes são exibidos como `Sem telemetria`, sem valores simulados.
- Corrigida tela escura ao abrir o mapa: o componente `Map` do React Map GL colidia com o construtor nativo usado para agrupar telemetria; o código agora usa `globalThis.Map`.
- A telemetria de links possui ciclo rápido separado: `item.get` e atualização dos cards a cada 2 segundos por padrão. A sincronização completa continua em 60 segundos e os ciclos possuem trava contra sobreposição; a frequência final depende do intervalo dos itens no Zabbix. Para latência nova a cada 2 segundos, o item `icmppingsec` deve usar `2s` no Zabbix.
- O painel `Links Ativos` do mapa estadual foi redesenhado conforme a referência NET-OPS: cards compactos, selos de estado, telemetria e sparkline luminoso, preservando o dark glassmorphism do HealthLink.
- O modal do mapa estadual e sua coluna `Links Ativos` foram ampliados para melhorar a leitura: painel de até 1480px, lateral responsiva de 350px a 420px e cards com fontes, gráficos e espaçamentos maiores.
- O card inteiro de link passou a focalizar a unidade. `Abrir unidade` agora abre uma análise detalhada flutuante, baseada em telemetria real, com acesso secundário ao inventário completo; ações fictícias do protótipo não foram incluídas.
- A telemetria visual de links agora destaca download (`net.if.in`) e upload (`net.if.out`).
- Por decisão de confiabilidade, `net.if.speed` deixou de preencher a velocidade do link. Antes da conclusão do cadastro de banda contratada, o painel mostrava `N/D`; valores históricos anteriormente persistidos são preservados, porém ignorados pela projeção atual.
- A pendência cadastral foi concluída pela migration `007_equipment_contracted_bandwidth.sql`: equipamentos de conectividade aceitam download e upload contratados em Mbps. O mapa exibe esses valores separadamente do tráfego Zabbix e mantém `N/D` por direção quando o operador não informou o plano.
- O modal de análise do link foi corrigido para não cortar o conteúdo: ocupa a altura interna disponível, mantém o cabeçalho e aplica rolagem dark somente ao corpo. `Origem da telemetria` foi substituído por histórico real de alertas ativos/resolvidos do equipamento, limitado às oito ocorrências mais recentes e sem dados simulados.
- O Ping manual passou a retornar a média real em milissegundos. A medição é aplicada imediatamente ao card, sparkline e gráfico do link na sessão atual, com indicação explícita `Último ping local · medição manual`; na ausência de diagnóstico manual, a tela usa a amostra do Zabbix. Essa distinção corrige a comparação entre origens diferentes (por exemplo, Zabbix ~0,7 ms versus ping local ~172 ms).

## Como executar

Atualização recente: o gráfico detalhado mostra tooltip de latência por amostra, e a classificação de tráfego Zabbix ignora itens de erro/descartes, priorizando bits/bytes recebidos e enviados.

```powershell
cd C:\Users\ADMIN\Documents\Codex\healthlink-sentinel
npm.cmd run dev
```

Se a porta 3000 já estiver ocupada, não iniciar uma segunda API; verificar o processo existente ou encerrá-lo somente após confirmar o PID. Depois de alterações no frontend, usar `Ctrl+F5` no navegador.

## Regras de continuidade

1. Não apagar ou substituir funcionalidades existentes sem autorização explícita.
2. Não gravar senhas, tokens ou segredos no Obsidian, código ou commits.
3. Ler o PRD antes de decisões de arquitetura/UX.
4. Conferir rotas e tipos existentes antes de criar uma nova API.
5. Usar `apply_patch` nas edições.
6. Atualizar o Obsidian após mudanças relevantes.
7. Executar typecheck/build ao terminar uma alteração relevante.
8. Manter o visual: dark, vidro fosco, bordas suaves, leitura operacional e sem aparência de dashboard genérico.

## Próximo foco recomendado

Revisar a gestão de usuários ponta a ponta (listagem de bloqueados, aprovação, edição e exclusão) diretamente no navegador, confirmar os endpoints com a API reiniciada e depois consolidar a tela de detalhe da unidade para não duplicar equipamentos entre monitoramento e inventário.

Em 2026-08-19 foram provisionados no tenant `default` os acessos solicitados para infraestrutura (`tenant_administrator`) e técnico de unidade móvel (`supervisor`). As senhas não são registradas neste vault; o script idempotente está em `apps/api/src/scripts/seed-requested-users.ts` e foi executado dentro do Docker.

Regra visual reforçada em 2026-08-19: modais flutuantes devem aumentar para acomodar o formulário e não criar scrollbar interna quando houver espaço disponível. O modal de edição de usuário foi ajustado para crescer sem `max-height`/`overflow: auto`, com regressão coberta por `apps/web/src/user-modal-layout.test.ts`.

No mapa geográfico, os ativos laterais agora podem ser recolhidos/expandidos por unidade usando um controle acessível com chevron animado. A unidade selecionada pelo mapa abre automaticamente; as demais começam recolhidas para manter a lateral limpa.

Em 2026-08-19, o card de unidade foi alinhado ao card de link: botão lateral de 34px com seta, resumo compacto de links totais/operacionais/em atenção e detalhe expandido apenas para a unidade selecionada. Ao fechar a seleção do mapa, a unidade é recolhida novamente.

Diagnósticos do mapa corrigidos em 2026-08-19: Ping/Tracert agora usam um equipamento da própria unidade com endereço de gerenciamento, com alvo selecionável no menu de ação rápida. Equipamentos sem endereço não são enviados ao comando; a seleção é coberta por `apps/web/src/diagnostic-target.test.ts`.

Interação dos ativos do mapa refinada em 2026-08-19: o clique em cada link/equipamento preserva o `equipment_id` exato como alvo dos comandos; links abrem a análise com Ping/Tracert do próprio ativo, equipamentos sem telemetria abrem a ação rápida já selecionada e unidades sem ativos exibem o cadastro vinculado à unidade. A seleção e o estado vazio são cobertos por `apps/web/src/state-map-interactions.test.ts`.

Em 2026-08-19, a área de ativos do mapa passou a oferecer “Adicionar unidade”, reutilizando o formulário com a UF do mapa atual. A política de frescor da telemetria também foi separada por fonte: Zabbix tolera até 90s para acomodar o intervalo real dos itens, enquanto o agente Starlink mantém 30s; o estado operacional do host Zabbix é preservado quando apenas a métrica detalhada está atrasada. Teste dedicado em `apps/api/src/modules/monitoring/telemetry-freshness.test.ts`.

Correção adicional do mapa em 2026-08-19: o card da unidade intercepta o botão direito e abre o menu rápido com “Adicionar equipamento”; o popup do marcador no mapa também oferece essa ação diretamente, além de “Abrir unidade”.

Ajuste solicitado em 2026-08-19: removido o botão global “Adicionar unidade” do cabeçalho da lateral do mapa. O card da unidade (ex.: SEDE) continua sendo o ponto contextual para clique direito e cadastro de equipamento, enquanto o cadastro de nova unidade permanece disponível no fluxo próprio de administração/mapa estadual.

Correção de fechamento em 2026-08-19: o menu rápido flutuante da unidade agora é limpo ao recolher o card ou fechar a seleção/popup do mapa; não fica mais aberto sobre a lateral depois que o contexto é encerrado.

Correção de cadastro no mapa em 2026-08-19: falhas da API ao cadastrar uma unidade agora aparecem dentro do próprio modal “Nova unidade móvel”, em vez de somente no banner da tela que fica atrás do mapa.

Correção do mapa/serviço em 2026-08-19: o build Docker passou a copiar os módulos oficiais `maplibre-gl-worker.mjs` e `maplibre-gl-shared.mjs` para os assets públicos, incluindo alias `.js` para clientes antigos. Rotas `/assets/*` inexistentes agora retornam 404 em texto, sem mascarar a ausência com `index.html`/MIME `text/html`.

Também em 2026-08-19, a imagem Linux do Docker passou a instalar `iputils-ping` e `traceroute`, que estavam ausentes no container e impediam a execução mesmo com o alvo correto.

Atualização 2026-08-20: o provisionamento do agente foi concluído na branch `codex/provisionamento-agente-1.0`. Cada servidor ativo exibe `Gerar agente`; o backend exige servidor e Starlink/MikroTik/link ativos, pergunta Windows/Linux e baixa um único `.ps1`/`.sh` sem prompts. O arquivo contém enrollment de uso único por 30 minutos, o vínculo da unidade e as atribuições. O monitoramento agora diferencia `pending`, `online`, `offline` e `unlinked`; o agente envia heartbeat e atualiza o bundle por SHA-256. A versão real `1.0.0` é empacotada em `dist/agent` e sincronizada para o catálogo Windows/Linux.
Nova nota: `obsidian/03-Execucao/Agente - Atualizacao Automatica e Versao 1.0.md` documenta a atualização automática por plataforma, validação SHA-256, substituição atômica e a pendência de homologar os serviços Windows/systemd.

Próxima tarefa: homologar o instalador `1.0.0` em um servidor Windows e um Linux real da unidade móvel, validar serviço persistente, coleta contínua, atualização automática, revogação e comportamento após expiração/uso duplicado do arquivo.

Manual operacional de produção: `docs/MANUAL-IMPLANTACAO-PRODUCAO.md`, com Docker Compose, HTTPS, backup, migrations, geração do agente e troubleshooting.

Atualização 2026-08-21: a aplicação HealthLink foi padronizada para escutar na porta TCP `3002` no container e no override do servidor. O healthcheck, Dockerfile, exemplos de ambiente e manuais foram alinhados; GLPI permanece em `8090` e Uptime Kuma em `3001`. O serviço de retenção do PostgreSQL executa a limpeza periódica definida em `scripts/postgres-retention.sql`.

Correção 2026-08-24: o healthcheck do Compose passou a detectar automaticamente se a API local está em HTTP ou HTTPS, respeitando `HTTPS=true` do ambiente local. Isso evita o container ficar como `unhealthy` quando a API usa certificado local.

Correção adicional 2026-08-24: o CORS da API passou a aceitar as origens HTTPS locais e do domínio oficial nas portas `3002`/`3003`, mantendo as portas de desenvolvimento existentes. Isso permite o login quando o frontend é servido diretamente pela API em HTTPS.

Correção visual 2026-08-25: o modal de visão geográfica estadual passou a ser renderizado no `body` via portal. A animação do Centro Operacional aplicava `transform` ao contêiner da tela, fazendo um modal `position: fixed` usar a área interna como referência e ficar deslocado/cortado. O dimensionamento agora respeita a viewport e adapta cabeçalho, mapa, painel lateral e rodapé em telas menores.

Ajuste visual 2026-08-25: o modal estadual ganhou dimensionamento fluido em viewports muito amplas, cenário comum quando o zoom do navegador está em 50%/67%. Assim ele não fica reduzido por um teto fixo de largura/altura; no zoom normal os limites anteriores permanecem.

Atualização visual 2026-08-25: os marcadores georreferenciados do mapa estadual agora sinalizam incidentes ativos por unidade. Alertas de atenção usam pin âmbar com pulso discreto; severidades críticas usam pin vermelho com pulso mais evidente; alertas resolvidos não permanecem sinalizados. O marcador mantém a unidade como único ponto do mapa e expõe a contagem no rótulo acessível.

## Documentação relacionada

- [[00-Mapa Mestre do Vault]]
- [[00-Contexto Atual]]
- [[00-Índice e Contexto Atual]]
- [[02-Arquitetura/Briefing Visual - Como funciona o HealthLink Sentinel]]
- [[01-Produto/Fonte PRD/README — Índice da fonte oficial]]
- [[02-Arquitetura/Arquitetura de Referência]]
- [[03-Execucao/Estado Atual]]
- [[03-Execucao/Painel de gerenciamento de usuarios]]
- [[03-Execucao/Frontend - Cadastro e Vinculo Zabbix]]
- [[03-Execucao/Centro Operacional - Mapa Interativo]]
- [[04-Decisoes/ADR-001 Multi-tenancy desde o MVP]]

## Artefatos gerados

- PDF executivo do briefing visual: `output/pdf/HealthLink Sentinel - Briefing Visual do Sistema.pdf` (gerado e conferido em 2026-08-11).

- Cadastro de equipamentos: campos opcionais aceitam vazio, serial duplicado recebe mensagem orientativa e falhas aparecem em toast. Consulte [[03-Execucao/Correcao Cadastro de Equipamentos - Campos Opcionais]].

Hotfix operacional 2026-08-28: o startup do agente passou a respeitar a versão persistida após uma atualização, corrigindo o loop observado no Raspberry Pi. O catálogo de releases aceita bundles Node `.cjs` e `.js`; instaladores `.sh`/`.ps1` permanecem gerados separadamente por enrollment.
Correção de acessibilidade 2026-08-28: os campos reutilizáveis de data/combobox e a busca de unidades/usuários passaram a expor `name`, eliminando o aviso do Chrome DevTools sobre campos de formulário sem identificador. A suíte, o typecheck e o build web foram validados na branch `codex/avaliar-correcao-mapa`.

Correção operacional 2026-08-28: o agente Linux atualizava o bundle para `1.0.1`, mas mantinha `version: 1.0.0` no `agent.json`, causando reinício contínuo com código 75. O updater agora persiste a versão instalada atomicamente no arquivo de configuração; o caso foi coberto por teste.
Hotfix de distribuição 2026-08-28: a versão embutida padrão do agente foi elevada para `1.0.2` no build e na sincronização built-in da API. Assim, o Docker que for puxado pela `main` gera e publica automaticamente o bundle corrigido para atualização dos agentes instalados.

Correção visual 2026-09-04: o sparkline compacto dos links agora normaliza o eixo vertical pelo histórico recente. Variações de ping abaixo de 1 ms passam a produzir subidas e descidas visíveis sem alterar tamanho, estrutura ou designer do card.

Correção operacional 2026-08-31: o scheduler Zabbix deixou de chamar a própria API por HTTP em `127.0.0.1`. As sincronizações completa e de telemetria agora usam `app.inject`, funcionando também quando o container de produção atende HTTPS internamente. Ajustes locais de Docker permanecem fora do commit.
