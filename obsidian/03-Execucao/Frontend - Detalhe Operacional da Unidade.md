# Frontend - Detalhe Operacional da Unidade

Data: 2026-08-06

## Implementado

- Cartões das unidades agora são interativos.
- Clique abre o detalhe operacional da unidade.
- Lista de ativos monitorados por unidade.
- Estado individual dos equipamentos.
- Data da última observação, quando disponível.
- Indicador de prontidão operacional.
- Totais de equipamentos indisponíveis, em atenção e sem telemetria.
- Navegação para retornar ao centro operacional.

Os dados são consumidos de `GET /v1/monitoring/equipment` e cruzados no frontend pelo `unit_id`.

## Validação

- Typecheck do frontend concluído.
- Build de produção concluído.

## Próximo passo

Implementar a central de alertas com reconhecimento e resolução pela interface.
