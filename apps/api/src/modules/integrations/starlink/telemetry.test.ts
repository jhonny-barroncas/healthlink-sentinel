import { describe, expect, it } from 'vitest';
import { deriveStarlinkStatus, normalizeStarlinkPayload } from './telemetry.js';

describe('Starlink telemetry normalization', () => {
  it('preserves only recognized finite fields', () => {
    const samples = normalizeStarlinkPayload({ latencyMs: 42, downloadBps: 1000, unknown: 9, uploadBps: 'x' });
    expect(samples.map((sample) => sample.metricKey)).toEqual(['starlink.latency.ms', 'starlink.download.bps']);
  });

  it('derives degraded status from loss without fabricating values', () => {
    const samples = normalizeStarlinkPayload({ lossPct: 12 });
    expect(deriveStarlinkStatus(samples)).toBe('degraded');
  });
});
