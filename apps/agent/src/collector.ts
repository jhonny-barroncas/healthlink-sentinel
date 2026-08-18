import type { AgentConfig } from './config.js';
import { EitolStarlinkClient } from './starlink-client.js';

export type TelemetryBatch = {
  equipmentId: string;
  source: 'local_agent';
  batchId: string;
  observedAt: string;
  payload: Record<string, number>;
};

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function put(payload: Record<string, number>, key: string, value: unknown): void {
  if (finite(value)) payload[key] = value;
}

function countAlerts(alerts: Record<string, unknown> | undefined): number | undefined {
  if (!alerts) return undefined;
  const values = Object.values(alerts).filter((value) => typeof value === 'boolean');
  return values.length ? values.filter(Boolean).length : undefined;
}

export async function collectStarlink(config: AgentConfig): Promise<TelemetryBatch> {
  const dish = new EitolStarlinkClient(config);
  try {
    const [statusResult, transceiverResult, locationResult] = await Promise.allSettled([
      dish.getStatus(),
      dish.getTransceiverStatus(),
      dish.getLocation(),
    ]);
    if (statusResult.status === 'rejected') throw statusResult.reason;
    const status = statusResult.value;
    const payload: Record<string, number> = {};
    put(payload, 'latencyMs', finite(status.popPingLatencyMs) && status.popPingLatencyMs >= 0 ? status.popPingLatencyMs : undefined);
    put(payload, 'lossPct', finite(status.popPingDropRate) ? status.popPingDropRate * 100 : undefined);
    put(payload, 'downloadBps', status.downlinkThroughputBps);
    put(payload, 'uploadBps', status.uplinkThroughputBps);
    put(payload, 'snr', status.snr);
    put(payload, 'obstructionPct', finite(status.obstructionStats?.fractionObstructed) ? status.obstructionStats.fractionObstructed * 100 : undefined);
    put(payload, 'alertsActive', countAlerts(status.alerts as unknown as Record<string, unknown> | undefined));
    const state = String(status.state ?? '');
    put(payload, 'coverageAvailable', state === '1' || state === 'CONNECTED' ? 1 : ['2', '3', 'SEARCHING', 'BOOTING'].includes(state) ? 0 : undefined);
    if (transceiverResult.status === 'fulfilled') put(payload, 'temperatureC', transceiverResult.value.modemAsicTemp);
    if (locationResult.status === 'fulfilled' && locationResult.value.lla) {
      put(payload, 'latitude', locationResult.value.lla.lat);
      put(payload, 'longitude', locationResult.value.lla.lon);
    }
    if (!Object.keys(payload).length) throw new Error('A Starlink respondeu sem métricas numéricas reconhecidas.');
    return { equipmentId: config.equipmentId, source: 'local_agent', batchId: crypto.randomUUID(), observedAt: new Date().toISOString(), payload };
  } finally {
    dish.close();
  }
}
