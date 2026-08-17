---
area: execucao
status: concluida
updated: 2026-08-07
---

# Centro Operacional — Fase 4

## Entregue

- Mapa vetorial do Brasil usando `@svg-maps/brazil`.
- Cor da UF derivada do estado das unidades:
  - verde: todas operacionais;
  - amarelo: atenção, degradação ou instabilidade;
  - vermelho: mais de 50% das unidades indisponíveis;
  - slate: sem unidades ou sem telemetria confiável.
- Tooltip com UF, nome do estado, quantidade de unidades e situação.
- Seleção de uma UF exibindo todas as unidades cadastradas nela.
- Clique na unidade abre o detalhe operacional já existente.
- Filtros de sala de controle por UF e situação: operacional, atenção, indisponível e sem telemetria.
- Botão para limpar o recorte e retornar ao Brasil inteiro.

## Fonte dos dados

O centro usa `/v1/monitoring/units` e `/v1/monitoring/alerts`. A origem da situação é o ciclo de sincronização Zabbix da Fase 3; o frontend não inventa estado local.

## Validação

- `npm.cmd run typecheck`: aprovado.
- `npm.cmd run build:web`: aprovado.

## Próxima evolução

Adicionar filtros combinados por unidade, ranking filtrado por UF e testes de aceitação visual com operadores NOC.

## Ajuste posterior — cadastro de unidade

- UF agora aceita seleção por lista ou digitação manual.
- Após uma UF válida, o campo de cidade carrega municípios via BrasilAPI/IBGE.
- Cidade continua editável manualmente para localidades não retornadas pelo catálogo ou quando a consulta externa estiver indisponível.

## SubnavegaÃ§Ã£o por tipo de infraestrutura

- O item **Centro operacional** agora abre um submenu com quatro visÃµes: **Geral**, **Links**, **VPN** e **Servidores**.
- A visÃ£o selecionada filtra as unidades pelos equipamentos cadastrados no inventÃ¡rio.
- O mapa, os contadores, a lista por UF e o recorte de disponibilidade acompanham a visÃ£o selecionada.
- A visÃ£o **Geral** preserva o comportamento anterior e mostra todas as unidades.
- ValidaÃ§Ã£o: `npm.cmd run typecheck` e `npm.cmd run build:web` aprovados apÃ³s a alteraÃ§Ã£o.

## AÃ§Ã£o rÃ¡pida no mapa para cadastrar unidade

- O clique com o botÃ£o direito em uma UF abre um card contextual de aÃ§Ã£o rÃ¡pida.
- O card identifica a UF e oferece o comando **Adicionar unidade**.
- O formulÃ¡rio abre dentro do Centro Operacional com a UF previamente preenchida.
- A lista de cidades continua sendo carregada conforme o estado selecionado.
- ApÃ³s o cadastro, o inventÃ¡rio, o mapa e os contadores operacionais sÃ£o atualizados automaticamente.
- O card pode ser fechado pelo botÃ£o `Ã—`, pela tecla `Esc` ou clicando fora dele.
- ValidaÃ§Ã£o: `npm.cmd run typecheck` e `npm.cmd run build:web` aprovados.

## PadrÃ£o visual de campos obrigatÃ³rios

- Os formulÃ¡rios de cadastro de unidade e equipamento exibem a orientaÃ§Ã£o de que campos marcados com `*` sÃ£o obrigatÃ³rios.
- Campos opcionais sÃ£o identificados explicitamente.
- Ao tentar salvar dados incompletos, o campo invÃ¡lido recebe borda vermelha e uma mensagem especÃ­fica.
- A mensagem desaparece automaticamente quando o valor passa a ser vÃ¡lido.
- O comportamento utiliza `aria-invalid` para apoiar acessibilidade.
- ValidaÃ§Ã£o: `npm.cmd run typecheck` e `npm.cmd run build:web` aprovados.

## Redesign dos indicadores do Centro Operacional

- Os seis indicadores superiores foram aproximados da referÃªncia visual fornecida.
- Cards com cantos arredondados, fundo azul profundo, borda discreta e brilho semÃ¢ntico.
- Valores receberam maior hierarquia tipogrÃ¡fica.
- Cada indicador possui um Ã­cone vetorial em marca-d'Ã¡gua: unidades, conectividade, indisponibilidade, degradaÃ§Ã£o, disponibilidade e alerta.
- As cores continuam seguindo a semÃ¢ntica operacional do HealthLink Sentinel.
- ValidaÃ§Ã£o: `npm.cmd run typecheck` e `npm.cmd run build:web` aprovados.
## Separação do status das conexões

- O aviso de escopo/Zabbix foi removido do Centro Operacional para reduzir ruído visual.
- Foi criada a navegação **Status das conexões**, com indicador semântico discreto no menu.
- A nova área concentra a saúde técnica do Zabbix: estado consolidado, última coleta válida, duração, hosts encontrados e vinculados, problemas recebidos, falhas consecutivas e último erro.
- A tela **Integração Zabbix** permanece dedicada à configuração de hosts, equipamentos e vínculos.
- A estrutura foi preparada para receber outras integrações corporativas no futuro sem poluir a visão operacional.
## Seletores de localização em vidro fosco

- Os campos de UF e cidade deixaram de usar o `datalist` nativo do navegador, que abria uma lista excessivamente alta e visualmente inconsistente.
- Foi criado um combobox próprio que permite tanto digitação quanto seleção.
- O painel possui altura limitada, rolagem interna, busca por código/nome e acabamento glassmorphism alinhado ao HealthLink Sentinel.
- A lista permanece contida na largura do campo e não atravessa mais a página.
## Card de status do Zabbix

- Os seis indicadores técnicos foram separados visualmente em blocos independentes.
- Cada bloco possui borda, fundo fosco, espaçamento e interação de hover próprios.
- O cabeçalho da integração, painel técnico contextual e rodapé permanecem preservados.
## Detalhes por indicador

- Cada um dos seis blocos do status Zabbix agora possui uma explicação contextual própria ao passar o mouse.
- Os textos explicam origem, significado e impacto operacional de coleta, duração, hosts, vínculos, problemas e falhas consecutivas.
- O tooltip usa o mesmo acabamento glassmorphism e não altera o conteúdo principal do card.
## Refinamento dos tooltips

- O painel geral de “Detalhes técnicos” foi removido por duplicar as informações.
- Permanecem somente os tooltips específicos em cada um dos seis indicadores.
## Desativação e exclusão de equipamentos

- Corrigido o erro de desativação causado por requisição DELETE com `Content-Type` sem corpo.
- O cliente agora envia `Content-Type` somente quando há corpo na requisição.
- Adicionada ação **Excluir** ao inventário, com confirmação explícita e registro `equipment.deleted` na auditoria.
- Desativar continua sendo a ação recomendada para preservar histórico; excluir é definitivo e remove o cadastro e vínculos.
## Reorganização da tela da unidade

- Equipamentos deixaram de ser repetidos entre “Ativos monitorados” e “Gestão do inventário”.
- A lista única agora mostra nome, tipo, endereço, status, edição, desativação e exclusão.
- A edição da unidade foi movida para o cabeçalho da unidade.
- O painel separado de gestão foi removido para reduzir poluição visual e manter uma única fonte de verdade.

## Navegação entre cards operacionais

- O card usa navegação em carrossel com os controles `<` e `>` no canto superior direito.
- As visões são **Ranking de problemas**, **Problemas registrados** e **Cobertura de monitoramento**.
- Problemas registrados incluem ocorrências resolvidas e respeitam o recorte atual (Geral, Links, VPN ou Servidores).
- O histórico exibido usa uma janela móvel de 30 minutos, com limpeza automática e botão **Limpar lista** para o operador.
- A limpeza é apenas visual; não remove o histórico oficial nem a auditoria do backend.
- Validação: `npm.cmd run typecheck` e `npm.cmd run build:web` aprovados.
