# Reestruturação visual do HealthLink Sentinel

## Objetivo

Consolidar a experiência visual do HealthLink Sentinel em todas as telas, mantendo a identidade dark/glass corporativa, a leitura operacional em menos de 10 segundos e os fluxos de autorização já existentes.

## Escopo

- Tokens compartilhados de cor, superfície, tipografia, espaçamento, raio, foco e movimento.
- Estados visuais consistentes para online, atenção, indisponível, sem telemetria, carregando, erro e sucesso.
- Animações discretas para expansão, entrada de painéis, hover, foco, feedback de ação e atualização de telemetria.
- Responsividade para desktop, tablet e celular sem criar rolagem desnecessária em modais.
- Aplicação progressiva nas telas de login, centro operacional, mapa, unidades, equipamentos, agentes, alertas, relatórios, integração Zabbix e usuários.

## Não objetivos

- Alterar regras de RBAC, contratos da API ou modelo de dados.
- Adicionar uma biblioteca nova de ícones ou animações.
- Usar efeitos neon, movimentos contínuos chamativos ou informações simuladas.

## Diretrizes

- Reutilizar os tokens existentes em `apps/web/src/styles.css` e evoluí-los sem duplicar cores ad hoc.
- Preservar componentes e fluxos existentes em `apps/web/src/App.tsx`; extrair apenas quando isso reduzir duplicação visual real.
- Animações devem respeitar `prefers-reduced-motion`.
- Toda ação interativa precisa manter foco visível, nome acessível e estado desabilitado compreensível.
- Cada lote visual deve passar por typecheck, build web e validação Docker.

## Critério de aceite

As telas usam a mesma linguagem visual, os estados operacionais são distinguíveis sem depender apenas de cor, os cards e modais não criam rolagem inesperada em viewport disponível e nenhuma regra de negócio ou autorização é alterada.
