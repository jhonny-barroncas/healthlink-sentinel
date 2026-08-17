# Frontend - Central de Alertas

Data: 2026-08-06

## Implementado

- Navegação lateral para a Central de Alertas.
- Indicador de quantidade de alertas no menu.
- Consulta real em `GET /v1/monitoring/alerts`.
- Visualização de severidade, unidade, equipamento, status e data.
- Ação de reconhecer em `POST /v1/monitoring/alerts/:id/acknowledge`.
- Ação de resolver em `POST /v1/monitoring/alerts/:id/resolve`.
- Estado vazio explícito quando não existem incidentes.

## Validação

- Typecheck do frontend concluído.
- Build de produção concluído.
- Typecheck da API concluído.

## Próximo passo

Criar filtros operacionais por status/severidade e o detalhe histórico do alerta.
