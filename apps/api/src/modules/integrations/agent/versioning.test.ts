import { describe, expect, it } from 'vitest';
import { nextAgentVersion, extractEmbeddedAgentVersion } from './versioning.js';

describe('agent versioning', () => {
  it('increments the patch number from the latest published version', () => {
    expect(nextAgentVersion(['1.0.0', '1.2.9', '1.10.0'])).toBe('1.10.1');
  });

  it('starts at 1.0.0 when no release exists', () => {
    expect(nextAgentVersion([])).toBe('1.0.0');
  });

  it('reads the embedded version from a generated agent bundle', () => {
    expect(extractEmbeddedAgentVersion(Buffer.from('... HealthLink Sentinel Agent v2.3.4 ...'))).toBe('2.3.4');
  });
});
