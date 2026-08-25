# Reestruturação Visual do HealthLink Sentinel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar uma linguagem visual única e responsiva em todo o frontend do HealthLink Sentinel, com animações operacionais discretas.

**Architecture:** Evoluir o sistema de tokens e estilos globais antes de ajustar telas. Depois aplicar os tokens por áreas funcionais, preservando `App.tsx`, os contratos da API e as permissões; cada lote será validado isoladamente.

**Tech Stack:** React, TypeScript, Vite, CSS customizado, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-25-reestruturacao-visual-design.md`

## Global Constraints

- Preservar dark/glass corporativo e missão crítica.
- Não alterar RBAC, API, banco ou dados operacionais.
- Reutilizar tokens e ícones existentes.
- Respeitar `prefers-reduced-motion`.
- Executar `npm.cmd run typecheck` e `npm.cmd run build:web` ao finalizar cada lote relevante.

### Task 1: Fundação de tokens e movimento

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: `obsidian/00-Handoff Novo Chat.md`
- Modify: `obsidian/03-Execucao/Estado Atual.md`

**Interfaces:**
- Produces: tokens CSS e classes de movimento reutilizáveis pelas telas seguintes.

- [ ] Mapear tokens existentes e criar apenas os tokens ausentes para foco, elevação, movimento e estado.
- [ ] Consolidar keyframes de entrada, expansão, feedback e pulso operacional.
- [ ] Adicionar fallback `prefers-reduced-motion` que reduz transições e desativa movimentos contínuos.
- [ ] Validar typecheck e build web.
- [ ] Atualizar documentação sem registrar segredos.

### Task 2: Shell, navegação e autenticação

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/sidebar-collapse.test.ts`, `apps/web/src/session-expiry.test.ts`

**Interfaces:**
- Consumes: tokens e movimento da Task 1.
- Produces: shell, login, sessão expirada e navegação visualmente consistentes.

- [ ] Ajustar hierarquia do cabeçalho, sidebar e estados de sessão sem alterar rotas.
- [ ] Aplicar feedback de foco, hover, carregamento e erro amigável.
- [ ] Garantir que a navegação compacta e a sessão expirada continuem acessíveis por teclado.
- [ ] Executar os testes dedicados, typecheck e build web.

### Task 3: Centro operacional, mapa e unidades móveis

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/state-map-interactions.test.ts`, `apps/web/src/state-unit-collapse.test.ts`, `apps/web/src/state-map-telemetry.test.ts`

**Interfaces:**
- Consumes: tokens e componentes do shell.
- Produces: cards de unidade, mapa, expansão, telemetria e menu contextual com hierarquia visual uniforme.

- [ ] Melhorar leitura dos indicadores e filtros por perfil sem alterar o recorte da API.
- [ ] Aplicar expansão suave do card da unidade e entrada do painel lateral.
- [ ] Diferenciar visualmente agente online, offline, não vinculado e unidade sem telemetria.
- [ ] Preservar todos os links/equipamentos da unidade e ações contextuais existentes.
- [ ] Executar os testes dedicados, typecheck e build web.

### Task 4: Inventário, agentes, integração, alertas e relatórios

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Test: testes existentes dos módulos afetados.

**Interfaces:**
- Consumes: foundation visual e estados operacionais.
- Produces: telas técnicas com densidade controlada, feedback de sincronização e estados vazios consistentes.

- [ ] Padronizar tabelas/listas de equipamentos, agentes e hosts.
- [ ] Padronizar alertas, relatórios, estados vazios e ações de sincronização.
- [ ] Adicionar movimento somente onde comunica mudança de estado ou relação de causa/efeito.
- [ ] Executar testes, typecheck e build web.

### Task 5: Usuários, formulários e modais

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/form-modal.css`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/user-form.test.ts`, `apps/web/src/user-modal-layout.test.ts`, `apps/web/src/form-modal-layout.test.ts`

**Interfaces:**
- Consumes: tokens, estados e regras de formulário existentes.
- Produces: modais sem rolagem inesperada, campos com foco/erro/sucesso consistentes e ações claras por perfil.

- [ ] Padronizar campos obrigatórios, dicas, erros amigáveis e ações destrutivas.
- [ ] Garantir que dropdowns sejam a única área com rolagem quando necessário.
- [ ] Preservar limites de senha, validação de e-mail e proteção contra SQL injection via API parametrizada.
- [ ] Executar testes, typecheck, build web e validação Docker.
