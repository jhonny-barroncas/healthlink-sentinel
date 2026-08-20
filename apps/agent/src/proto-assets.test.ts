import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { materializeEmbeddedProtos } from './proto-assets.js';

describe('embedded Starlink protobuf assets', () => {
  it('materializes only relative proto paths inside the agent data directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-proto-test-'));
    const root = await materializeEmbeddedProtos(directory, {
      'spacex/api/device/device.proto': 'syntax = "proto3";',
      '../escape.proto': 'forbidden',
    });
    expect(await readFile(join(root, 'spacex/api/device/device.proto'), 'utf8')).toBe('syntax = "proto3";');
    await expect(readFile(join(directory, 'escape.proto'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

