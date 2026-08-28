# Fluxo confiável de distribuição e atualização do agente

## Objetivo

Garantir que os instaladores Windows e Linux sempre sejam gerados a partir de
um bundle executável validado do motor do agente, e que o agente instalado
consulte e aplique a maior versão compatível com sua plataforma sem ficar preso
a placeholders ou a versões antigas.

## Escopo

- catálogo de releases da API;
- geração dos instaladores PowerShell e Bash;
- seleção, checksum, troca atômica e finalização da atualização no runtime;
- build padrão do bundle embutido e sincronização no startup da API;
- retenção mínima do backup anterior;
- testes de regressão e documentação operacional.

## Decisões

1. Artefatos executáveis do motor aceitos pelo catálogo: `.cjs` e `.js`.
2. Instaladores `.ps1` e `.sh` são envelopes gerados pelo backend; não são
   releases do motor e não podem ser escolhidos como fonte de atualização.
3. A versão candidata é filtrada por plataforma, `active`, semver válida e
   nome de bundle executável. A maior versão semântica é escolhida.
4. O instalador recebe o bundle da mesma versão e o checksum desse bundle; a
   instalação valida o conteúdo antes de ativar o serviço.
5. A substituição mantém um único backup transitório (`.previous`) durante a
   troca. Após o novo processo iniciar e concluir o ciclo inicial com sucesso,
   o backup é removido; em falha fatal, o runtime tenta restaurá-lo.
6. O build padrão produz a versão embutida definida pelo servidor, permitindo
   que `git pull` seguido de build Docker gere e publique automaticamente o
   bundle correto por tenant.

## Fluxo esperado

1. O build gera o bundle versionado e valida seu marcador.
2. A API sincroniza o bundle para Windows e Linux no startup, sem substituir
   uma publicação administrativa real.
3. O provisionamento escolhe somente uma release executável da plataforma e
   gera o instalador correspondente.
4. O instalador grava a configuração com a versão do bundle e inicia o serviço.
5. O runtime consulta releases, baixa a maior versão compatível, valida
   checksum, atualiza o config e reinicia pelo mecanismo do sistema.
6. O novo processo valida o startup; em sucesso, remove o backup anterior.

## Critérios de aceite

- publicar `.cjs` ou `.js` gera uma release consumível;
- publicar/tentar provisionar usando somente `.ps1`/`.sh` não cria uma release
  executável nem quebra o fluxo;
- Windows e Linux recebem instaladores com versão e checksum correspondentes;
- uma lista fora de ordem sempre resulta na maior versão semântica da mesma
  plataforma;
- uma atualização bem-sucedida não deixa `.previous` persistente;
- falha de download, checksum ou startup não substitui silenciosamente o
  agente funcional;
- `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build:agent`,
  `npm.cmd run build:web` e o build/health do Docker passam.
