import { describe, expect, it } from 'vitest';
import { agentRuntimeStatus, validateEnrollment } from './lifecycle.js';
import { hashAgentSecret } from './provisioning.js';

const now = new Date('2026-08-20T12:00:00.000Z');

describe('agent enrollment lifecycle', () => {
  it('accepts a valid secret once and rejects wrong, expired, consumed or revoked enrollments', () => {
    const active = {
      tokenHash: hashAgentSecret('segredo-correto'),
      expiresAt: '2026-08-20T12:30:00.000Z',
      consumedAt: null,
      revokedAt: null,
    };
    expect(validateEnrollment(active, 'segredo-correto', now)).toEqual({ valid: true });
    expect(validateEnrollment(active, 'segredo-errado', now)).toEqual({ valid: false, reason: 'invalid' });
    expect(validateEnrollment({ ...active, expiresAt: '2026-08-20T11:59:59.000Z' }, 'segredo-correto', now)).toEqual({ valid: false, reason: 'expired' });
    expect(validateEnrollment({ ...active, consumedAt: '2026-08-20T11:50:00.000Z' }, 'segredo-correto', now)).toEqual({ valid: false, reason: 'consumed' });
    expect(validateEnrollment({ ...active, revokedAt: '2026-08-20T11:55:00.000Z' }, 'segredo-correto', now)).toEqual({ valid: false, reason: 'revoked' });
  });

  it('distinguishes pending, running, stopped, revoked and absent agents', () => {
    expect(agentRuntimeStatus(null, now)).toBe('unlinked');
    expect(agentRuntimeStatus({ status: 'pending', lastHeartbeatAt: null }, now)).toBe('pending');
    expect(agentRuntimeStatus({ status: 'active', lastHeartbeatAt: '2026-08-20T11:59:40.000Z' }, now)).toBe('online');
    expect(agentRuntimeStatus({ status: 'active', lastHeartbeatAt: '2026-08-20T11:59:29.000Z' }, now)).toBe('offline');
    expect(agentRuntimeStatus({ status: 'revoked', lastHeartbeatAt: '2026-08-20T11:59:59.000Z' }, now)).toBe('offline');
  });
});

