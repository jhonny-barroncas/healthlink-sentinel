---
type: handoff
project: HealthLink Sentinel
updated: 2026-08-11
status: active
---

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

> Atualização 2026-08-13: o gráfico detalhado de latência possui tooltip próprio com valor em ms e horário da amostra; valores submilissegundo não são mais arredondados para zero. Ping manual e coleta automática permanecem fluxos distintos. Consulte [[03-Execucao/Tooltip e origem da latencia]].

> Atualização 2026-08-13: corrigido o ranking de itens SNMP para hosts FortiGate com múltiplas interfaces. O `FW-LAV-IRANDUBA` foi validado usando `wan1 (LINK-ICOM-100Mb)`. Consulte [[03-Execucao/Correcao Telemetria SNMP FortiGate]].

# Handoff de contexto — HealthLink Sentinel

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
