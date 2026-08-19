# Centro Operacional — mapa geográfico dark

## Decisão

O mapa vetorial nacional com `@svg-maps/brazil` permanece como visão estratégica por UF. Ao clicar em um estado, o Centro Operacional abre uma camada geográfica detalhada usando MapLibre GL, React Map GL e o estilo dark do OpenFreeMap.

## Preferência de tema

O mapa geográfico detalhado agora permite alternar entre `Dark` e `Claro` no próprio cabeçalho. A preferência é persistida no navegador (`healthlink.map-theme`) e se aplica ao estilo vetorial do OpenFreeMap e ao fallback raster do CARTO. O mapa vetorial nacional permanece dark por fazer parte da identidade operacional do Centro Operacional.

## Cards por tipo de telemetria

- Links com telemetria de interface (SNMP e itens equivalentes) mantêm o card de latência, perda e tráfego.
- Equipamentos `vpn`/IPsec usam card de estado do túnel, com `UP`, `DOWN`, atenção ou ausência de estado, sem apresentar métricas de interface inexistentes.
- Equipamentos `starlink` usam card próprio, com métricas `starlink.latency.ms`, `starlink.download.bps` e `starlink.upload.bps` quando disponíveis.

## Diagnóstico e camadas

- Ping manual bem-sucedido passa a aparecer no card e na análise detalhada mesmo quando não existe amostra recente do Zabbix, sempre identificado como `Ping manual`.
- O aviso de telemetria zerada continua sendo usado quando não há nem amostra do Zabbix nem diagnóstico manual válido.
- A análise detalhada, o menu contextual e o painel de diagnóstico receberam uma hierarquia explícita de camadas para evitar sobreposição incorreta entre avisos, botões e modais.

## Fluxo implementado

1. Operador seleciona uma UF no mapa nacional.
2. Abre um painel flutuante em vidro fosco com mapa navegável.
3. O mapa centraliza a UF, permite zoom e deslocamento.
4. Unidades com latitude e longitude aparecem como marcadores semânticos.
5. O marcador abre um card com nome, código, cidade, estado operacional e acesso ao detalhe da unidade.
6. Uma lista lateral informa unidades localizadas e unidades com georreferenciamento pendente.

## Regras de segurança operacional

- Unidade sem latitude ou longitude não recebe posição aproximada.
- Coordenadas vazias não podem ser interpretadas como `0,0`.
- O mapa informa explicitamente a cobertura de georreferenciamento.
- A cor do marcador segue os estados: operacional, atenção, indisponível e sem telemetria.

## Tecnologia

- `maplibre-gl`
- `react-map-gl/maplibre`
- estilo: `https://tiles.openfreemap.org/styles/dark`
- dados cartográficos: OpenFreeMap / OpenStreetMap, com atribuição exibida pelo mapa
- fallback automático: tiles raster dark do CARTO quando o estilo vetorial não conseguir carregar na rede local
- fallback de mapa real: após 2,5 s sem carregamento vetorial, o painel troca para tiles raster do OpenStreetMap/CARTO; não usar o vetor esquemático como substituto visual do mapa real

## Alterações técnicas

- O endpoint `/v1/monitoring/units` passou a retornar `latitude` e `longitude`.
- O frontend passou a consumir os campos já existentes no banco `health_units`.
- Foi mantido o menu de contexto com botão direito para cadastro rápido de unidade.
- Foi adicionado o botão **Explorar mapa** para reabrir o detalhe da UF selecionada.

## Validação

- `npm.cmd run typecheck` — aprovado.
- `npm.cmd run build:web` — aprovado.
- Fallback de provedor adicionado após a primeira validação visual indicar contêiner carregado com tiles externos ausentes.
- Fallback ajustado após validação do usuário: o produto deve mostrar mapa geográfico real; o vetor esquemático nacional não atende ao requisito visual.
- A validação automática no navegador ficou indisponível nesta sessão por restrição do controlador local; executar verificação manual clicando em uma UF.

## Próxima evolução

Adicionar ao cadastro e à edição da unidade um seletor de posição no mapa, preenchendo latitude e longitude sem exigir digitação manual.

## Cadastro de localização

- O cadastro de unidade agora aceita latitude e longitude opcionais.
- A edição da unidade permite informar, alterar ou remover as coordenadas.
- No mapa estadual, clicar em uma unidade sem localização fecha o mapa e abre o detalhe para completar as coordenadas.
- Quando todas as unidades do estado estão pendentes, o painel oferece **Adicionar localização** para a primeira unidade.

## Formulários flutuantes

Todos os formulários de cadastro e edição de unidade/equipamento são exibidos como modal flutuante com backdrop escuro, blur e fechamento por `Esc`, `X`, clique fora ou cancelar. Isso evita que o formulário empurre o conteúdo da tela principal.

## Menu contextual de unidades

O botão direito sobre um card de unidade abre um menu flutuante com as ações **Abrir unidade**, **Editar unidade**, **Cadastrar equipamento** e **Cancelar**. O menu fecha ao clicar fora ou ao rolar a página.

O mapa estadual calcula os limites das unidades georreferenciadas e aplica `fitBounds` automaticamente ao abrir, com zoom máximo controlado. O fallback cartográfico é acionado após 1,5 s sem carregamento vetorial para reduzir a percepção de espera.

## Nota de estabilidade cartográfica

O fallback raster usa somente o estilo dark do CARTO. Misturar URLs de provedores diferentes na mesma fonte raster faz os tiles vizinhos alternarem de estilo e cria faixas claras/escuras no mapa.

## Centralização ao selecionar unidade

Ao clicar em uma unidade na lista lateral ou em seu marcador, o mapa usa `flyTo` para centralizar a coordenada selecionada e aplicar zoom operacional (nível 14). A animação é curta e mantém o popup da unidade visível, permitindo confirmar rapidamente a localização antes de abrir o cadastro completo.

## Ação de localização pendente

O card **Localização ainda não informada** mantém apenas o botão circular laranja com `+`. Esse próprio botão abre o cadastro da primeira unidade pendente; não há mais um botão ciano separado, preservando o designer e reduzindo ruído visual.

## Relacionados

- [[Centro Operacional - Mapa Interativo]]
- [[Centro Operacional - Fase 4]]
- [[Estado Atual]]
- [[../../01-Produto/Fonte PRD/MAPA-INTERATIVO]]

## Atualização de telemetria e gráfico

- O gráfico detalhado conserva valor e instante de cada amostra e exibe tooltip nativo ao passar sobre os pontos, com latência e data/hora.
- A seleção de tráfego ignora itens Zabbix de descartes, erros e drops. A projeção prioriza itens de bits/bytes recebidos e enviados, evitando que `net.if.*.discards` apareça incorretamente como `0 bps` de download/upload.

## Telemetria de links no painel lateral - 2026-08-11

- Correção 2026-08-19: a lateral deixou de usar apenas o primeiro registro (`[0]`) da telemetria por unidade. O frontend agrupa todos os links por `unit_id`, mantém um único ponto visual no mapa e exibe também os equipamentos cadastrados que ainda não possuem telemetria, encapsulados no card da unidade. Cada link continua abrindo sua própria análise detalhada.
- A lista simples de unidades foi redesenhada como cards operacionais inspirados na referência NET-OPS fornecida pelo produto.
- Cada card apresenta estado `OPR`, `ATN`, `DWN` ou `N/D`, latência, perda, tráfego de entrada e saída, capacidade nominal quando disponível e uma linha histórica de latência.
- Os valores vêm do endpoint multi-tenant `GET /v1/monitoring/link-telemetry`; o frontend mostra `Sem telemetria de desempenho` e travessões quando o Zabbix não fornece os itens necessários.
- O ciclo Zabbix passou a reconhecer itens `icmppingsec`, `icmppingloss`, `net.if.in`, `net.if.out` e `net.if.speed`, priorizando interfaces identificadas como WAN, Internet, Starlink ou uplink.
- As amostras são persistidas em `metric_samples`, tabela já existente e protegida por RLS. Amostras com o mesmo equipamento, métrica e instante não são duplicadas.
- O frontend continua sem acesso direto ao Zabbix; toda telemetria passa pela API HealthLink.
- Correção posterior: o agrupamento dos cards usa explicitamente `globalThis.Map`, evitando conflito com o componente cartográfico `Map` importado do React Map GL. O conflito anterior interrompia a renderização ao abrir o mapa e deixava apenas o fundo escuro.
- Atualização rápida: o frontend consulta a projeção de telemetria a cada 2 segundos e a API coleta os itens leves do Zabbix a cada 2 segundos por padrão, independente do ciclo completo de 60 segundos. A frequência efetiva ainda depende do intervalo configurado nos itens do próprio Zabbix.
- O painel geográfico foi ampliado para até `1480px × 900px`, limitado ao viewport, e a coluna `Links Ativos` passou a usar largura responsiva entre 350px e 420px. Cards, telemetria, sparkline, metadados e controles receberam tipografia e espaçamento maiores para leitura operacional sem zoom do navegador.
- Refinamento visual posterior: o painel lateral foi aproximado da referência NET-OPS enviada pelo produto. Agora usa o título `Links Ativos`, cards compactos de vidro escuro, nome do link, ícone semântico, selo `OPR`/`ATN`/`DWN`/`N/D`, latência, perda, banda e sparkline luminoso. Tráfego e horário permanecem em uma linha técnica discreta.
- Evolução de interação: toda a superfície do card de link agora é clicável e focaliza a unidade no mapa; o botão `VER` foi removido como alvo obrigatório.
- O comando `Abrir unidade` do popup abre uma janela flutuante de análise detalhada inspirada no HTML de referência, com estado, última amostra, gráfico real de latência, perda, capacidade e tráfego. A ação secundária `Abrir inventário completo` mantém acesso ao detalhe administrativo existente.
- Métricas de SLA, reinício de rota e abertura de chamado presentes apenas no protótipo não foram simuladas; dependem de requisitos, dados históricos e endpoints próprios antes de serem expostas.
- Correção semântica: os cards e a análise detalhada passaram a destacar `Download` (`net.if.in`) e `Upload` (`net.if.out`) observados na interface priorizada.
- Correção de confiabilidade: `net.if.speed` deixou de alimentar `network.capacity.bps`, pois representa a negociação da porta e não a banda contratada. Na etapa intermediária, antes do campo cadastral existir, a interface passou a mostrar `N/D`. Amostras antigas não foram apagadas, para preservar o histórico, mas deixaram de ser consultadas e atualizadas pelo fluxo operacional.
- Evolução concluída: download e upload contratados agora podem ser informados em Mbps no cadastro/edição do equipamento. O painel lateral mostra `Plano: ↓ download · ↑ upload`, e a análise detalhada separa esse plano cadastrado do tráfego atual coletado pelo Zabbix. Cada direção ausente continua como `N/D`.
- O detalhe flutuante do link passou a usar a altura disponível com layout flexível, cabeçalho fixo, rolagem apenas no conteúdo e scrollbar coerente com o tema dark, evitando corte inferior e barra clara do navegador.
- O bloco explicativo `Origem da telemetria` foi substituído por `Histórico de erros`. Ele combina alertas ativos e resolvidos já carregados pelo Centro Operacional, filtra pelo `equipment_id` do link, ordena pela ocorrência mais recente e exibe até oito registros reais com datas e estado. Na ausência de registros, informa explicitamente que nenhum erro foi registrado.
- O diagnóstico Ping agora retorna também a média em milissegundos extraída da saída real do sistema operacional. Após um Ping manual bem-sucedido, o card, a linha histórica e o gráfico do link usam essa medição local em memória e identificam a origem como `Último ping local · medição manual`; sem esse diagnóstico, permanecem nas amostras do Zabbix. Isso evita apresentar a latência do agente Zabbix como se fosse a mesma rota do computador do operador.
