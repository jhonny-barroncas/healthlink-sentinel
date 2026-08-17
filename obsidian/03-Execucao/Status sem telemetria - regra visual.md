# Status sem telemetria — regra visual

## Regra

Uma unidade cadastrada sem coleta do Zabbix não é representada como neutra: aparece em amarelo, como **Atenção**, pois requer ação operacional. O cinza fica reservado para estados sem unidades cadastradas.

## Alterações

- Mapa estadual: UF com unidade `unknown` recebe cor âmbar.
- Cards de unidade: status `unknown` usa borda e marcador âmbar.
- O rótulo técnico continua identificando “Sem telemetria” quando necessário.

## Validação

`npm.cmd run typecheck` e `npm.cmd run build:web` aprovados.
