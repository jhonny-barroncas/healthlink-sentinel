import { describe, expect, it } from 'vitest';
import {
  isCollectionAgentHeartbeatExpired,
  persistCollectionAgentOffline,
  resolveCollectionAgentOffline,
} from './heartbeat-incidents.js';

describe('collection agent heartbeat incidents', () => {
  it('expires a heartbeat only after the 30-second operational threshold', () => {
    const now = new Date('2026-09-02T14:31:39.000Z');

    expect(isCollectionAgentHeartbeatExpired('2026-09-02T14:31:09.000Z', now)).toBe(false);
    expect(isCollectionAgentHeartbeatExpired('2026-09-02T14:31:08.999Z', now)).toBe(true);
    expect(isCollectionAgentHeartbeatExpired(null, now)).toBe(false);
  });

  it('opens one critical incident when an active agent loses its heartbeat', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      query: async <T>(text: string, values?: unknown[]) => {
        queries.push({ text, values });
        if (text.includes('SELECT id, status FROM alerts')) return { rows: [] as T[] };
        if (text.includes('INSERT INTO alerts')) return { rows: [{ id: 'alert-1' }] as T[] };
        return { rows: [] as T[] };
      },
    };

    await persistCollectionAgentOffline(db, {
      tenantId: 'tenant-1', agentId: 'agent-1', unitId: 'unit-1', serverEquipmentId: 'server-1',
      lastHeartbeatAt: '2026-09-02T14:28:19.000Z', observedAt: '2026-09-02T14:31:39.000Z',
    });

    expect(queries.find((query) => query.text.includes('INSERT INTO alerts'))?.values).toEqual([
      'tenant-1', 'unit-1', 'server-1', 'collection-agent:agent-1:heartbeat-missing',
      'Agente sem comunicação', 4, '2026-09-02T14:31:39.000Z',
      expect.objectContaining({ source: 'collection_agent', agentId: 'agent-1', lastHeartbeatAt: '2026-09-02T14:28:19.000Z' }),
    ]);
    expect(queries.some((query) => query.text.includes('INSERT INTO alert_events'))).toBe(true);
    expect(queries.some((query) => query.text.includes('INSERT INTO monitoring_events'))).toBe(true);
  });

  it('records one recovery when a heartbeat returns after an outage', async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      query: async <T>(text: string, values?: unknown[]) => {
        queries.push({ text, values });
        if (text.includes('SELECT id, severity FROM alerts')) return { rows: [{ id: 'alert-1', severity: 4 }] as T[] };
        return { rows: [] as T[] };
      },
    };

    await resolveCollectionAgentOffline(db, {
      tenantId: 'tenant-1', agentId: 'agent-1', serverEquipmentId: 'server-1', observedAt: '2026-09-02T14:32:08.000Z',
    });

    expect(queries.some((query) => query.text.includes("UPDATE alerts SET status = 'resolved'"))).toBe(true);
    expect(queries.some((query) => query.text.includes("'recovered'"))).toBe(true);
    expect(queries.some((query) => query.text.includes("'recovery'"))).toBe(true);
  });
});
