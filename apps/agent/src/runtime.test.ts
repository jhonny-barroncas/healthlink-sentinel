import { describe, expect, it } from 'vitest';
import { starlinkTargets } from './runtime.js';
import type { AgentConfig } from './config.js';

const base: AgentConfig = {
  apiUrl: 'https://healthlink.example', apiToken: 'hla', equipmentId: 'server', starlinkHost: '192.168.100.1', starlinkPort: 9200,
  pollIntervalMs: 15000, timeoutMs: 3000, queuePath: 'queue.json', platform: 'linux', agentVersion: '1.0.0', agentPath: 'agent.cjs', assignments: [],
};

describe('collection targets', () => {
  it('keeps a MikroTik-only agent alive without inventing a Starlink target', () => {
    expect(starlinkTargets({ ...base, assignments: [{ equipmentId: 'mikrotik', name: 'MikroTik', type: 'mikrotik', managementAddress: '192.168.88.1' }] })).toEqual([]);
  });

  it('creates one isolated collection target per assigned Starlink', () => {
    const targets = starlinkTargets({ ...base, assignments: [
      { equipmentId: 'dish-1', name: 'Starlink 1', type: 'starlink', managementAddress: null },
      { equipmentId: 'dish-2', name: 'Starlink 2', type: 'starlink', managementAddress: '192.168.101.1' },
    ] });
    expect(targets.map((item) => ({ equipmentId: item.equipmentId, host: item.starlinkHost, queue: item.queuePath }))).toEqual([
      { equipmentId: 'dish-1', host: '192.168.100.1', queue: 'queue-dish-1.json' },
      { equipmentId: 'dish-2', host: '192.168.101.1', queue: 'queue-dish-2.json' },
    ]);
  });
});

