# Implantação do HealthLink Sentinel

Este guia descreve a implantação em servidor/container com uma única porta pública: **TCP 3002**.

O acesso será:

```text
https://aplicacao.gbringel.com:3002
```

Importante: fornecer a porta significa encaminhar o serviço completo do HealthLink. Não basta apontar `3002` somente para os arquivos do frontend. A mesma porta deve atender a interface, a API e o health check:

```text
Frontend: https://aplicacao.gbringel.com:3002
API:      https://aplicacao.gbringel.com:3002/v1/...
Health:   https://aplicacao.gbringel.com:3002/health
```

Se houver um proxy reverso, ele deve encaminhar todas essas rotas para o container HealthLink. Não é necessário fornecer uma segunda porta para a API.

O agente Starlink usará a mesma URL para enviar telemetria:

```env
HEALTHLINK_API_URL=https://aplicacao.gbringel.com:5174
```

## 1. Arquitetura

```text
Usuário/Navegador ─┐
Agente Starlink ───┼── HTTPS TCP 5174 ──> Firewall/NAT ──> HealthLink
                   │                                      ├─ Frontend React
                   │                                      └─ API Fastify

HealthLink ──> PostgreSQL (interno: 5432)
HealthLink ──> Redis (interno: 6379)
HealthLink ──> Zabbix (saída para URL configurada)

Agente Starlink ──> Antena local (192.168.100.1:9200)
```

O agente não acessa a antena pela internet. Ele precisa estar instalado em um computador/servidor na rede da unidade móvel, consultar a antena localmente e abrir uma conexão HTTPS de saída para o HealthLink.

## 2. Portas

| Porta | Uso | Exposição |
|---|---|---|
| `5174/tcp` | Frontend, API e recebimento do agente | Pública, liberada no firewall |
| `443/tcp` | Outro sistema existente | Não alterar |
| `8080/tcp` | Outro serviço existente | Não alterar |
| `5432/tcp` | PostgreSQL | Somente rede interna/container |
| `6379/tcp` | Redis | Somente rede interna/container |
| `9200/tcp` | gRPC local da antena Starlink | Somente rede da unidade; nunca publicar |
| `5173/tcp` | Vite em desenvolvimento | Não usar em produção |
| `3000/tcp` | Porta histórica da API | Não publicar em produção |

A porta `5174` deve ser encaminhada pelo firewall/NAT para o servidor que executa o HealthLink. Não é necessário encaminhar `9200` da unidade móvel para a internet.

## 3. DNS e TLS

Crie um registro DNS apontando `aplicacao.gbringel.com` para o IP público do firewall:

```text
Tipo: A
Nome: aplicacao
Valor: <IP_PUBLICO_DO_FIREWALL>
```

Depois:

1. Libere TCP `5174` no firewall.
2. Faça NAT/port-forward de `IP_PUBLICO:5174` para `IP_DO_SERVIDOR:5174`.
3. Instale um certificado TLS válido para `aplicacao.gbringel.com`.
4. Configure o serviço para terminar HTTPS diretamente na porta `5174` ou use um proxy reverso nessa porta.
5. Teste de uma rede externa, não somente do servidor.

Se o processo dentro do container escutar outra porta interna, o proxy/NAT pode fazer a conversão. O requisito é que o endereço público `aplicacao.gbringel.com:5174` encaminhe para o processo que atende frontend, `/v1/*` e `/health`.

Certificados HTTPS funcionam em portas diferentes da `443`; o número da porta precisa apenas aparecer na URL.

## 4. Requisitos do servidor

- Linux recomendado, com Docker Engine e Docker Compose Plugin.
- Node.js 22+ caso a aplicação seja executada sem imagem própria.
- DNS resolvendo o domínio público.
- Firewall permitindo somente `5174/tcp` para o HealthLink.
- Armazenamento persistente para PostgreSQL e, se desejado, para a fila local do agente.
- Saída HTTPS para o servidor Zabbix configurado.
- Segredos fornecidos pelo gerenciador de segredos ou por arquivo `.env` protegido; nunca versionar `.env`.

## 5. Configuração da aplicação

Crie um `.env` de produção no servidor, sem copiar valores do ambiente de desenvolvimento:

```env
NODE_ENV=production
PORT=5174
DATABASE_URL=postgresql://<usuario>:<senha>@postgres:5432/healthlink
REDIS_URL=redis://redis:6379
JWT_SECRET=<segredo-com-no-minimo-32-caracteres>
ZABBIX_CREDENTIALS_ENCRYPTION_KEY=<chave-com-no-minimo-32-caracteres>
ZABBIX_API_URL=https://<zabbix>/zabbix/api_jsonrpc.php
ZABBIX_API_TOKEN=<token-do-zabbix>
ZABBIX_SYNC_INTERVAL_MS=60000
ZABBIX_TELEMETRY_INTERVAL_MS=2000
PUBLIC_APP_URL=https://healthlink.seudominio.com
HEALTHLINK_SYSADMIN_EMAIL=sysadmin@healthlink.local
HEALTHLINK_SYSADMIN_PASSWORD=<segredo-do-sysadmin>
HEALTHLINK_SYSADMIN_RESET_PASSWORD=false
```

O build do frontend é servido pela própria API a partir de `dist/web`. Portanto, em produção, frontend e endpoints `/v1/*` compartilham a porta `5174` e a mesma origem.

## 6. Build e inicialização

### Usando Docker Compose

Na raiz do projeto:

```bash
cp .env.example .env
# edite .env e troque todos os segredos e a senha do PostgreSQL
docker compose up -d --build
docker compose ps
docker compose logs -f healthlink
```

O serviço `migrate` aguarda o PostgreSQL ficar saudável e aplica as migrations. Em seguida, o serviço `bootstrap` garante o usuário `sysadmin` no tenant `default` de forma idempotente; só altera uma senha existente quando `HEALTHLINK_SYSADMIN_RESET_PASSWORD=true`. Por fim, o `healthlink` inicia. O PostgreSQL e o Redis ficam sem publicação de portas no host; somente `5174` é publicada pelo Compose.

O container está preparado para o fluxo completo de produção: o build executa `typecheck` e `build:web`, o runtime inicia a API Fastify e os arquivos compilados do frontend compartilham a mesma origem. O fallback da SPA é registrado sem duplicar o wildcard do `@fastify/static`, evitando falha de inicialização do Fastify em versões atuais.

Validação local realizada em 19/08/2026:

```text
docker compose up -d --build
GET http://localhost:5174/health -> 200
{"status":"ok","service":"healthlink-sentinel"}
```

Para parar sem remover os dados:

```bash
docker compose down
```

Para remover também o volume do banco, ação destrutiva que apaga os dados locais:

```bash
docker compose down -v
```

### Execução sem Compose

Na raiz do projeto:

```bash
npm ci
npm run typecheck
npm run build:agent
npm run build:web
npm run start
```

O processo deve escutar em `0.0.0.0:5174`. O health check é:

```text
https://aplicacao.gbringel.com:5174/health
```

Resposta esperada:

```json
{"status":"ok","service":"healthlink-sentinel"}
```

## 7. Banco de dados

Suba PostgreSQL com volume persistente. Aplique todas as migrations, em ordem alfabética/numérica, antes do primeiro acesso:

```bash
for file in apps/api/database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$file"
done
```

Faça backup regular do banco e teste restauração. Não use as credenciais nem os dados de demonstração do desenvolvimento em produção.

## 8. Agente Starlink remoto

### Provisionamento recomendado — arquivo único

No `.env` da API, configure `PUBLIC_APP_URL` com a URL pública que o servidor da unidade usará. `PUBLIC_API_URL` continua aceita como compatibilidade legada, mas `PUBLIC_APP_URL` tem prioridade. No frontend, cadastre a unidade, um equipamento de tipo **Servidor** e pelo menos uma Starlink, MikroTik ou link de internet ativo. No equipamento servidor, clique em **Gerar agente**, escolha Windows ou Linux e baixe o arquivo.

O arquivo já contém o vínculo, as atribuições e um enrollment de uso único válido por 30 minutos. O operador só precisa executá-lo uma vez: Windows como Administrador e Linux como `root`/`sudo`. Não há preenchimento de URL, tenant, equipamento, token ou senha durante a instalação.

O primeiro uso precisa de saída HTTPS para a API e para `nodejs.org`; o servidor também precisa alcançar a Starlink local em `192.168.100.1:9200` quando houver Starlink. O instalador registra o serviço, inicia a coleta contínua e o agente consulta automaticamente novas versões publicadas no catálogo Zabbix.

O instalador usa o bundle `.cjs` publicado em **Integração Zabbix / Versões do agente**. Publique o arquivo gerado por `npm run build:agent`, não o instalador `.ps1`/`.sh`.

### Validação manual/legada

Para diagnóstico ou ambientes que não usam o provisionamento pelo frontend, o agente precisa de:

- rota local para `192.168.100.1:9200` ou outro endereço configurado;
- saída HTTPS para `aplicacao.gbringel.com:5174`;
- usuário de serviço com perfil `service_agent`;
- UUID do tenant e do equipamento Starlink;
- fila local em diretório persistente, caso a internet caia.

Exemplo de configuração do agente:

```env
HEALTHLINK_API_URL=https://aplicacao.gbringel.com:5174
HEALTHLINK_API_EMAIL=agent-starlink-unidade-001@dominio-interno
HEALTHLINK_API_PASSWORD=<senha-do-usuario-de-servico>
HEALTHLINK_TENANT_ID=<uuid-do-tenant>
HEALTHLINK_EQUIPMENT_ID=<uuid-do-equipamento-starlink>
STARLINK_HOST=192.168.100.1
STARLINK_PORT=9200
STARLINK_POLL_INTERVAL_MS=15000
STARLINK_TIMEOUT_MS=3000
STARLINK_QUEUE_PATH=/var/lib/healthlink/starlink-queue.json
```

Valide primeiro a rede local da unidade:

```bash
npm run agent:starlink:check
```

Depois faça uma coleta única:

```bash
npm run agent:starlink -- --once
```

Por fim, configure o agente como serviço do sistema para iniciar automaticamente e reiniciar após falhas. Nunca use credencial de administrador no agente.

## 9. Firewall mínimo

No servidor central:

- permitir entrada TCP `5174` somente para o serviço HealthLink;
- bloquear entrada pública para `3000`, `5173`, `5432`, `6379` e `9200`;
- permitir saída HTTPS para o Zabbix, se a integração for usada;
- permitir administração somente por VPN/SSH/rede administrativa.

Na unidade móvel:

- permitir que o agente alcance `192.168.100.1:9200` na LAN;
- permitir saída TCP `5174` para `aplicacao.gbringel.com`;
- não criar port-forward da antena para a internet.

## 10. Operação e troubleshooting

Verificações iniciais:

```bash
curl -i https://aplicacao.gbringel.com:5174/health
docker compose ps
docker logs <container-healthlink> --tail=200
```

Se o site abrir mas a API falhar, confirme que o frontend foi compilado antes de iniciar (`dist/web/index.html`) e que a aplicação está usando `PORT=5174`.

Se o agente não enviar dados:

1. teste DNS e HTTPS até `aplicacao.gbringel.com:5174`;
2. teste a antena local em `192.168.100.1:9200`;
3. confirme `HEALTHLINK_EQUIPMENT_ID` e o tenant;
4. confira logs do agente e o tamanho da fila local;
5. valide se o usuário tem o perfil `service_agent`;
6. verifique o horário do servidor e a validade do certificado TLS.

## 11. Checklist de go-live

- [ ] DNS de `aplicacao.gbringel.com` aponta para o IP público correto.
- [ ] TCP `5174` liberado e encaminhado ao servidor.
- [ ] Certificado TLS válido instalado.
- [ ] Portas `3000`, `5173`, `5432`, `6379` e `9200` não estão públicas.
- [ ] PostgreSQL possui volume e backup.
- [ ] Migrations aplicadas.
- [ ] Segredos de produção definidos fora do Git.
- [ ] `/health` responde externamente.
- [ ] Login e uma rota autenticada foram testados.
- [ ] Agente Starlink alcança a antena local.
- [ ] Agente Starlink envia para `https://aplicacao.gbringel.com:5174`.
- [ ] Serviço do agente reinicia automaticamente.
- [ ] Logs e alertas de indisponibilidade estão configurados.
