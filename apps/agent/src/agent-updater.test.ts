import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkForAgentUpdate, isNewerVersion } from './agent-updater.js';

describe('agent updater', () => {
  it('detects a strictly newer semantic version', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(false);
  });

  it('downloads only the restricted platform release and atomically replaces the agent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-updater-test-'));
    const agentPath = join(directory, 'healthlink-agent.cjs');
    await writeFile(agentPath, 'old-version');
    const artifact = Buffer.from('new-version');
    const checksum = createHash('sha256').update(artifact).digest('hex');
    const requested: string[] = [];
    const client = {
      async fetch(url: string) {
        requested.push(url);
        if (url.endsWith('/releases')) return new Response(JSON.stringify([{ id: 'release-id', version: '1.1.0', platform: 'linux', file_name: 'agent.cjs', checksum_sha256: checksum, active: true }]), { status: 200 });
        return new Response(artifact, { status: 200 });
      },
    };

    const updated = await checkForAgentUpdate({ platform: 'linux', agentVersion: '1.0.0', agentPath, apiUrl: 'https://healthlink.example', timeoutMs: 3000, agentId: 'agent-id' }, client);

    expect(updated).toBe(true);
    expect(await readFile(agentPath, 'utf8')).toBe('new-version');
    expect(requested).toEqual([
      'https://healthlink.example/v1/collection-agents/releases',
      'https://healthlink.example/v1/collection-agents/releases/release-id/download',
    ]);
  });
});
