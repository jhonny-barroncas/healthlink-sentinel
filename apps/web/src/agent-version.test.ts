import { describe, expect, it } from 'vitest';
import { canPublishAgentVersion } from './agent-version.js';

describe('agent version artifacts', () => {
  it('accepts Windows installers only for Windows', () => {
    expect(canPublishAgentVersion('healthlink-agent.exe', 'windows')).toBe(true);
    expect(canPublishAgentVersion('healthlink-agent.exe', 'linux')).toBe(false);
  });

  it('accepts non-Windows binaries for Linux', () => {
    expect(canPublishAgentVersion('healthlink-agent-linux', 'linux')).toBe(true);
  });
});
