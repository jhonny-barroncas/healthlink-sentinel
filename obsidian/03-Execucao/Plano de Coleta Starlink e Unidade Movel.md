---
type: execution-plan
project: HealthLink Sentinel
status: planned
updated: 2026-08-15
---

# Plano de coleta — Starlink, servidor local e MikroTik

## Objetivo

Coletar telemetria completa da unidade móvel sem depender de acesso direto do servidor central à rede local. Cada unidade terá um servidor local obrigatório, que funcionará como agente/ponte de coleta. A Starlink será a fonte primária das métricas específicas da constelação; o MikroTik, quando instalado, será uma fonte complementar de rede.

## Topologia prevista

```text
HealthLink Sentinel (API + PostgreSQL + jobs)
                  ▲ HTTPS/VPN autenticada
                  │
Servidor local obrigatório (agente HealthLink)
              ▲ gRPC local       ▲ SNMP/API local (opcional)
              │                   │
      Starlink 192.168.100.1:9200   MikroTik
```

O frontend nunca acessa a Starlink, o servidor local ou o MikroTik diretamente. Ele consulta somente as projeções da API HealthLink.

## Fontes e responsabilidade

### Starlink — fonte primária

Usar a API gRPC local não oficial da antena/roteador, normalmente em `192.168.100.1:9200`. O agente local consulta o dispositivo e envia somente dados normalizados ao HealthLink.

Métricas previstas: estado da antena, latitude/longitude quando habilitadas, latência, perda, download, upload, uptime, disponibilidade do serviço/cobertura, obstrução, SNR, temperatura, potência, firmware/modelo e alertas/erros quando expostos pelo firmware.

Não haverá um percentual inventado de cobertura. O agente registra disponibilidade do serviço, obstrução, sinal e alertas reais; caso o firmware não exponha uma métrica de cobertura, a interface mostra `N/D`.

### Servidor local — fonte obrigatória e ponte

O servidor executa o agente responsável por alcançar a rede privada, consultar Starlink e MikroTik, manter fila local curta, autenticar o envio, expor a saúde do agente e registrar versão/última coleta. Também pode ser monitorado pelo Zabbix para CPU, memória, disco, processos, temperatura e disponibilidade.

### MikroTik — fonte complementar opcional

Quando presente, coletar via SNMPv2c/v3 ou API RouterOS: interfaces, tráfego recebido/enviado, velocidade, erros, descartes, CPU, memória, temperatura, uptime, rotas, gateway e túnel/VPN. O MikroTik não substitui a telemetria própria da Starlink.

## Precedência dos dados

1. Métrica específica da Starlink: API gRPC local.
2. Métrica de interface e caminho: MikroTik, quando disponível.
3. Saúde do servidor e processos: agente local + Zabbix.
4. Disponibilidade consolidada e problemas: Zabbix/HealthLink.

Se duas fontes fornecerem a mesma métrica, a projeção preserva `source` e `observed_at`. Se a fonte não fornecer um campo, a UI mostra `N/D`.

## Fluxo de coleta

```text
Agente inicia → identifica unidade/equipamento → consulta Starlink
→ consulta MikroTik se cadastrado → normaliza e valida
→ enfileira se a API estiver indisponível → envia lote autenticado
→ API confirma tenant/equipamento → persiste metric_samples
→ atualiza equipment_status_snapshots → avalia alertas e indicadores
```

## Frequência inicial

- Starlink: 15 segundos;
- MikroTik: 15 segundos;
- saúde do agente: 30 segundos;
- timeout por origem: 3 segundos;
- fila local: pelo menos 30 minutos;
- retry: 15 s, 30 s, 60 s e máximo de 5 min.

O intervalo deve ser configurável. Não iniciar com coleta de 2 segundos na antena: a API não oficial pode mudar com firmware e a coleta agressiva aumenta carga e ruído.

## Segurança e multi-tenant

- O agente recebe identidade própria da unidade, nunca credenciais de usuário operacional; na primeira implementação, essa identidade é representada por um usuário de serviço dedicado.
- A identidade inicial é um usuário de serviço com perfil `service_agent`; o agente usa o refresh token da sessão para renovar o JWT automaticamente.
- O perfil `service_agent` possui somente `integrations.manage`; não acessa telas, usuários, equipamentos ou outros tenants.
- O envio ocorre por HTTPS/VPN com token rotacionável em configuração segura.
- A API confirma tenant e equipamento antes de persistir qualquer lote.
- A porta gRPC `9200` permanece somente na LAN; não abrir na internet.
- SNMP deve preferir v3; comunidades v2c ficam apenas no ambiente seguro do agente.
- Alterações de fonte, endpoint, habilitação e versão do agente geram auditoria.

## Fases de implementação

### Fase 1 — contrato e provisionamento

Cadastrar o servidor local obrigatório, identidade/heartbeat do agente, fonte `local_agent`, versão mínima e política de atualização.

### Fase 2 — coletor Starlink

Implementar cliente gRPC/Protobuf, mapear respostas para o contrato normalizado, testar modelos/firmwares e tratar método ausente, timeout e antena offline.

### Fase 3 — coletor MikroTik

Implementar SNMP/API com seleção explícita da interface WAN, separar tráfego de erros/descartes, registrar `N/D` quando não houver item confiável e evitar duplicidade de equipamento.

### Fase 4 — fila, envio e projeção

Adicionar fila local idempotente, ingestão em lote, origem/timestamp/qualidade/versão do agente e proteção contra dados obsoletos.

### Fase 5 — operação visual

Exibir saúde da Starlink, servidor e MikroTik em cards separados, origem e idade da amostra, estado do agente, histórico e diagnóstico de falhas.

## Critérios de aceite

- Unidade sem MikroTik continua monitorável pela Starlink e servidor.
- Unidade com MikroTik exibe Starlink, caminho WAN e interface selecionada sem misturar métricas.
- Queda da VPN preserva amostras confirmadas e reenvia sem duplicidade.
- Firmware sem métrica resulta em `N/D`, nunca em zero.
- Servidor central não precisa acessar diretamente `192.168.100.1`.
- Um tenant nunca consulta ou envia telemetria de outro tenant.
- O sistema diferencia antena indisponível, agente indisponível, MikroTik ausente e Zabbix sem telemetria.

### Validação inicial da topologia

- PC na porta 3 do MikroTik: endereço observado `192.168.88.253`.
- MikroTik: `192.168.88.1`.
- Starlink: `192.168.100.1:9200`.
- Teste TCP pela interface Ethernet aprovado (`TcpTestSucceeded: True`).
- O teste anterior pelo Wi‑Fi foi descartado porque usava `192.168.9.3` como origem.

## Dependências e riscos

- O gRPC local da Starlink é não oficial e pode mudar com firmware.
- Alguns modelos/topologias podem não expor todos os métodos.
- A unidade precisa permitir que o servidor alcance a antena e o MikroTik.
- Instalação e atualização do agente precisam ser operáveis remotamente.
- A política de retenção de métricas ainda precisa ser definida para produção.

## Referências

- [[Modulo Starlink - Estrategia Hibrida]]
- [[Worker Zabbix Automático]]
- [[03-Execucao/Operacao de Monitoramento - Fase 3]]
- [[../00-Mapa Mestre do Vault]]
- [[../04-Decisoes/ADR-001 Multi-tenancy desde o MVP]]
