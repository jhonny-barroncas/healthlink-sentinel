# Especificação: Contextos operacionais e provisionamento do agente Linux

**Data:** 2026-08-19  
**Status:** aguardando aprovação da especificação  
**Produto:** HealthLink Sentinel

## 1. Objetivo

O HealthLink Sentinel atende dois públicos operacionais dentro do mesmo tenant:

1. a equipe de infraestrutura, que precisa acompanhar toda a operação;
2. a equipe responsável pelas unidades móveis, que deve trabalhar somente com suas unidades, equipamentos, links, alertas e indicadores.

O produto deve separar a experiência visual e o acesso aos dados sem duplicar o cadastro das entidades. Uma unidade será o contêiner operacional: seus equipamentos e links pertencem visualmente à unidade e não aparecerão como pontos independentes no mapa principal.

O mesmo desenho prepara a integração do agente local, principalmente em Linux, sem exigir que o técnico conheça IDs internos, tokens de usuário ou detalhes do banco de dados.

## 2. Decisões confirmadas

- Será mantido um único tenant e uma única base operacional.
- Cada unidade terá um contexto operacional explícito: `infrastructure` ou `mobile`.
- Haverá dois painéis: **Infraestrutura** e **Unidades móveis**.
- Usuários móveis poderão cadastrar e editar unidades móveis e seus equipamentos, respeitando o escopo móvel.
- Usuários de infraestrutura terão visão operacional completa, incluindo unidades móveis e de infraestrutura.
- Equipamentos, links, status e telemetria serão consultados dentro do contexto da unidade.
- O mapa principal mostrará somente um marcador por unidade.
- O agente será identificado por unidade e poderá atender vários equipamentos daquela unidade.
- O provisionamento primário será para distribuições Linux com `systemd`; Windows fica para uma etapa posterior.
- A credencial do agente será diferente de uma credencial ampla de usuário ou de integração administrativa.

## 3. Modelo de domínio e escopo de acesso

### 3.1 Contexto da unidade

Adicionar a `health_units` um campo obrigatório `operational_context`, com os valores:

- `infrastructure`: sede, datacenter, servidores, links corporativos, elementos de rede e demais ativos de infraestrutura;
- `mobile`: carreta da mulher, unidade móvel e demais estruturas móveis acompanhadas pelo projeto.

O campo não deve ser inferido pelo nome, cidade ou tipo de equipamento em produção. A migração deve classificar explicitamente os dados existentes. O comportamento seguro para registros ainda não classificados é mantê-los no contexto de infraestrutura, tornando-os invisíveis para o escopo móvel até que um administrador os revise.

Equipamentos e telemetrias continuam relacionados à unidade por `unit_id`. Não será criado um segundo cadastro para a visão móvel.

### 3.2 Papéis

Adicionar o papel `mobile_operator` para usuários que operam unidades móveis. Esse papel terá, no mínimo:

- leitura e gerenciamento de unidades dentro de `operational_context = mobile`;
- leitura e gerenciamento dos equipamentos pertencentes a essas unidades;
- leitura de monitoramento e alertas do mesmo escopo;
- acesso ao painel de unidades móveis;
- nenhum acesso a usuários, integrações administrativas, unidades de infraestrutura ou dados fora do escopo.

Os papéis administrativos e operacionais de infraestrutura existentes continuarão com acesso completo ao tenant, conforme suas permissões atuais. Um usuário de infraestrutura poderá operar a visão móvel quando necessário, mas isso não elimina o painel específico para o público móvel.

A permissão de CRUD será avaliada em duas dimensões:

```text
permissão funcional de gestão (atualmente units.manage para unidades/equipamentos)
        +
contexto permitido pelo papel
        =
autorização efetiva
```

Uma permissão específica para equipamentos poderá ser extraída em uma evolução posterior, mas não é necessária para esta separação de contexto.

Essa regra será aplicada no backend para listagem, detalhe, criação, edição, exclusão, reativação, diagnósticos, telemetria e alertas. O frontend apenas ocultará ações e navegação incompatíveis para melhorar a experiência; ele não será a barreira de segurança.

### 3.3 Regras de escrita

- Um `mobile_operator` só poderá criar uma unidade com contexto `mobile`.
- Um `mobile_operator` só poderá editar ou excluir unidades móveis.
- Equipamentos só poderão ser criados, editados, excluídos ou reativados se a unidade pai estiver dentro do escopo do usuário.
- Não será permitido mover diretamente um equipamento para uma unidade fora do escopo.
- A mudança de contexto de uma unidade será uma operação administrativa, auditada e bloqueada para `mobile_operator`.
- Listagens e agregações devem filtrar o escopo antes de calcular totais, status, contagens e indicadores.

## 4. Experiência dos dois painéis

### 4.1 Painel de infraestrutura

O painel terá como foco o inventário e a saúde geral da operação. Deve incluir unidades de infraestrutura e móveis para usuários autorizados, com filtros por contexto, estado, cidade, tipo de equipamento, severidade e situação de links.

O mapa nacional/estadual usará a unidade como ponto principal. A sede, por exemplo, aparecerá uma única vez mesmo que contenha quatro links de internet, um servidor Zabbix e outros ativos.

### 4.2 Painel de unidades móveis

O painel será pré-filtrado para `operational_context = mobile`. O usuário móvel verá somente suas unidades móveis, como as quatro Carretas da Mulher em Manaus, e os indicadores derivados delas.

Não haverá dependência de um filtro manipulável pelo navegador para esconder infraestrutura. O backend entregará apenas unidades móveis para esse papel.

### 4.3 Encapsulamento no mapa

O comportamento padrão será:

- um marcador por unidade;
- cor e estado do marcador derivados do pior estado relevante entre a unidade, seus equipamentos, links e alertas ativos;
- hover/foco/clique exibindo popover ou painel compacto com nome, localização, estado geral e resumo dos ativos;
- lista agrupada por equipamento, tipo, estado e última atualização;
- links exibidos como itens da unidade, com latência, perda, disponibilidade, velocidade contratada e situação de coleta quando disponíveis;
- equipamentos não conectividade exibidos como ativos da unidade, sem criar novos pontos no mapa;
- clique em um ativo abrindo o detalhe operacional da unidade e permitindo chegar à análise do link/equipamento.

O mapa não deverá desenhar uma linha ou marcador para cada link na visão geral. Uma visão de análise detalhada poderá mostrar topologia ou telemetria específica depois que o usuário abrir a unidade.

Para acessibilidade e telas touch, a mesma informação do hover deverá estar disponível por foco de teclado e clique. O popover deve ser fechado sem perder o estado do mapa.

## 5. Contrato de agregação

O frontend não deve precisar reconstruir o agrupamento a partir de listas independentes. O backend deve fornecer uma projeção operacional por unidade, ou uma resposta equivalente, contendo:

- unidade e seu contexto;
- estado agregado da unidade;
- contagem de equipamentos por tipo e estado;
- links pertencentes à unidade;
- última telemetria por link/equipamento;
- alertas ativos da unidade;
- indicador de coleta/agente, quando aplicável.

As respostas existentes poderão ser mantidas para compatibilidade interna, mas as novas telas devem consumir uma projeção com escopo aplicado no servidor. Consultas de monitoramento, alertas e telemetria devem aceitar o contexto apenas como refinamento autorizado, nunca como mecanismo para ampliar acesso.

## 6. Provisionamento do agente local

### 6.1 Gatilho de provisionamento

Ao criar o primeiro equipamento compatível com coleta local em uma unidade móvel — inicialmente Starlink e os tipos de link que forem habilitados no catálogo — o backend criará ou atualizará um registro de provisionamento pendente para a unidade.

O provisionamento é por unidade, não por equipamento. Assim, uma Carreta da Mulher com Starlink, roteador e outros links terá um único agente local; equipamentos compatíveis adicionados depois serão vinculados ao agente da unidade pela configuração sincronizada.

O cadastro do equipamento deve gerar automaticamente:

- identidade interna do ativo;
- vínculo com a unidade;
- definição de fonte/coletor compatível;
- pendência de instalação do agente, quando necessária;
- parâmetros padrão da fonte, sem expor segredos na interface.

Se a unidade já possuir agente ativo, a criação do novo equipamento apenas adicionará a atribuição pendente à configuração do agente. Não deve exigir uma nova instalação.

### 6.2 Enrollment de uso único

O backend deverá manter entidades de enrollment/instalação com, no mínimo, unidade, tenant, status, hash do código, expiração, uso, revogação, versão do agente, último heartbeat e última coleta.

O código apresentado ao administrador será:

- aleatório e de alta entropia;
- armazenado somente como hash;
- de uso único;
- com expiração curta, inicialmente 30 minutos;
- revogável e regenerável por usuário autorizado;
- auditado sem registrar o valor secreto.

O código não será um token permanente. Após o primeiro uso, o agente trocará o código por uma credencial própria, restrita à unidade e aos equipamentos atribuídos. A resposta com a credencial será exibida somente durante o enrollment e o agente a armazenará localmente.

### 6.3 Fluxo do técnico

O técnico executará um comando de setup no host Linux. O assistente fará perguntas apenas na primeira instalação:

1. URL da API do HealthLink;
2. código de enrollment gerado para a unidade;
3. parâmetros locais que não tenham sido pré-configurados, como endereço/porta de uma fonte Starlink.

Valores padrão serão preenchidos quando forem seguros e conhecidos. O técnico não deverá informar `tenantId`, `equipmentId`, senha de usuário ou token administrativo.

O setup validará a API, consumirá o código uma única vez, receberá a configuração autorizada da unidade, gravará a configuração local e fará um teste de heartbeat/coleta antes de concluir.

Também deverá existir modo não interativo com argumentos ou arquivo temporário seguro para automação, sem imprimir o código ou a credencial nos logs.

### 6.4 Credencial e limites do agente

O agente deverá usar uma credencial específica, com claims ou escopo equivalente a:

- tenant;
- agent/install id;
- unit id;
- equipamentos permitidos;
- operações de heartbeat e ingestão de telemetria.

Essa credencial não poderá criar usuários, alterar unidades, ler dados de outras unidades, administrar integrações ou chamar endpoints gerais de CRUD.

O envelope de telemetria deverá preservar `equipmentId`, `source`, `observedAt`, `batchId` e `payload`, mantendo idempotência por lote. O servidor continuará sendo responsável por validar pertencimento, normalizar métricas, atualizar snapshots e registrar auditoria.

## 7. Inicialização automática no Linux

O alvo principal será Debian/Ubuntu e outras distribuições com `systemd`.

O instalador/configurador deverá:

- exigir privilégio de instalação de forma clara;
- criar um usuário de sistema dedicado, sem shell interativo quando possível;
- instalar o runtime empacotado do agente, sem depender de `tsx` ou de um checkout de desenvolvimento;
- gravar configuração em diretório de sistema, com proprietário restrito e permissão `0600`;
- criar a unidade `healthlink-agent.service`;
- iniciar após `network-online.target`;
- habilitar o serviço para iniciar no boot;
- usar `Restart=on-failure` com intervalo controlado;
- enviar logs ao `journald`, sem segredos;
- retornar status acionável para o técnico.

Operações previstas para a primeira versão operacional:

```text
healthlink-agent setup       # enrollment interativo e instalação
healthlink-agent status      # serviço, heartbeat e última coleta
healthlink-agent restart     # reinício controlado
healthlink-agent uninstall   # remoção explícita do serviço local
```

O painel deverá permitir revogar uma instalação, gerar outro enrollment e acompanhar a versão do agente, último heartbeat, última coleta e motivo de falha. A revogação no servidor deve impedir novas ingestões mesmo que o arquivo local ainda exista.

Windows não faz parte da primeira entrega do instalador automático, mas a separação entre setup, configuração e serviço deve permitir um adaptador posterior.

## 8. Migração e compatibilidade

- Criar migração para tornar o contexto da unidade obrigatório.
- Atualizar seeds e fixtures com classificação explícita.
- Não classificar produção por heurísticas textuais silenciosas.
- Garantir que registros não revisados não apareçam no escopo móvel.
- Manter o agente Starlink existente funcionando durante a transição, com uma camada de compatibilidade até a credencial específica de agente estar disponível.
- Preservar o vínculo canônico `equipment_id`; o agente não deve criar uma identidade paralela para o mesmo equipamento.
- Manter o padrão visual dark, vidro fosco e missão crítica do produto.

## 9. Critérios de aceite

### Acesso e CRUD

- Usuário `mobile_operator` lista somente unidades móveis.
- O mesmo usuário não consegue obter, editar ou excluir unidade de infraestrutura por URL, ID ou payload manipulado.
- O usuário móvel consegue criar e editar unidades móveis e seus equipamentos.
- Usuário de infraestrutura vê os dois contextos e consegue operar os ativos conforme suas permissões.
- Totais, alertas, telemetria e contagens respeitam o mesmo escopo.

### Visualização

- O mapa renderiza um marcador para a unidade, não um marcador por equipamento/link.
- Hover, foco e clique mostram os equipamentos e links agrupados dentro da unidade.
- A sede com quatro links e um servidor aparece como um único ponto.
- O painel móvel mostra apenas as Carretas da Mulher/unidades com contexto móvel autorizadas.
- Um ativo específico continua acessível pelo detalhe da unidade.

### Agente Linux

- Criar o primeiro equipamento compatível gera um enrollment pendente sem intervenção manual adicional de cadastro técnico.
- O técnico conclui a configuração com o código de uso único e os poucos parâmetros locais necessários.
- Uma segunda tentativa com o mesmo código falha.
- A credencial emitida não acessa outra unidade nem endpoints administrativos.
- O serviço inicia após reinicialização, reinicia após falha e grava logs no `journald`.
- O painel mostra instalação, versão, heartbeat, última coleta, revogação e regeneração do enrollment.
- A inclusão de outro equipamento compatível na mesma unidade não exige reinstalação do agente.

## 10. Fora do escopo desta especificação

- Implementação imediata do instalador Windows.
- Redesenho completo do Zabbix ou substituição do adapter existente.
- Exibição de topologia detalhada diretamente no mapa geral.
- Descoberta automática de qualquer equipamento de rede sem configuração local ou contrato de fonte definido.
- Concessão de permissões de administração de usuários ao operador móvel.

## 11. Sequenciamento recomendado para implementação

1. Modelo de contexto, migração, RBAC e testes de autorização.
2. Projeção de monitoramento agrupada por unidade e adaptação dos dois painéis.
3. Mapa com marcador único, popover/detalhe encapsulado e testes de escopo visual.
4. Entidades e endpoints de enrollment/instalação do agente.
5. Credencial restrita, heartbeat e ingestão genérica compatível com Starlink.
6. Setup empacotado e serviço `systemd` para Linux.
7. Observabilidade, documentação operacional e migração dos dados existentes.
