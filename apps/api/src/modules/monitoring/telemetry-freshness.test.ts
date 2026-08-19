import { describe, expect, it } from 'vitest';
import { isTelemetryStale, telemetryStaleAfterMs } from './telemetry-freshness.js';

describe('telemetry freshness policy', () => {
  it('allows the Zabbix item interval to age without flickering the card', () => {
    expect(telemetryStaleAfterMs('zabbix_item_fast_sync')).toBe(90_000);
    expect(isTelemetryStale(new Date(Date.now() - 45_000).toISOString(), 'zabbix_item_fast_sync')).toBe(false);
  });

  it('keeps the local Starlink agent on the shorter freshness window', () => {
    expect(telemetryStaleAfterMs('starlink_local_agent')).toBe(30_000);
    expect(isTelemetryStale(new Date(Date.now() - 31_000).toISOString(), 'starlink_local_agent')).toBe(true);
  });
});
