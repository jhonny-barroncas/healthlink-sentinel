import { describe, expect, it } from 'vitest';
import { agentStatusFromObservedAt, agentStatusLabel } from './agent-status';

describe('agent status projection', () => {
  it('marks a recent heartbeat as running', () => {
    expect(agentStatusFromObservedAt('2026-08-19T12:00:00.000Z', Date.parse('2026-08-19T12:00:20.000Z'))).toBe('online');
  });

  it('marks an expired heartbeat as stopped', () => {
    expect(agentStatusFromObservedAt('2026-08-19T12:00:00.000Z', Date.parse('2026-08-19T12:00:31.000Z'))).toBe('offline');
  });

  it('distinguishes an unlinked mobile unit', () => {
    expect(agentStatusFromObservedAt(null)).toBe('unlinked');
    expect(agentStatusLabel('unlinked')).toBe('Sem agente vinculado');
  });
});
