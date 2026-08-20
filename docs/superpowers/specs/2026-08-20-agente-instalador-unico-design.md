# Especificação: provisionamento do agente por instalador único

**Data:** 2026-08-20  
**Status:** aprovado em conversa e em implementação  
**Produto:** HealthLink Sentinel

## Objetivo

No detalhe de uma unidade, cada equipamento servidor ativo deve oferecer a ação **Gerar agente** quando a unidade possuir ao menos uma fonte ativa compatível. O operador escolhe Windows ou Linux e baixa um único arquivo. No servidor de destino, o técnico executa esse arquivo uma vez, sem informar URL, tenant, unidade, equipamento, usuário, senha ou token.

Após a instalação, o agente deve iniciar automaticamente, coletar continuamente, enviar heartbeat, sobreviver a reboot e atualizar a própria versão quando houver uma publicação mais nova para sua plataforma.

## Requisitos de elegibilidade

- Servidor: tipo `server` ou `linux_server` legado, ativo e pertencente à unidade.
- Fonte: ao menos um equipamento ativo do tipo `starlink`, `mikrotik` ou `internet_link`, pertencente à mesma unidade.
- Versão: deve existir artefato ativo no catálogo para a plataforma escolhida.
- A API valida todas as regras; o frontend apenas antecipa a orientação.
- Sem servidor, a unidade mostra que o cadastro do servidor é obrigatório.
- Com servidor e sem fonte, o botão permanece acionável para exibir a lista exata dos requisitos ausentes.

## Experiência do operador

1. Abrir a unidade e localizar o equipamento servidor.
2. Clicar em **Gerar agente**.
3. Se faltar fonte compatível, visualizar aviso com os tipos aceitos.
4. Escolher `Windows` ou `Linux` em um modal que identifica servidor, unidade e fontes vinculadas.
5. Clicar em **Gerar e baixar**.
6. Receber `healthlink-agent-<unidade>-<plataforma>.<ps1|sh>`.

O download contém um enrollment de uso único com validade de 30 minutos. Gerar outro instalador invalida apenas enrollments pendentes anteriores do mesmo agente; uma instalação ativa continua funcionando até o novo arquivo ser efetivamente consumido.

## Identidade e segurança

- `collection_agents` representa uma instalação associada a tenant, unidade e servidor.
- `collection_agent_assignments` lista somente os equipamentos que o agente pode coletar.
- `collection_agent_enrollments` guarda somente SHA-256 do segredo, validade, consumo, revogação e ator.
- O token de enrollment usa alta entropia, é usado uma vez e nunca é gravado em auditoria ou logs.
- No primeiro uso, o token é trocado por uma credencial opaca específica do agente.
- A credencial permanente também é armazenada somente como hash.
- A autenticação do agente não concede `integrations.manage`; ela permite apenas enrollment, configuração, heartbeat, ingestão atribuída e download de versão do próprio tenant.
- Revogação e isolamento multi-tenant são aplicados no backend.

## Arquivo único e instalação

O arquivo entregue ao usuário é um bootstrap autocontido com:

- URL pública da API;
- enrollment de uso único;
- artefato do coletor e SHA-256;
- comandos de instalação e registro do serviço.

O bootstrap pode baixar dependências públicas fixadas e confiáveis por HTTPS quando ausentes no host. Na versão `1.0.0`, o runtime portátil é Node.js 22. O Windows usa WinSW 2.12.0 para executar o processo como serviço; o Linux usa `systemd`. Falha de rede ou de checksum encerra a instalação com mensagem acionável e não inicia um artefato incompleto.

### Windows

- Requer execução elevada como Administrador e se autoeleva quando possível.
- Instala em `%ProgramData%\HealthLink Sentinel\Agent`.
- Protege a configuração com ACL para `SYSTEM` e `Administrators`.
- Registra `HealthLinkSentinelAgent` via WinSW, inicia imediatamente e configura restart após falha.
- Logs ficam no diretório `logs` da instalação.

### Linux

- Requer `root` ou execução via `sudo`.
- Instala runtime em `/opt/healthlink-agent`, configuração em `/etc/healthlink-agent/agent.json` e estado em `/var/lib/healthlink-agent`.
- Cria usuário de sistema dedicado, aplica permissão `0600` à configuração e registra `healthlink-agent.service`.
- Usa `After/Wants=network-online.target`, `Restart=always` e inicialização no boot.
- Logs seguem para o `journald`.

## Agente e atualização automática

- O artefato `1.0.0` é um bundle CommonJS do coletor existente, incluindo os contratos protobuf necessários.
- O agente envia heartbeat mesmo quando a unidade ainda não possui um coletor Starlink executável; isso permite monitorar instalações baseadas em MikroTik/link enquanto seus adaptadores específicos evoluem.
- Quando há Starlink atribuída, mantém coleta a cada 15 segundos, fila local e ingestão idempotente.
- Ao iniciar e a cada 10 minutos, consulta a versão ativa da mesma plataforma.
- Uma versão mais nova é baixada, validada por SHA-256 e substituída atomicamente.
- Após atualização válida, o agente encerra com código não zero controlado; WinSW/systemd reinicia o processo já na nova versão.
- Falha de catálogo, download ou checksum não interrompe a coleta atual.

## Estado operacional

`GET /v1/monitoring/agents` passa a usar `collection_agents.last_heartbeat_at` como fonte principal:

- `online`: heartbeat em até 30 segundos;
- `offline`: instalação ativa sem heartbeat recente;
- `pending`: instalador gerado, ainda não consumido;
- `unlinked`: nenhum agente associado.

O vínculo legado `starlink_telemetry_sources.source_kind = local_agent` permanece como fallback temporário para instalações anteriores.

## Limites explícitos da versão 1.0.0

- Starlink é o primeiro coletor completo.
- MikroTik e `internet_link` habilitam o agente e o heartbeat, mas a coleta SNMP/API depende de credenciais e parâmetros que ainda não existem no cadastro atual; o sistema não fabricará essas métricas.
- O bootstrap precisa alcançar a API HealthLink e, apenas se Node/WinSW não estiverem instalados no pacote local, os repositórios oficiais correspondentes.
- Windows e Linux precisam ser homologados em hosts reais antes de considerar a entrega produtiva.

## Critérios de aceite

- Requisitos são exibidos e revalidados na API.
- O download pergunta apenas Windows/Linux e gera exatamente um arquivo.
- A execução não solicita nenhum valor ao técnico.
- O mesmo enrollment não pode ser consumido duas vezes.
- A credencial não acessa outro tenant, unidade ou equipamento não atribuído.
- O serviço inicia imediatamente e depois de reboot.
- Heartbeat diferencia pendente, rodando, parado e sem vínculo.
- Starlink continua coletando e reenviando fila após indisponibilidade da API.
- Atualização mais nova é validada por checksum e carregada após restart automático.
- Typecheck, build web, testes relacionados e cenários Docker são executados antes da homologação.

