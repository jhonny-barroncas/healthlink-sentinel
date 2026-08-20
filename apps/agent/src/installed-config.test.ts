import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enrollAndSave, loadInstalledAgentConfig } from './installed-config.js';

describe('installed agent configuration', () => {
  it('exchanges enrollment non-interactively and persists only the scoped credential', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-agent-test-'));
    const configPath = join(directory, 'agent.json');
    let requestedToken = '';
    const fetcher: typeof fetch = async (_input, init) => {
      requestedToken = JSON.parse(String(init?.body)).token as string;
      return new Response(JSON.stringify({
        agentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        unitId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        serverEquipmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        platform: 'linux',
        version: '1.0.0',
        credential: 'hla_credential-restrita',
        assignments: [{ equipmentId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', name: 'Starlink UM-01', type: 'starlink', managementAddress: null }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const installed = await enrollAndSave({
      apiUrl: 'https://healthlink.example/',
      enrollmentToken: 'hle_token-uso-unico',
      configPath,
      dataDir: directory,
      agentPath: join(directory, 'healthlink-agent.cjs'),
    }, fetcher);

    expect(requestedToken).toBe('hle_token-uso-unico');
    expect(installed.apiUrl).toBe('https://healthlink.example');
    expect(installed.credential).toBe('hla_credential-restrita');
    expect(installed.queuePath).toBe(join(directory, 'queue.json'));
    expect((await loadInstalledAgentConfig(configPath)).assignments[0].type).toBe('starlink');
    expect(JSON.parse(await readFile(configPath, 'utf8')).enrollmentToken).toBeUndefined();
    if (process.platform !== 'win32') expect((await stat(configPath)).mode & 0o777).toBe(0o600);
  });

  it('fails without writing a credential when the enrollment is rejected', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-agent-test-'));
    const configPath = join(directory, 'agent.json');
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({ message: 'Este instalador já foi utilizado.' }), { status: 401 });
    await expect(enrollAndSave({
      apiUrl: 'https://healthlink.example',
      enrollmentToken: 'hle_consumido',
      configPath,
      dataDir: directory,
      agentPath: join(directory, 'healthlink-agent.cjs'),
    }, fetcher)).rejects.toThrow('Este instalador já foi utilizado.');
    await expect(readFile(configPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

