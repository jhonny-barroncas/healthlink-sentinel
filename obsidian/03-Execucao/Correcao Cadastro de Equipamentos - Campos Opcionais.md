---
type: implementation-fix
project: HealthLink Sentinel
updated: 2026-08-13
---

# Correção do cadastro de equipamentos

O número de série, endereço de gerenciamento e banda contratada continuam opcionais. A migration `009_equipment_optional_serial.sql` remove a unicidade que tratava valores nulos como iguais e cria índice único somente para serial preenchido.

Falhas de cadastro agora são apresentadas em toast operacional e no alerta da tela. Serial já utilizado recebe mensagem orientativa; campos vazios são normalizados para `NULL` no backend.

## Aplicação

A migration foi aplicada no PostgreSQL local em 2026-08-13 e o índice parcial `equipment_tenant_serial_number_unique_idx` foi confirmado. Múltiplos equipamentos sem serial agora são aceitos; serial preenchido continua único por tenant.
