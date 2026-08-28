import { describe, expect, it } from 'vitest';
import { canPublishAgentVersion } from './agent-version.js';

describe('agent version artifacts', () => {
  it('accepts Node bundles for both supported platforms', () => {
    expect(canPublishAgentVersion('healthlink-agent-1.1.0.cjs', 'windows')).toBe(true);
    expect(canPublishAgentVersion('healthlink-agent-1.1.0.cjs', 'linux')).toBe(true);
    expect(canPublishAgentVersion('healthlink-agent-1.1.0.js', 'windows')).toBe(true);
    expect(canPublishAgentVersion('healthlink-agent-1.1.0.js', 'linux')).toBe(true);
  });

  it('rejects installers and unrelated files', () => {
    expect(canPublishAgentVersion('healthlink-agent-linux.ps1', 'linux')).toBe(false);
    expect(canPublishAgentVersion('healthlink-agent-linux.sh', 'linux')).toBe(false);
    expect(canPublishAgentVersion('healthlink-agent-linux.zip', 'linux')).toBe(false);
  });
});
