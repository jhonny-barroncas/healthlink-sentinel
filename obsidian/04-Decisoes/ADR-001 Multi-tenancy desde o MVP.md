---
type: adr
status: accepted
date: 2026-08-05
---

# ADR-001 — Multi-tenancy desde o MVP

## Contexto

A documentação exige preparação para multi-tenant e prevê multi-clientes na fase Enterprise.

## Decisão

O MVP terá isolamento real por cliente já na fundação: `tenant_id`, contexto de requisição e Row-Level Security. A interface pode inicialmente operar em um único cliente por sessão.

## Consequência

Evita migração estrutural e risco de vazamento de dados quando a operação multi-cliente for exposta.
