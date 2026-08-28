# Fluxo confiável de distribuição e atualização do agente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer Windows/Linux receberem instaladores derivados de bundles válidos e fazer o runtime aplicar sempre a maior versão compatível, removendo o backup após sucesso.

**Architecture:** A API continuará armazenando releases por tenant/plataforma, mas a fronteira de bundle executável aceitará somente `.cjs`/`.js`; os instaladores `.ps1`/`.sh` serão gerados a partir dessa release. O runtime filtrará releases inválidas, atualizará o arquivo de configuração atomicamente e limpará o backup somente após o ciclo inicial saudável.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Node.js, esbuild, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-28-agent-distribution-design.md`

## Global Constraints

- Manter isolamento multi-tenant e plataforma Windows/Linux.
- Não registrar senhas, tokens ou segredos em código, testes ou documentação.
- Aceitar bundles de runtime `.cjs` e `.js`; rejeitar instaladores `.ps1` e `.sh` como releases do motor.
- Executar `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build:agent`, `npm.cmd run build:web` e validação Docker.

### Task 1: Corrigir seleção e publicação da release executável

**Files:**
- Modify: `apps/api/src/modules/integrations/agent/routes.ts`
- Modify: `apps/api/src/modules/integrations/zabbix/routes.ts`
- Modify: `apps/api/src/modules/integrations/agent/versioning.ts`
- Test: `apps/api/src/modules/integrations/agent/versioning.test.ts`
- Test: `apps/api/src/modules/integrations/agent/provisioning.test.ts`

- [x] **Step 1: Write failing tests** para ordenar versões semânticas fora de ordem e rejeitar nomes de instalador no provisionamento.
- [x] **Step 2: Run focused tests** com `npm.cmd test -- apps/api/src/modules/integrations/agent/versioning.test.ts apps/api/src/modules/integrations/agent/provisioning.test.ts` e confirmar falha reproduzível.
- [x] **Step 3: Implement minimal filtering/selection** para usar somente release ativa da plataforma cujo arquivo seja `.cjs`/`.js`, escolhendo a maior semver.
- [x] **Step 4: Run focused tests** novamente e confirmar aprovação.

### Task 2: Validar geração dos instaladores Windows/Linux

**Files:**
- Modify: `apps/api/src/modules/integrations/agent/installers.ts`
- Test: `apps/api/src/modules/integrations/agent/installers.test.ts`

- [x] **Step 1: Write failing tests** verificando que ambos os instaladores carregam a versão e checksum do bundle selecionado e não aceitam placeholder.
- [x] **Step 2: Run installer tests** e confirmar falha pela ausência da validação.
- [x] **Step 3: Implement validation** antes da geração e preservar comandos de instalação específicos por plataforma.
- [x] **Step 4: Run installer tests** novamente e confirmar aprovação.

### Task 3: Tornar a atualização do runtime segura e curta

**Files:**
- Modify: `apps/agent/src/agent-updater.ts`
- Modify: `apps/agent/src/index.ts`
- Test: `apps/agent/src/agent-updater.test.ts`
- Test: `apps/agent/src/startup-version.test.ts`

- [x] **Step 1: Write failing tests** para selecionar a maior release válida, não atualizar com `.ps1/.sh`, e remover `.previous` após sucesso.
- [x] **Step 2: Run agent tests** e confirmar falha pela retenção/seleção atual.
- [x] **Step 3: Implement minimal runtime changes** com filtro de artefato, persistência de versão, troca atômica e limpeza pós-startup.
- [x] **Step 4: Run agent tests** novamente e confirmar aprovação.

### Task 4: Sincronizar a versão embutida no build e no Docker

**Files:**
- Modify: `scripts/build-agent-release.mjs`
- Modify: `apps/api/src/modules/integrations/agent/built-in-release.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/integrations/agent/built-in-release.test.ts`
- Modify: `obsidian/00-Handoff Novo Chat.md`
- Modify: `obsidian/03-Execucao/Estado Atual.md`

- [x] **Step 1: Update tests** para a versão embutida vigente e verificar que o nome produzido pelo build é o mesmo consumido pela API.
- [x] **Step 2: Run targeted built-in tests** e confirmar falha se houver divergência.
- [x] **Step 3: Implement version synchronization** mantendo releases administrativas intactas.
- [x] **Step 4: Run targeted tests** novamente e confirmar aprovação.

### Task 5: Verificação final e entrega

- [x] **Step 1:** Run `npm.cmd test`.
- [x] **Step 2:** Run `npm.cmd run typecheck`.
- [x] **Step 3:** Run `npm.cmd run build:agent` and verify the generated version marker.
- [x] **Step 4:** Run `npm.cmd run build:web`.
- [x] **Step 5:** Run `docker compose up -d --build`, inspect `docker compose ps`, and query `/health`.
- [x] **Step 6:** Inspect diff/status and commit the implementation locally on `dev`.
