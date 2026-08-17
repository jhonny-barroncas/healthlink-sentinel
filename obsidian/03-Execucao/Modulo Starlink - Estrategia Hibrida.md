---
type: module-note
project: HealthLink Sentinel
status: implemented-foundation
updated: 2026-08-13
---

# Módulo Starlink — estratégia híbrida

Adotada a estratégia híbrida: Zabbix/SNMP continua como fonte de disponibilidade, caminho e tráfego observado; dados específicos da constelação entram por API oficial Starlink ou agente local. O HealthLink normaliza as duas fontes e preserva a origem de cada amostra.

## Implementado

- Migration `008_starlink_telemetry_sources.sql` para configurar uma fonte por equipamento Starlink.
- Contrato normalizado em `apps/api/src/modules/integrations/starlink/telemetry.ts`.
- Ingestão autenticada em `POST /v1/integrations/starlink/telemetry`.
- Cadastro/leitura em `PUT/GET /v1/integrations/starlink/sources`.
- Métricas: geolocalização, latência, perda, download/upload, uptime, disponibilidade/cobertura, obstrução, SNR, temperatura, potência e alertas/erros.
- Campo ausente não gera valor estimado: a UI deve exibir `N/D`.
- Agente local inicial em `apps/agent/src`: consulta gRPC da antena, normaliza status/tráfego/sinal, mantém fila local e envia lotes autenticados para a API.
- Script de execução `npm.cmd run agent:starlink`; configuração feita exclusivamente por variáveis de ambiente.
- Ingestão aceita `batchId` para evitar duplicação quando um lote da fila é reenviado.
- Perfil RBAC `service_agent` criado com somente `integrations.manage`; o agente pode autenticar por e-mail/senha do usuário de serviço e renovar o JWT automaticamente.
- Instruções operacionais: `apps/agent/README.md`.

## Próxima etapa

Conectar o adapter de transporte escolhido (API oficial Enterprise ou agente local). Até essa conectividade existir, Zabbix/SNMP permanece como fallback e nenhuma telemetria é fabricada.

> Validação de rede 2026-08-15: PC conectado à LAN do MikroTik (`192.168.88.0/24`) alcançou `192.168.100.1:9200` pela Ethernet, com `TcpTestSucceeded: True`. O caminho confirmado foi PC → MikroTik (`192.168.88.1`) → rede intermediária (`192.168.1.1`) → Starlink. O Wi‑Fi deve permanecer desligado ou com rota específica durante o teste para não desviar a conexão.

O cenário operacional adotado é: servidor local obrigatório em cada unidade, Starlink como fonte primária de métricas específicas e MikroTik como fonte opcional de caminho/interface. O plano detalhado está em [[Plano de Coleta Starlink e Unidade Movel]]. A próxima etapa é validar o agente contra uma antena real e acrescentar a coleta MikroTik.

## Referências

- [[00-Mapa Mestre do Vault]]
- [[03-Execucao/Worker Zabbix Automático]]
- [[03-Execucao/Correcao Telemetria SNMP FortiGate]]
- [Starlink Enterprise Telemetry API](https://starlink.com/kz/support/article/90109cc2-c7ec-31ff-d160-0a87f16ef759)
