# Centro operacional — mapa interativo

## Implementação

- O menu **Centro operacional** e **Unidades móveis** agora têm estados independentes.
- Centro operacional recebeu visão NOC com métricas de frota, disponibilidade, escopo de monitoramento, mapa interativo do Brasil e ranking de problemas.
- O mapa usa o vetor oficial de `@svg-maps/brazil`, com cada UF desenhada como um `path` real e clicável.
- A função `getStateFill(uf)` aplica a regra operacional: vermelho quando mais de 50% dos ativos da UF estão offline; âmbar quando há offline/degradado ou instabilidade; verde quando 100% está online; slate quando não há unidades cadastradas.
- O mapa mantém a identidade visual Sentinel: fundo azul-noite, tooltip glassmorphism, brilho de interação e borda néon `#00FF9D` para a UF selecionada.
- O cabeçalho do mapa identifica o controle supervisor/NOC e o rodapé mantém a legenda operacional, incluindo a UF selecionada.
- Ao clicar em um estado com unidade cadastrada, a navegação abre o detalhe correspondente em **Unidades móveis**.
- Estados sem unidade também podem ser selecionados e informam que não há unidade cadastrada naquela área.
- O ranking de problemas usa os alertas ativos sincronizados do HealthLink/Zabbix e leva ao detalhe da unidade associada quando disponível.

## Separação de responsabilidades

- **Centro operacional:** consciência situacional, mapa, indicadores e priorização de incidentes.
- **Unidades móveis:** inventário, estado dos equipamentos e prontidão de uma unidade.
- **Alertas:** fila operacional e histórico resolvido.

## Validação

- `npx tsc -p apps/web/tsconfig.json --noEmit` — aprovado.
- `npm run build:web` — aprovado.
- `npm run typecheck` — aprovado.

## Atualização vetorial

- Dependência adicionada: `@svg-maps/brazil`.
- O tooltip informa UF, nome do estado e disponibilidade das unidades ao passar o cursor ou navegar por teclado.
- A seleção permanece visível no mapa; quando há unidade cadastrada, o botão **Abrir unidade** leva ao detalhe em **Unidades móveis**. Estados sem unidade permanecem consultáveis no mapa.

## Detalhe geográfico dark

O clique na UF agora abre um painel navegável com zoom, marcadores operacionais e lista de unidades. A implementação e as regras de georreferenciamento estão documentadas em [[Centro Operacional - Mapa Geografico Dark]].
