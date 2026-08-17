# Diagnóstico flutuante e menu na lista

## Implementado

- O menu de contexto das unidades existe nos marcadores do mapa e também na lista lateral do mapa estadual.
- As opções são **Ping**, **Tracert** e **Adicionar equipamento**.
- Ping e Tracert continuam sendo executados pela API (`POST /v1/equipment/:id/diagnostics`), mas o resultado deixou de usar `window.alert`.
- O resultado aparece em um painel flutuante glassmorphism dentro do mapa.
- Enquanto a execução está em andamento, o painel mostra o estado de execução; ao finalizar, exibe sucesso, falha e a saída técnica.
- Adicionar equipamento permanece em modal flutuante, sem redirecionar a página.

## Validação

- `npm.cmd run typecheck` aprovado.
- `npm.cmd run build:web` aprovado.
