# Otimização de carregamento do mapa

## Alterações

- O mapa estadual inicia com estilo raster dark leve, evitando aguardar o carregamento de um arquivo JSON de estilo vetorial.
- Removido o fallback tardio de 1,5 segundo, que deixava a área preta durante a troca de provedor.
- Adicionada preconexão DNS/TLS para o servidor de tiles CARTO.
- Incluído indicador visual de carregamento no centro do mapa.
- O indicador é reiniciado corretamente ao trocar de estado.
- Mantidos zoom automático, marcadores, menu contextual e seleção de unidades.

## Validação

- `npm.cmd run typecheck` aprovado.
- `npm.cmd run build:web` aprovado.
