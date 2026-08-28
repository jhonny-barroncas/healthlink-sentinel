import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkForAgentUpdate, finalizeAgentUpdate, isNewerVersion, previousAgentPath } from './agent-updater.js';

describe('agent updater', () => {
  it('detects a strictly newer semantic version', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(false);
  });

  it('downloads only the restricted platform release and atomically replaces the agent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-updater-test-'));
    const agentPath = join(directory, 'healthlink-agent.cjs');
    const configPath = join(directory, 'agent.json');
    await writeFile(agentPath, 'old-version');
    await writeFile(configPath, JSON.stringify({ version: '1.0.0', other: 'preserved' }));
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

    const updated = await checkForAgentUpdate({ platform: 'linux', agentVersion: '1.0.0', agentPath, configPath, apiUrl: 'https://healthlink.example', timeoutMs: 3000, agentId: 'agent-id' }, client);

    expect(updated).toBe(true);
    expect(await readFile(agentPath, 'utf8')).toBe('new-version');
    expect(await readFile(previousAgentPath(agentPath), 'utf8')).toBe('old-version');
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({ version: '1.1.0', other: 'preserved' });
    expect(requested).toEqual([
      'https://healthlink.example/v1/collection-agents/releases',
      'https://healthlink.example/v1/collection-agents/releases/release-id/download',
    ]);
  });

  it('ignores installer placeholders and downloads the newest executable bundle', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-updater-filter-test-'));
    const agentPath = join(directory, 'healthlink-agent.cjs');
    await writeFile(agentPath, 'old-version');
    const artifact = Buffer.from('new-executable-version');
    const checksum = createHash('sha256').update(artifact).digest('hex');
    const requested: string[] = [];
    const client = {
      async fetch(url: string) {
        requested.push(url);
        if (url.endsWith('/releases')) return new Response(JSON.stringify([
          { id: 'placeholder-id', version: '9.0.0', platform: 'linux', file_name: 'healthlink-agent-9.0.0.sh', checksum_sha256: '0'.repeat(64), active: true },
          { id: 'bundle-id', version: '1.2.0', platform: 'linux', file_name: 'healthlink-agent-1.2.0.cjs', checksum_sha256: checksum, active: true },
        ]), { status: 200 });
        return new Response(artifact, { status: 200 });
      },
    };

    await checkForAgentUpdate({ platform: 'linux', agentVersion: '1.0.0', agentPath, apiUrl: 'https://healthlink.example', timeoutMs: 3000, agentId: 'agent-id' }, client);

    expect(requested.at(-1)).toBe('https://healthlink.example/v1/collection-agents/releases/bundle-id/download');
  });

  it('removes the transient previous bundle after a healthy startup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-updater-finalize-test-'));
    const agentPath = join(directory, 'healthlink-agent.cjs');
    await writeFile(previousAgentPath(agentPath), 'old-version');

    await finalizeAgentUpdate(agentPath);

    await expect(readFile(previousAgentPath(agentPath), 'utf8')).rejects.toThrow();
  });
});
