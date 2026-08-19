---
type: implementation-fix
project: HealthLink Sentinel
updated: 2026-08-19
---

# Correção do cadastro de equipamentos

O número de série, endereço de gerenciamento e banda contratada continuam opcionais. A migration `009_equipment_optional_serial.sql` remove a unicidade que tratava valores nulos como iguais e cria índice único somente para serial preenchido.

Falhas de cadastro agora são apresentadas em toast operacional e no alerta da tela. Serial já utilizado recebe mensagem orientativa; campos vazios são normalizados para `NULL` no backend.

## Aplicação

A migration foi aplicada no PostgreSQL local em 2026-08-13 e o índice parcial `equipment_tenant_serial_number_unique_idx` foi confirmado. Múltiplos equipamentos sem serial agora são aceitos; serial preenchido continua único por tenant.

## Ajuste visual do modal

Em 2026-08-19, o modal desktop de novo equipamento foi ajustado para não criar uma barra de rolagem interna quando o seletor de tipo é aberto. O card deixa o dropdown absoluto ultrapassar visualmente seus limites, aproveitando o espaço livre da tela. A regra é restrita a larguras acima de 700 px; em telas menores, a rolagem permanece como proteção contra corte de conteúdo.

Um teste de regressão em `apps/web/src/form-modal-layout.test.ts` garante que a regra desktop continue usando `max-height: none` e `overflow: visible` no cadastro de equipamento.
