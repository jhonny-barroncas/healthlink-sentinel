---
tipo: execucao
status: implementado-em-homologacao
---

# Agente — atualização automática e versão 1.0

## Decisão

O agente de coleta possui uma linha de versão independente por plataforma:

- Windows: `1.0.0`;
- Linux: `1.0.0`.

As versões são publicadas na aba **Integração Zabbix / Versões do agente**. O catálogo guarda o arquivo, plataforma, nome, tamanho e SHA-256. O download exige autenticação e o agente só aceita uma versão mais nova da mesma plataforma.

## Fluxo de atualização

1. O agente consulta o catálogo ao iniciar e a cada 10 minutos.
2. Se houver versão maior, baixa o artefato autenticado.
3. Calcula SHA-256 localmente e compara com o checksum publicado.
4. Grava em arquivo temporário e faz substituição atômica.
5. O gerenciador do serviço deve reiniciar o processo para carregar o novo binário.

Se a consulta, o download ou a validação falhar, a coleta atual continua e o artefato local não é alterado.

## Configuração técnica

O agente aceita `HEALTHLINK_AGENT_PLATFORM`, `HEALTHLINK_AGENT_VERSION` e `HEALTHLINK_AGENT_PATH`. Os valores padrão são `linux`, `1.0.0` e o caminho do processo atual. O pacote real de instalação Windows/Linux deve definir esses valores e registrar o reinício do serviço.

## Provisionamento em arquivo único

O detalhe da unidade oferece **Gerar agente** diretamente em cada equipamento de tipo servidor. A API valida servidor ativo, fonte Starlink/MikroTik/link ativa e versão executável `.cjs`; depois cria o vínculo, grava as atribuições, gera um enrollment opaco de uso único com expiração de 30 minutos e devolve um único arquivo para download.

- Windows: instalador PowerShell que baixa/verifica Node.js oficial, instala WinSW e registra o serviço `HealthLinkSentinelAgent`.
- Linux: instalador Bash que baixa/verifica Node.js oficial, cria o usuário de serviço e registra `healthlink-agent.service` com `Restart=always`.
- Nenhum prompt ou preenchimento manual é exigido durante a instalação.
- O agente envia heartbeat mesmo quando não houver Starlink; métricas não suportadas por MikroTik/link permanecem sem preenchimento até existir adaptador real.
- O agente consulta releases da própria API, valida SHA-256, substitui o bundle atomicamente e reinicia o processo para carregar a nova versão.

O pacote embutido inicial é `dist/agent/healthlink-agent-1.0.0.cjs`, sincronizado para os catálogos Windows/Linux na inicialização da API sem substituir uma publicação administrativa real.

## Tarefa para amanhã

- [ ] Homologar instalação e execução contínua do agente `1.0.0` no Windows.
- [ ] Homologar instalação e execução contínua do agente `1.0.0` no Linux com `systemd`.
- [ ] Validar coleta após reinício do serviço.
- [ ] Publicar uma versão de teste e confirmar atualização automática com checksum e rollback.
