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

## Fase 1 — adapter e conectividade (2026-08-17)

- Criado o adapter `apps/agent/src/starlink-client.ts`, isolando o contrato local gRPC do restante do agente.
- O adapter usa os arquivos protobuf derivados do projeto Eitol em `apps/agent/proto` e expõe somente consultas de leitura nesta fase.
- O coletor passou a depender do adapter, mantendo fila, autenticação, lote idempotente e contrato normalizado existentes.
- Criado o comando `npm.cmd run agent:starlink:check`, que testa somente `STARLINK_HOST:STARLINK_PORT` sem exigir credenciais ou equipamento do HealthLink.
- O diagnóstico testa cada IPv4 local e identifica a interface que alcança a antena (por exemplo, `Ethernet (192.168.88.x)`); quando nenhuma rota funciona, lista as interfaces disponíveis.
- O teste deve ser executado dentro da unidade; falha de rota, Wi-Fi ou VPN é reportada como indisponibilidade de conexão antes da coleta.
- O login do agente agora inclui, no log local, a mensagem sanitizada retornada pela API quando houver falha HTTP; nenhum token ou senha é registrado.
- Validação real concluída em 2026-08-17: o agente coletou 5 métricas da antena e enviou o lote para a API com `pendentes=0`, usando a rota Ethernet até `192.168.100.1:9200`.
- A ingestão agora atualiza automaticamente `health_units.latitude/longitude` quando recebe um par válido da Starlink e a unidade ainda não possui coordenadas manuais. Coordenadas já cadastradas nunca são sobrescritas.
- O endpoint autenticado `GET /v1/integrations/starlink/telemetry/:equipmentId` expõe a última amostra de cada métrica para o frontend; o detalhe da unidade exibe um painel Starlink atualizado a cada 15 segundos.
- Correção de renderização: o painel converte valores numéricos serializados pelo PostgreSQL antes de formatar coordenadas/velocidades, evitando tela preta quando a API retorna `numeric` como texto.
- Confiabilidade: o estado Starlink só pode ser `online/degraded/offline` quando há sinal de conectividade (latência, perda ou cobertura). Temperatura/localização isoladas resultam em `unknown`; snapshots Starlink com mais de 30 segundos passam a `unknown` até nova coleta.
- A tela operacional não exibe mais valores antigos como se fossem atuais: quando a última amostra ultrapassa 30 segundos, todas as métricas do card passam a `N/D` e o card indica `Sem comunicação recente`.
- A API também retorna o estado do coletor; quando a amostra está obsoleta, o painel registra visualmente o erro `Agente Starlink sem comunicação`, orientando verificar o processo e a rota até a antena.
- A atualização visual da branch `frontend-padronizacao` foi integrada sem remover o painel de telemetria, o tratamento `N/D` ou o cadastro explícito de senha do agente.
- Regra padronizada de confiabilidade: telemetria Starlink e telemetria de links/Zabbix com amostra acima de 30 segundos passam a `unknown`; a projeção visual zera latência, perda e tráfego, limpa o sparkline e exibe aviso de `Telemetria zerada`. O histórico persistido não é apagado.

## Próxima etapa

Concluir a validação do adapter contra uma antena real e comparar os campos retornados por diferentes firmwares. Até essa validação existir, Zabbix/SNMP permanece como fallback e nenhuma telemetria é fabricada.

> Validação de rede 2026-08-15: PC conectado à LAN do MikroTik (`192.168.88.0/24`) alcançou `192.168.100.1:9200` pela Ethernet, com `TcpTestSucceeded: True`. O caminho confirmado foi PC → MikroTik (`192.168.88.1`) → rede intermediária (`192.168.1.1`) → Starlink. O Wi‑Fi deve permanecer desligado ou com rota específica durante o teste para não desviar a conexão.

O cenário operacional adotado é: servidor local obrigatório em cada unidade, Starlink como fonte primária de métricas específicas e MikroTik como fonte opcional de caminho/interface. O plano detalhado está em [[Plano de Coleta Starlink e Unidade Movel]]. A próxima etapa é validar o agente contra uma antena real e acrescentar a coleta MikroTik.

## Referências

- [[00-Mapa Mestre do Vault]]
- [[03-Execucao/Worker Zabbix Automático]]
- [[03-Execucao/Correcao Telemetria SNMP FortiGate]]
- [Starlink Enterprise Telemetry API](https://starlink.com/kz/support/article/90109cc2-c7ec-31ff-d160-0a87f16ef759)
