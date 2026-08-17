# Agente local Starlink

Processo executado no servidor obrigatório da unidade móvel. Consulta a API gRPC local da antena e envia telemetria normalizada ao HealthLink Sentinel.

O agente coleta, quando exposto pelo firmware: geolocalização, velocidades de download/upload, disponibilidade de serviço/cobertura, obstrução, sinal e alertas/erros.

## Configuração

Defina as variáveis no ambiente do servidor local:

```text
HEALTHLINK_API_URL=https://healthlink.exemplo
HEALTHLINK_API_TOKEN=<JWT local opcional>
HEALTHLINK_API_EMAIL=agent-starlink-unidade-001@local
HEALTHLINK_API_PASSWORD=<senha local do usuário de serviço>
HEALTHLINK_TENANT_ID=<UUID do tenant, opcional>
HEALTHLINK_EQUIPMENT_ID=<UUID do equipamento Starlink>
STARLINK_HOST=192.168.100.1
STARLINK_PORT=9200
STARLINK_POLL_INTERVAL_MS=15000
STARLINK_TIMEOUT_MS=3000
STARLINK_QUEUE_PATH=.healthlink-starlink-queue.json
```

O token não deve ser colocado no código, no Obsidian ou em commits. O equipamento precisa ser do tipo `starlink` e pertencer ao tenant do token.

## Execução

```powershell
npm.cmd run agent:starlink
```

Para uma coleta única de diagnóstico:

```powershell
npm.cmd run agent:starlink -- --once
```

Se a API central estiver indisponível, o lote é mantido no arquivo de fila configurado e reenviado no próximo ciclo. O agente não executa comandos destrutivos na antena: usa somente consultas de status e telemetria.

## Limites atuais

- A primeira versão coleta a antena Starlink; MikroTik ainda será adicionado em um adaptador separado.
- O perfil `service_agent` possui somente `integrations.manage`; usando e-mail/senha, o agente renova o JWT automaticamente.
- O protocolo gRPC é não oficial e pode variar com o firmware.
