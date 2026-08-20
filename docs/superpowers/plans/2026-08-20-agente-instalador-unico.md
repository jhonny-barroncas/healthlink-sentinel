# Agente com Instalador Único Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar, baixar e executar uma única vez um instalador Windows/Linux que vincula o servidor à unidade, instala o agente `1.0.0`, mantém heartbeat/coleta e atualiza automaticamente.

**Architecture:** Uma entidade de agente por equipamento servidor recebe assignments de fontes da mesma unidade. A API gera enrollment de uso único e renderiza um bootstrap com o bundle do coletor embutido; após o primeiro uso, o agente opera com credencial opaca restrita e serviço supervisionado por WinSW ou systemd.

**Tech Stack:** TypeScript, Fastify, PostgreSQL/RLS, React/Vite, Vitest, esbuild, PowerShell, Bash, WinSW e systemd.

**Spec:** `docs/superpowers/specs/2026-08-20-agente-instalador-unico-design.md`

## Global Constraints

- Preservar multi-tenancy e validar tenant/unidade/equipamento no backend.
- Não embutir senha de usuário, JWT administrativo ou segredo permanente no instalador.
- O técnico não preenche campos durante a instalação.
- Starlink é o coletor completo da versão 1.0.0; MikroTik/link recebem heartbeat sem métricas fabricadas.
- Preservar visual dark, vidro fosco e missão crítica.
- Usar testes antes de cada mudança de comportamento.

---

### Task 1: Regras puras de elegibilidade e segredo

**Files:**
- Create: `apps/api/src/modules/integrations/agent/provisioning.ts`
- Test: `apps/api/src/modules/integrations/agent/provisioning.test.ts`
- Create: `apps/web/src/agent-provisioning.ts`
- Test: `apps/web/src/agent-provisioning.test.ts`

**Interfaces:**
- Produces: `evaluateAgentRequirements(equipment)`, `createEnrollmentToken(tenantId, enrollmentId)`, `parseEnrollmentToken(token)`, `hashAgentSecret(secret)`.

- [ ] Escrever testes para servidor, fontes permitidas, requisitos ausentes, token parseável e hash sem segredo em texto.
- [ ] Executar os testes e confirmar falha pela ausência dos módulos.
- [ ] Implementar somente as funções puras necessárias.
- [ ] Executar novamente e confirmar sucesso.

### Task 2: Persistência e endpoints restritos do agente

**Files:**
- Create: `apps/api/database/migrations/011_collection_agents.sql`
- Create: `apps/api/src/modules/integrations/agent/routes.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/integrations/starlink/routes.ts`

**Interfaces:**
- Produces: installer, enrollment, config, heartbeat, telemetry, release catalog/download e revogação.
- Consumes: regras e tokens da Task 1.

- [ ] Escrever testes de contrato/repositório para expiração, consumo único, escopo de assignment e heartbeat.
- [ ] Confirmar RED.
- [ ] Criar tabelas com RLS, índices e constraints.
- [ ] Implementar autenticação opaca do agente e rotas sem conceder permissões administrativas.
- [ ] Reusar normalização Starlink na ingestão dedicada.
- [ ] Atualizar projeção `/v1/monitoring/agents` com fallback legado.
- [ ] Executar testes e typecheck.

### Task 3: Bundle real `1.0.0` e runtime do agente

**Files:**
- Create: `scripts/build-agent-release.mjs`
- Create: `apps/agent/src/installed-config.ts`
- Create: `apps/agent/src/agent-client.ts`
- Modify: `apps/agent/src/config.ts`
- Modify: `apps/agent/src/index.ts`
- Modify: `apps/agent/src/starlink-client.ts`
- Modify: `apps/agent/src/agent-updater.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `dist/agent/healthlink-agent-1.0.0.cjs`, comando `enroll` e comando de execução do serviço.

- [ ] Escrever testes para configuração instalada, enrollment não interativo, heartbeat e reinício após update.
- [ ] Confirmar RED.
- [ ] Implementar carregamento seguro da configuração e cliente de agente.
- [ ] Embutir protobufs no bundle via esbuild.
- [ ] Fazer updater consultar rotas restritas e encerrar para restart após troca válida.
- [ ] Gerar bundle e executar smoke test sem credenciais reais.

### Task 4: Geradores Windows e Linux

**Files:**
- Create: `apps/api/src/modules/integrations/agent/installers.ts`
- Test: `apps/api/src/modules/integrations/agent/installers.test.ts`
- Modify: `apps/api/src/modules/integrations/agent/routes.ts`
- Modify: `apps/api/src/platform/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `renderWindowsInstaller(options)` e `renderLinuxInstaller(options)`.

- [ ] Escrever testes garantindo ausência de prompts e presença de checksum, enrollment, caminhos, auto-start e restart.
- [ ] Confirmar RED.
- [ ] Renderizar PowerShell com runtime Node portátil, ACL, WinSW e serviço.
- [ ] Renderizar Bash com runtime Node portátil, usuário dedicado e systemd.
- [ ] Ligar o gerador ao endpoint autenticado e auditar sem segredo.
- [ ] Executar testes e `git diff --check`.

### Task 5: Catálogo inicial e sincronização da versão 1.0.0

**Files:**
- Create: `apps/api/src/modules/integrations/agent/built-in-release.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `Dockerfile`

**Interfaces:**
- Consumes: bundle da Task 3.
- Produces: duas entradas reais `1.0.0`, Windows e Linux, preservando versões publicadas pelo administrador.

- [ ] Escrever teste para substituir somente o launcher placeholder e não sobrescrever publicação real.
- [ ] Confirmar RED.
- [ ] Sincronizar bundle/checksum no startup e build Docker.
- [ ] Confirmar catálogo e download por plataforma.

### Task 6: Modal e download no equipamento servidor

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Consume/Test: `apps/web/src/agent-provisioning.ts` e seu teste.

**Interfaces:**
- Consumes: `POST /v1/units/:unitId/collection-agents/installers`.

- [ ] Escrever teste para requisitos e nome do arquivo baixado.
- [ ] Confirmar RED.
- [ ] Colocar ação em cada servidor e aviso exato quando faltar fonte.
- [ ] Criar modal Windows/Linux com servidor/fontes identificados.
- [ ] Baixar Blob, mostrar validade de 30 minutos e atualizar estado da unidade.
- [ ] Preservar acessibilidade, responsividade e padrão visual.

### Task 7: Documentação e verificação operacional

**Files:**
- Modify: `apps/agent/README.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `obsidian/03-Execucao/Agente - Atualizacao Automatica e Versao 1.0.md`
- Modify: `obsidian/00-Handoff Novo Chat.md`
- Modify: `obsidian/03-Execucao/Estado Atual.md`

- [ ] Documentar execução única Windows/Linux, pré-requisitos de rede e rollback sem segredos.
- [ ] Executar testes relacionados e suíte completa, separando a falha MapLibre preexistente caso permaneça.
- [ ] Executar `npm.cmd run typecheck`, `npm.cmd run build:web` e `npm.cmd run build:agent`.
- [ ] Aplicar migration/rebuild no Docker e validar `/health`, geração, consumo único, heartbeat e restart.
- [ ] Revisar diff, documentação e status Git antes de commit/push.

