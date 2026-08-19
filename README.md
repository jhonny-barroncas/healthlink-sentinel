# HealthLink Sentinel

Plataforma corporativa de monitoramento operacional para unidades móveis de saúde, com arquitetura multi-tenant, autenticação JWT, RBAC, auditoria, integração Zabbix e agente local Starlink.

## Requisitos

- Git
- Node.js 22 ou superior
- npm (incluído no Node.js)
- Docker Desktop com Compose
- PostgreSQL 16 e Redis 7 — podem ser executados pelo `docker compose`
- Opcional: acesso a um servidor Zabbix para sincronização
- Opcional: antena Starlink acessível na rede local para usar `apps/agent`

Verifique as versões:

```powershell
node --version
npm --version
docker --version
docker compose version
```

## Instalação

Clone o projeto e entre na pasta:

```powershell
git clone https://github.com/jhonny-barroncas/healthlink-sentinel.git
cd healthlink-sentinel
```

Instale as dependências:

```powershell
npm.cmd install
```

Crie a configuração local. O arquivo `.env` nunca deve ser commitado:

```powershell
Copy-Item .env.example .env
notepad .env
```

No mínimo, defina valores próprios para:

```env
JWT_SECRET=um-segredo-local-com-no-minimo-32-caracteres
ZABBIX_CREDENTIALS_ENCRYPTION_KEY=uma-chave-local-com-no-minimo-32-caracteres
```

Se Zabbix for utilizado, preencha também `ZABBIX_API_URL` e `ZABBIX_API_TOKEN` somente no `.env` local.

## Banco e infraestrutura

### Docker Compose (fluxo recomendado)

O ambiente está adaptado para Docker Compose: o serviço `migrate` aguarda o PostgreSQL, aplica as migrations uma única vez e só então inicia a aplicação. O container `healthlink` serve o frontend compilado, a API e o health check na mesma porta `5174`.

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up -d --build
docker compose ps
Invoke-WebRequest http://localhost:5174/health
```

O retorno esperado do health check é `{"status":"ok","service":"healthlink-sentinel"}`. PostgreSQL e Redis permanecem internos ao Compose; somente `5174` é publicada no host. O endereço externo de produção será `https://aplicacao.gbringel.com:5174`. Consulte [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) antes de usar em produção.

Para subir somente as dependências durante o desenvolvimento com API/frontend fora do Docker:

```powershell
docker compose up -d postgres redis
```

Quando a aplicação completa estiver rodando pelo Compose, não é necessário aplicar migrations manualmente. Para um ambiente legado sem o serviço `migrate`, aplique-as na ordem numérica:

```powershell
Get-ChildItem apps/api/database/migrations/*.sql | Sort-Object Name | ForEach-Object {
  Get-Content -Raw $_.FullName | docker compose exec -T postgres psql -U healthlink -d healthlink -f -
}
```

Confira a API fora do Compose:

```powershell
Invoke-WebRequest http://localhost:3000/health
```

## Executar o sistema

Abra dois terminais na raiz do projeto.

Terminal 1 — API:

```powershell
npm.cmd run dev
```

Terminal 2 — frontend:

```powershell
npm.cmd run dev:web
```

Acesse [http://localhost:5173](http://localhost:5173). A API ficará em [http://localhost:3000](http://localhost:3000).

Nesse fluxo de dois terminais, o frontend e a API rodam em portas diferentes, então é preciso informar ao Vite onde está a API. Copie `apps/web/.env.local.example` para `apps/web/.env.local` (não é versionado):

```powershell
Copy-Item apps/web/.env.local.example apps/web/.env.local
```

Sem esse arquivo, o login e as demais chamadas falham porque o frontend tenta usar a própria origem (`localhost:5173`) como base da API. Para acessar de outro computador da rede, abra as portas no firewall e troque `localhost` pelo IP da máquina que executa a API/frontend.

Esse ajuste só é necessário nesse fluxo de desenvolvimento local com dois terminais. No fluxo do Docker Compose (recomendado, ver seção acima), frontend e API são servidos juntos na mesma porta e nenhuma variável extra é necessária.

## Primeiro acesso

O projeto não publica usuários ou senhas padrão. Crie o primeiro usuário pelo fluxo de provisionamento disponível no ambiente ou por um procedimento administrativo seguro. Nunca coloque senhas no código, no README ou em commits.

## Agente Starlink

O agente roda no servidor local da unidade e consulta a antena pela API gRPC local, normalmente em `192.168.100.1:9200`. Ele mantém uma fila local quando a API central está indisponível.

Para uma unidade com usuário de serviço, preencha no `.env`:

```env
HEALTHLINK_API_URL=http://localhost:3000
HEALTHLINK_API_TOKEN=
HEALTHLINK_API_EMAIL=agent-starlink-unidade-001@local
HEALTHLINK_API_PASSWORD=senha-do-usuario-de-servico
HEALTHLINK_TENANT_ID=
HEALTHLINK_EQUIPMENT_ID=uuid-do-equipamento-starlink
STARLINK_HOST=192.168.100.1
STARLINK_PORT=9200
STARLINK_POLL_INTERVAL_MS=15000
STARLINK_TIMEOUT_MS=15000
STARLINK_QUEUE_PATH=.healthlink-starlink-queue.json
```

O usuário deve possuir o perfil `service_agent`. O agente usa somente a permissão de integração e renova o JWT automaticamente. Não use o token ou a senha de um usuário administrador.

Teste uma coleta única:

```powershell
npm.cmd run agent:starlink -- --once
```

Para execução contínua:

```powershell
npm.cmd run agent:starlink
```

Antes do teste, confirme a rede:

```powershell
Test-NetConnection 192.168.100.1 -Port 9200
```

Se a Starlink estiver atrás de um MikroTik, o servidor precisa alcançar `192.168.100.1:9200` pela Ethernet. Se estiver conectado diretamente ao Wi‑Fi da Starlink, o computador precisa estar na rede Wi‑Fi correta. O agente não abre a porta gRPC na internet.

## Validação do projeto

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build:web
```

## Estrutura principal

```text
apps/api/                 API Fastify, autenticação, RBAC e integrações
apps/api/database/        migrations PostgreSQL
apps/agent/               agente local Starlink
apps/web/                 frontend React/Vite
docs/                     arquitetura resumida
obsidian/                 memória documental do projeto
output/                   artefatos gerados, como o briefing PDF
docker-compose.yml        PostgreSQL e Redis locais
.env.example              modelo de configuração sem segredos
```

## Segurança

- Nunca versione `.env`, tokens, senhas, cookies ou filas locais.
- Troque os segredos de desenvolvimento antes de qualquer ambiente compartilhado.
- Use HTTPS/VPN entre o agente e a API central.
- Mantenha a porta `9200` somente na rede local da unidade.
- Revogue e substitua qualquer credencial que tenha sido exposta.

## Deploy com uma porta pública

Para o cenário de produção com o domínio `aplicacao.gbringel.com`, a porta pública recomendada neste projeto é a `5174`:

```text
https://aplicacao.gbringel.com:5174
```

Essa porta precisa encaminhar para o serviço completo do HealthLink, e não somente para o frontend:

```text
Frontend: https://aplicacao.gbringel.com:5174
API:      https://aplicacao.gbringel.com:5174/v1/...
Health:   https://aplicacao.gbringel.com:5174/health
```

O agente Starlink também envia os dados pela mesma porta:

```env
HEALTHLINK_API_URL=https://aplicacao.gbringel.com:5174
```

Quem administra o firewall/proxy deve liberar TCP `5174` e encaminhá-la para o container ou processo do HealthLink. A API não deve ser publicada em outra porta separada. As portas internas PostgreSQL (`5432`), Redis (`6379`) e Starlink (`9200`) não devem ser expostas na internet.

O passo a passo completo está em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentação adicional

- [Plano de coleta Starlink e unidade móvel](obsidian/03-Execucao/Plano%20de%20Coleta%20Starlink%20e%20Unidade%20Movel.md)
- [Módulo Starlink — estratégia híbrida](obsidian/03-Execucao/Modulo%20Starlink%20-%20Estrategia%20Hibrida.md)
- [Arquitetura de referência](obsidian/02-Arquitetura/Arquitetura%20de%20Referência.md)
- [Índice do vault Obsidian](obsidian/00-Mapa%20Mestre%20do%20Vault.md)
