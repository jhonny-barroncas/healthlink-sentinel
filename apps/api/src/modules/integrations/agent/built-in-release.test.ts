import { describe, expect, it } from 'vitest';
import { builtInReleaseFileName, shouldReplaceBuiltInRelease } from './built-in-release.js';

describe('built-in agent release synchronization', () => {
  it('replaces only the seeded launcher and preserves an administrator publication', () => {
    expect(shouldReplaceBuiltInRelease({ version: '1.0.0', fileName: 'healthlink-agent-1.0.0.sh' })).toBe(true);
    expect(shouldReplaceBuiltInRelease({ version: '1.0.0', fileName: 'healthlink-agent-1.0.0.ps1' })).toBe(true);
    expect(shouldReplaceBuiltInRelease({ version: '1.0.0', fileName: 'meu-agente-homologado.cjs' })).toBe(false);
    expect(shouldReplaceBuiltInRelease({ version: '1.1.0', fileName: 'healthlink-agent-1.0.0.sh' })).toBe(false);
  });

  it('uses distinct catalog names for Windows and Linux', () => {
    expect(builtInReleaseFileName('windows')).toBe('healthlink-agent-1.0.0-windows.cjs');
    expect(builtInReleaseFileName('linux')).toBe('healthlink-agent-1.0.0-linux.cjs');
  });
});

