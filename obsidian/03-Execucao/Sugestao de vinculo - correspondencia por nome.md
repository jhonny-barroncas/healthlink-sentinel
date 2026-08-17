# Sugestão de vínculo por nome

## Alteração

A sugestão automática da tela Integração Zabbix agora prioriza a correspondência exata entre o nome do host e o nome do equipamento. Isso permite selecionar sugestões como `IPSec - HPS 28` mesmo quando o código da unidade ou o tipo não puderem ser inferidos.

## Comportamento

- Clique no card verde de sugestão para preencher o equipamento no seletor.
- A sugestão fica destacada quando selecionada.
- Se não houver correspondência por nome, permanece o fallback por unidade + tipo.
- O vínculo só é persistido ao clicar em **Vincular host ao equipamento**.

## Validação

- `npm.cmd run typecheck` aprovado.
- `npm.cmd run build:web` aprovado.
