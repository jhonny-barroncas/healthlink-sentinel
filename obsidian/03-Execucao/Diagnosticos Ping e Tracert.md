# Diagnósticos no mapa

O menu contextual das unidades agora executa diagnósticos reais:

- `Ping`: quatro pacotes para o endereço de gerenciamento.
- `Tracert`: rastreia até 12 saltos, com timeout de 1 segundo por salto.
- O backend valida o endereço cadastrado, exige autenticação e limita a execução a equipamento ativo do tenant.

O resultado aparece em uma janela de diagnóstico. A opção `Adicionar equipamento` abre o formulário em um modal glassmorphism sobre o mapa, sem trocar de página.
