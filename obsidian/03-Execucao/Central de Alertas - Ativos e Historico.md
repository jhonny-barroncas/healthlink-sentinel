# Central de Alertas — ativos e histórico

## Implementação

- A Central de Alertas foi separada em duas visões: **Ativos** e **Histórico resolvido**.
- Ativos consultam apenas eventos `open` e `acknowledged` do HealthLink Sentinel.
- Histórico consulta apenas eventos `resolved`, preservando a rastreabilidade sem misturar incidentes encerrados com a fila operacional.
- O contador do menu lateral e a faixa de missão exibem somente alertas ativos.
- As ações **Reconhecer** e **Resolver** aparecem apenas na visão de ativos.
- A identidade visual corporativa atual foi mantida: paleta escura, ciano operacional, âmbar de atenção e vermelho crítico.

## Mapa interativo

O mapa do Brasil continua sendo um requisito interativo do produto: seleção de estado/unidade, leitura de status e abertura do detalhe operacional. Esta alteração não implementa nem remove o mapa; ela apenas organiza a Central de Alertas. A implementação do mapa permanece como etapa própria do centro operacional.

## Validação

- `npx tsc -p apps/web/tsconfig.json --noEmit` — aprovado.
- `npm run build:web` — aprovado.
- `npm run typecheck` — aprovado.

## Próximo passo

Validar no navegador com um alerta ativo e um alerta resolvido: o ativo deve aparecer em **Ativos**, e após ser resolvido deve sair dessa fila e aparecer em **Histórico resolvido**.
