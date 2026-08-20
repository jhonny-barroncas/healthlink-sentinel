import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderLinuxInstaller, renderWindowsInstaller } from './installers.js';

const artifact = Buffer.from('collector-real-1.0.0');
const options = {
  apiUrl: 'https://healthlink.example:5174',
  enrollmentToken: 'hle_token-temporario',
  artifact,
  artifactChecksum: createHash('sha256').update(artifact).digest('hex'),
  version: '1.0.0',
  unitCode: 'UM-01',
};

describe('single-file agent installers', () => {
  it('executes the Windows validation mode without elevation, prompts or filesystem changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'healthlink-installer-test-'));
    const scriptPath = join(directory, 'installer.ps1');
    await writeFile(scriptPath, renderWindowsInstaller(options), 'utf8');
    const output = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      encoding: 'utf8',
      env: { ...process.env, HEALTHLINK_INSTALLER_TEST_MODE: '1' },
    }).trim();
    expect(JSON.parse(output)).toEqual({
      platform: 'windows', version: '1.0.0', unitCode: 'UM-01', checksum: options.artifactChecksum,
      service: 'HealthLinkSentinelAgent', interactive: false,
    });
  });

  it('renders a Linux bootstrap with embedded artifact, enrollment and supervised restart', () => {
    const script = renderLinuxInstaller(options);
    expect(script).toContain(artifact.toString('base64'));
    expect(script).toContain(Buffer.from(options.enrollmentToken).toString('base64'));
    expect(script).toContain('systemctl enable --now healthlink-agent.service');
    expect(script).toContain('Restart=always');
    expect(script).toContain('printenv HEALTHLINK_INSTALLER_TEST_MODE');
    expect(script).not.toContain('[ "$HEALTHLINK_INSTALLER_TEST_MODE" = "1" ]');
    expect(script).not.toContain('read -p');
  });
});
