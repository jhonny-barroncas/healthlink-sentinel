# Manual de implantação em produção

## 1. Objetivo

Este manual descreve como instalar o HealthLink Sentinel em um servidor real usando Docker Compose, disponibilizar a aplicação com HTTPS, validar o banco e cadastrar o agente de coleta nas unidades móveis.

O cenário recomendado é:

```text
Internet
   │ HTTPS
DNS + proxy reverso
   │ HTTPS público :3002
   │ HTTPS interno :3003
HealthLink container ─── PostgreSQL
                      └─ Redis
```

O agente da unidade móvel abre uma conexão HTTPS de saída para o HealthLink. A Starlink não precisa ter a porta `9200` publicada na internet.

## 2. Pré-requisitos

Servidor central recomendado:

- Linux 64-bit;
- Docker Engine e Docker Compose Plugin;
- 4 GB de RAM ou mais;
- armazenamento persistente para PostgreSQL;
- DNS apontando para o IP público do servidor;
- certificado HTTPS válido;
- firewall permitindo somente as portas necessárias.

Portas:

| Porta | Uso | Exposição |
|---|---|---|
| `443/tcp` | HTTPS público, se houver proxy reverso | pública |
| `3002/tcp` | aplicação HealthLink | interna ou pública somente com HTTPS configurado |
| `5432/tcp` | PostgreSQL | nunca publicar na internet |
| `6379/tcp` | Redis | nunca publicar na internet |
| `9200/tcp` | Starlink na unidade móvel | somente na LAN da unidade |

## 3. Obter o projeto

No servidor de produção:

```bash
git clone <URL_DO_REPOSITORIO> healthlink-sentinel
cd healthlink-sentinel
```

Use uma branch ou tag revisada para produção. Não execute diretamente uma branch de desenvolvimento sem homologação.

Se o servidor já possui GLPI e Uptime Kuma em outras pastas, mantenha cada aplicação em sua própria stack Docker. Para o
HealthLink, use o override `docker-compose.server.yml`; ele publica a aplicação apenas em `127.0.0.1:3003`, evitando
conflito com as portas públicas do proxy existente:

```bash
cd /opt/healthlink-sentinel
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build
```

O proxy reverso deve escutar HTTPS na porta externa `3002` e encaminhar o domínio do HealthLink para `https://127.0.0.1:3003`.

## 4. Criar o ambiente de produção

Copie o modelo e edite o arquivo local:

```bash
cp .env.example .env
nano .env
```

Preencha, no mínimo:

```env
NODE_ENV=production
PORT=3002
POSTGRES_PASSWORD=GERAR_UMA_SENHA_FORTE_E_UNICA
JWT_SECRET=GERAR_UM_SEGREDO_COM_PELO_MENOS_32_CARACTERES
ZABBIX_CREDENTIALS_ENCRYPTION_KEY=GERAR_UMA_CHAVE_COM_PELO_MENOS_32_CARACTERES
PUBLIC_API_URL=https://healthlink.seudominio.com
```

Se o Zabbix for utilizado:

```env
ZABBIX_API_URL=https://zabbix.seudominio.com/api_jsonrpc.php
ZABBIX_API_TOKEN=TOKEN_DO_ZABBIX
```

Regras obrigatórias:

- nunca publique o `.env` no Git;
- nunca coloque senha, token ou chave no manual;
- use valores diferentes dos utilizados em desenvolvimento;
- faça backup seguro dos segredos;
- `PUBLIC_API_URL` deve ser acessível pelo servidor das unidades móveis.

## 5. Subir a aplicação

O serviço `migrate` aplica as migrations automaticamente antes da API iniciar.

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build
docker compose ps
```

Verifique os logs:

```bash
docker compose logs --tail=100 migrate
docker compose logs --tail=100 healthlink
```

O serviço `healthlink` deve estar `Up` e o `migrate` deve terminar com código `0`.

## 6. Validar a instalação

No próprio servidor:

```bash
curl -k -i https://127.0.0.1:3003/health
```

Resposta esperada:

```json
{"status":"ok","service":"healthlink-sentinel"}
```

Valide também pelo domínio público depois de configurar o HTTPS:

```bash
curl -i https://healthlink.seudominio.com/health
```

Abra no navegador:

```text
https://healthlink.seudominio.com
```

## 7. HTTPS e proxy reverso

O Docker entrega a aplicação na porta interna `3002`, publicada pelo override do servidor em `127.0.0.1:3003`. Em produção, o TLS é usado no proxy reverso e também no próprio container, na porta externa `3002` e no upstream `127.0.0.1:3003`.

Configure os certificados no `.env` sem versioná-los no Git:

```env
HEALTHLINK_TLS_DIR=/etc/healthlink/certs
HEALTHLINK_TLS_KEY_FILE=privkey.pem
HEALTHLINK_TLS_CERT_FILE=fullchain.pem
```

Exemplo conceitual de Nginx:

```nginx
server {
    listen 3002 ssl;
    server_name healthlink.seudominio.com;

    ssl_certificate     /etc/letsencrypt/live/healthlink.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/healthlink.seudominio.com/privkey.pem;

    location / {
        proxy_pass https://127.0.0.1:3003;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Se o proxy usar a porta pública `5174` em vez de `443`, o endereço precisa ser informado com a porta:

```env
PUBLIC_API_URL=https://healthlink.seudominio.com:5174
```

Não disponibilize HTTP puro na internet para login, API ou enrollment de agentes.

## 8. Banco, persistência e backup

Política de retenção do HealthLink: inventário, configurações, vínculos, estado atual e auditoria são permanentes. A
telemetria detalhada deve ser retida por 30 dias; heartbeats por 7 dias; eventos resolvidos por 90 dias; logs técnicos
por 30 dias; e diagnósticos Ping/Tracert por 7 dias. Reserve aproximadamente 100 GB para o volume do PostgreSQL,
incluindo margem de crescimento e backups temporários. A limpeza automática desses dados deve ser validada antes do
go-live.

O Compose utiliza o volume `postgres_data`. Confirme o volume:

```bash
docker volume ls | grep postgres
```

O serviço `retention` executa diariamente o SQL em `scripts/postgres-retention.sql`. Ele remove telemetria com mais de
30 dias, histórico operacional com mais de 90 dias, dados temporários de agentes com mais de 30 dias e sessões/enrollments
expirados. Inventário, estado atual e auditoria não são removidos. O intervalo pode ser ajustado por
`HEALTHLINK_RETENTION_INTERVAL_SECONDS`.

Backup:

```bash
docker compose exec -T postgres pg_dump -U healthlink -d healthlink > backup-healthlink-$(date +%F).sql
```

Guarde o backup fora do servidor principal e teste restauração periodicamente. Não execute `docker compose down -v` em produção: esse comando remove o volume do banco.

Para uma parada normal:

```bash
docker compose down
```

Para atualizar a aplicação:

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build
docker compose ps
curl -f https://healthlink.seudominio.com/health
```

## 9. Primeiro acesso e cadastro

1. Acesse a URL HTTPS.
2. Entre com o usuário administrativo provisionado pela equipe responsável.
3. Crie a unidade móvel.
4. Dentro da unidade, crie um equipamento de tipo **Servidor**.
5. Cadastre a Starlink, MikroTik ou link de internet ativo.
6. Confirme que o equipamento servidor aparece com o botão **Gerar agente**.

## 10. Gerar e instalar o agente da unidade móvel

No equipamento servidor:

1. Clique em **Gerar agente**.
2. Escolha **Windows** ou **Linux**.
3. Clique em **Gerar e baixar instalador**.
4. Transfira o arquivo para o servidor da unidade móvel.
5. Execute uma única vez:
   - Windows: PowerShell como Administrador;
   - Linux: `sudo bash healthlink-agent-*.sh`.

O operador não deve preencher URL, tenant, unidade, equipamento, token ou senha. Essas informações são incorporadas ao arquivo pelo backend.

O enrollment expira em 30 minutos e só pode ser utilizado uma vez. Se o arquivo for perdido, expirado ou já executado, gere outro instalador.

Requisitos da unidade móvel:

- saída HTTPS para `PUBLIC_API_URL`;
- acesso local à Starlink, normalmente `192.168.100.1:9200`;
- saída HTTPS para `nodejs.org` na primeira instalação, para baixar o runtime Node.js;
- permissões administrativas somente durante a instalação.

Após instalado, o agente:

- roda como serviço Windows ou unidade `systemd` Linux;
- envia heartbeat continuamente;
- coleta métricas Starlink quando a antena está acessível;
- mantém a origem e a unidade vinculadas;
- consulta novas versões automaticamente;
- valida SHA-256 antes de substituir o bundle;
- reinicia o processo após uma atualização válida.

MikroTik e link de internet podem ser vinculados para o fluxo de agente e heartbeat. Métricas específicas só devem aparecer quando houver um adaptador de coleta real implementado.

## 11. Publicar nova versão do agente

Na aba **Zabbix sincronização / Versões do agente**:

1. selecione Windows ou Linux;
2. informe a versão semântica, por exemplo `1.1.0`;
3. envie o bundle executável `.cjs`;
4. publique.

Não envie o instalador `.ps1` ou `.sh` nessa área. O instalador é gerado por servidor e contém o enrollment específico daquela unidade.

Os agentes instalados consultam o catálogo, baixam uma versão mais nova da mesma plataforma, validam o checksum e reiniciam o serviço.

A publicação de versões exige a permissão específica de gerenciamento de versões do agente. A conta técnica `service_agent` usada pelos agentes não pode publicar releases.

## 12. Monitoramento operacional

No filtro **Agentes**:

- **Aguardando instalação**: o arquivo foi gerado, mas ainda não foi consumido;
- **Agente em execução**: heartbeat recente;
- **Agente parado**: agente vinculado, mas sem heartbeat recente;
- **Sem agente vinculado**: a unidade ainda não possui agente provisionado.

No detalhe da Starlink:

- métricas aguardam a primeira coleta após a instalação;
- mais de 30 segundos sem amostra gera aviso de comunicação;
- `N/D` significa dado ausente, não valor zero.

## 13. Troubleshooting

### Container reiniciando

```bash
docker compose ps
docker compose logs --tail=200 healthlink
```

Confirme `.env`, `JWT_SECRET`, `ZABBIX_CREDENTIALS_ENCRYPTION_KEY`, PostgreSQL e Redis.

### Migrations não aplicadas

```bash
docker compose logs migrate
docker compose exec -T postgres psql -U healthlink -d healthlink -c "SELECT version FROM schema_migrations ORDER BY version;"
```

Não aplique migrations manualmente enquanto o serviço `migrate` estiver executando.

### Interface abre, mas API falha

- valide `/health` na mesma URL pública;
- confirme que o proxy encaminha `/v1/*` para a porta `5174`;
- confira `Host` e `X-Forwarded-Proto`;
- confira se o navegador está usando a mesma origem HTTPS.

### Agente sem comunicação

- confirme o serviço no Windows/Linux;
- confira a rota local até `192.168.100.1:9200`;
- teste saída HTTPS para a API;
- confirme que o relógio do servidor está correto;
- gere um novo arquivo se o enrollment expirou ou já foi usado;
- verifique os logs do serviço do agente.

### Atualização não ocorreu

- confirme que a nova versão é maior que a instalada;
- confirme que o arquivo publicado é `.cjs`;
- confira o SHA-256 no catálogo;
- verifique espaço em disco e permissões do diretório do agente;
- valide se o serviço pode reiniciar o processo.

## 14. Checklist de aceite

- [ ] DNS resolve para o servidor de produção.
- [ ] HTTPS válido e renovação configurada.
- [ ] `.env` de produção criado fora do Git.
- [ ] PostgreSQL persistente e backup testado.
- [ ] Redis interno e disponível.
- [ ] `docker compose ps` sem serviço em loop de reinício.
- [ ] `/health` retorna HTTP 200 externamente.
- [ ] migrations aplicadas sem erro.
- [ ] unidade, servidor e fonte cadastrados.
- [ ] instalador Windows homologado.
- [ ] instalador Linux homologado.
- [ ] primeira coleta Starlink recebida.
- [ ] agente aparece como em execução.
- [ ] nova versão publicada e atualização automática validada.
- [ ] revogação e geração de novo enrollment testadas.
