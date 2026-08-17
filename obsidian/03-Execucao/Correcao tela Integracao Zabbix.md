# Correção da tela de Integração Zabbix

## Sintoma

Ao abrir **Integração Zabbix**, a aplicação ficava totalmente vazia.

## Causa

O frontend importa o componente `Map` do React MapLibre. Dentro de `ZabbixIntegration`, o código usava `new Map(...)` para criar um mapa de vínculos. O identificador resolvia para o componente React, não para o construtor nativo do JavaScript, gerando `TypeError: Map is not a constructor`.

## Correção

O mapa de vínculos agora usa explicitamente `new globalThis.Map(...)`, evitando a colisão de nomes e preservando o componente cartográfico.

## Validação

- `npm.cmd run typecheck` aprovado.
- `npm.cmd run build:web` aprovado.
- Tela validada no navegador: 29 hosts carregados e vínculos exibidos.
