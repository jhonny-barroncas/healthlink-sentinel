# Status e ponte de hosts Zabbix

## Decisão de UX

- O status do Zabbix na lateral é um botão de ação, não apenas um texto informativo.
- Ao clicar, o usuário abre a área unificada de integração.
- A área unificada concentra:
  - saúde da conexão;
  - última coleta válida;
  - hosts encontrados;
  - hosts vinculados;
  - problemas recebidos;
  - contagem regressiva para a próxima sincronização;
  - ponte de hosts para vincular host Zabbix → equipamento → unidade.
- A navegação dedicada “Status das conexões” deixa de ser necessária para evitar duplicação.

## Comportamento técnico

- O contador usa o último ciclo de tentativa e considera o intervalo automático de 60 segundos.
- O botão da lateral atualiza o status e carrega o catálogo de hosts ao abrir a integração.
- A listagem de hosts permanece pesquisável e mostra o estado de vínculo.
- A identidade visual mantém o dark glassmorphism, com textos maiores na área de integração para melhorar a leitura.

## Arquivos

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`

## Validação

- `npm.cmd run typecheck` passou.
- `npm.cmd run build:web` passou.

## NavegaÃ§Ã£o atualizada

- A aba dedicada de IntegraÃ§Ã£o Zabbix foi removida da navegaÃ§Ã£o principal.
- O acesso Ã  ponte de hosts e ao status ocorre pelo botÃ£o clicÃ¡vel de sincronizaÃ§Ã£o na lateral.
- A aba antiga de status tambÃ©m permanece oculta para evitar duplicidade visual.
- O painel completo `ZabbixStatusPanel` Ã© renderizado dentro da tela unificada de hosts; o status nÃ£o fica perdido nem depende de uma aba separada.
- AprovaÃ§Ã£o de solicitaÃ§Ãµes de acesso tornou-se idempotente: se o e-mail jÃ¡ existir, o usuÃ¡rio Ã© associado/reativado no tenant e o perfil Ã© aplicado sem quebrar por duplicidade.
- UsuÃ¡rios bloqueados continuam visÃ­veis no gerenciamento; o bloqueio apenas desativa o vÃ­nculo do tenant e o desbloqueio usa o mesmo PATCH para reativÃ¡-lo.
- Conta administrativa reativada no banco apÃ³s bloqueio em massa; bloqueios futuros nÃ£o devem remover identidades da lista.
