import { describe, expect, it } from 'vitest';
import { isNewerVersion } from './agent-updater.js';

describe('agent updater', () => {
  it('detects a strictly newer semantic version', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(false);
  });
});
