import { describe, expect, it } from 'vitest';
import { agentConfigFromInstalled } from './config.js';

describe('installed agent runtime config', () => {
  it('uses the bundled version and maps the assigned Starlink without asking for environment variables', () => {
    const config = agentConfigFromInstalled({
      apiUrl: 'https://healthlink.example',
      credential: 'hla_scoped',
      agentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      unitId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      serverEquipmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      platform: 'windows',
      version: '1.0.0',
      assignments: [{ equipmentId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'Starlink', type: 'starlink', managementAddress: '192.168.100.1' }],
      queuePath: 'C:\\agent\\queue.json',
      dataDir: 'C:\\agent',
      agentPath: 'C:\\agent\\healthlink-agent.cjs',
      configPath: 'C:\\agent\\agent.json',
      pollIntervalMs: 15000,
      timeoutMs: 3000,
    }, '1.2.0');

    expect(config.agentVersion).toBe('1.2.0');
    expect(config.apiToken).toBe('hla_scoped');
    expect(config.equipmentId).toBe('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    expect(config.starlinkHost).toBe('192.168.100.1');
    expect(config.assignments).toHaveLength(1);
  });
});

