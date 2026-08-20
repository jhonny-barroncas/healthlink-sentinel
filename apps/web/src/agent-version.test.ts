import { describe, expect, it } from 'vitest';
import { canPublishAgentVersion } from './agent-version.js';

describe('agent version artifacts', () => {
  it('accepts Windows installers only for Windows', () => {
    expect(canPublishAgentVersion('healthlink-agent-1.1.0.cjs', 'windows')).toBe(true);
    expect(canPublishAgentVersion('healthlink-agent-1.1.0.cjs', 'linux')).toBe(true);
  });

  it('accepts non-Windows binaries for Linux', () => {
    expect(canPublishAgentVersion('healthlink-agent-linux.ps1', 'linux')).toBe(false);
  });
});
