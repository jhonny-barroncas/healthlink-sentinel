---
type: implementation
updated: 2026-08-10
module: user-forms-and-host-status-popups
---

# Formulário de Usuários e Alertas Pop-up Host UP/DOWN

Data: 2026-08-10

## Implementado

### 1. Pop-ups de Alerta em Tempo Real (Host UP / Host DOWN)
- Adicionada verificação contínua de telemetria a cada 15s (`fetchInventory`).
- Criado hook de detecção de mudança de estado por unidade e host (`prevUnitsRef`).
- Quando uma unidade/host muda para **offline/degraded**:
  - Pop-up Toast **🔴 HOST DOWN**: *"A unidade UT-01 (Maranhão) ficou indisponível (era operacional)!"*
  - Notificação do tipo `error`, flutuante, fixada (`sticky`).
- Quando uma unidade/host volta para **online**:
  - Pop-up Toast **🟢 HOST UP**: *"A unidade UT-01 (Maranhão) restabeleceu sinal e está Operacional!"*
  - Notificação do tipo `success`.
- Monitoramento também aplicado à saúde da integração Zabbix (**🔴 ZABBIX DOWN** / **🟢 ZABBIX UP**).

### 2. Validação e Layout do Formulário de Usuários (baseado na imagem informada)
- Layout em 2 colunas (`.user-form-grid`) para cadastro de identidades.
- Campos organizados:
  1. **Nome completo \*** (placeholder: `Ex.: Nome`, erro: `Informe o nome completo.`)
  2. **E-mail \*** (placeholder: `nome@empresa.com`, erro: `Informe o e-mail.`)
  3. **CPF \*** (placeholder: `000.000.000-00`, erro: `Informe o CPF.`)
  4. **Perfil \*** (`Administrador`, `Supervisor`, `Operador NOC`, `Visualizador`, erro: `Selecione o perfil.`)
  5. **Coligada \*** (`HealthLink Sentinel (Matriz)`, `Filial 01`, erro: `Selecione uma coligada.`)
  6. **Status \*** (`Ativo`, `Bloqueado`)
- Validação em tempo real e no submit: bordas em vermelho vibrante (`.field-invalid`), mensagem textual explicativa em vermelho abaixo de cada campo (`.field-error-text`).
- Banner informativo ao fundo do card: `ⓘ Senha enviada por e-mail: A senha inicial será criada automaticamente e enviada para o e-mail informado. Ela não é exibida neste formulário.`

## Validação

- `npm.cmd run typecheck` — aprovado (0 erros).
- `npm.cmd run build:web` — aprovado (build em 2.29s).
