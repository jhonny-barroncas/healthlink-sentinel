---
type: execution
module: monitoring
status: complete
updated: 2026-08-07
---

# Operação de Monitoramento — Fase 3

## Resultado

A sincronização Zabbix agora projeta o estado de todos os equipamentos vinculados, mesmo quando não existe alerta ativo. A saúde do conector é registrada separadamente do estado dos hosts.

## Regras operacionais

- Host ausente do catálogo autorizado ou desabilitado no Zabbix: `unknown`.
- Interface principal indisponível, sem outra interface principal disponível: `offline`.
- Problema ativo com severidade 4 ou 5: `offline`.
- Outro problema ativo, inclusive não classificado: `degraded`.
- Host habilitado e sem problema ativo: `online`.
- A unidade herda o pior estado entre seus equipamentos ativos.

## Saúde da integração

A migration `006_integration_sync_status.sql` criou `integration_sync_status`, isolada por tenant com RLS. Ela registra:

- última tentativa e última coleta bem-sucedida;
- última falha e erro resumido;
- falhas consecutivas;
- hosts vistos, hosts vinculados e problemas encontrados;
- duração da sincronização.

Uma ou duas falhas consecutivas deixam o conector em `degraded`. A partir da terceira falha ele fica `unavailable`, e os equipamentos vinculados passam para `unknown` para impedir a exibição de estados verdes obsoletos. A próxima coleta válida zera o contador de falhas.

## API e frontend

- `POST /v1/integrations/zabbix/sync`: sincronização manual e base do scheduler.
- `GET /v1/integrations/zabbix/status`: saúde e última coleta da integração.
- A tela **Integração Zabbix** possui o botão **Sincronizar agora**.
- O painel exibe saúde, última coleta válida, duração, falhas consecutivas e último erro.
- O rodapé lateral mostra o estado atual do conector.

## Validação real

Em 2026-08-07, a sincronização retornou:

- conexão saudável;
- 29 hosts autorizados;
- 2 hosts vinculados processados;
- nenhum host vinculado ausente;
- 22 problemas encontrados no catálogo;
- os equipamentos `Zabbix Server` e `IPSec - LAVTIMON` projetados como `online`.

Validações técnicas: `npm.cmd run typecheck` e `npm.cmd run build:web` aprovadas.

## Links

- [[Plano de Implementacao]]
- [[Frontend - Cadastro e Vinculo Zabbix]]
- [[Worker Zabbix Automático]]
- [[Estado Operacional e Zabbix]]
- [[../00-Índice e Contexto Atual]]
