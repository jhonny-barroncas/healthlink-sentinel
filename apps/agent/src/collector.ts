import { Dishy } from '@gibme/starlink/dishy';
import type { AgentConfig } from './config.js';

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
  const dish = new Dishy({ host: config.starlinkHost, port: config.starlinkPort, timeout: config.timeoutMs });
  try {
    const [statusResult, transceiverResult, locationResult] = await Promise.allSettled([
      dish.fetch_status(),
      dish.fetch_transceiver_status(),
      dish.fetch_location(),
    ]);
    if (statusResult.status === 'rejected') throw statusResult.reason;
    const status = statusResult.value;
    const payload: Record<string, number> = {};
    put(payload, 'latencyMs', status.popPingLatencyMs);
    put(payload, 'lossPct', finite(status.popPingDropRate) ? status.popPingDropRate * 100 : undefined);
    put(payload, 'downloadBps', status.downlinkThroughputBps);
    put(payload, 'uploadBps', status.uplinkThroughputBps);
    put(payload, 'snr', status.snr);
    put(payload, 'obstructionPct', finite(status.obstructionStats?.fractionObstructed) ? status.obstructionStats.fractionObstructed * 100 : undefined);
    put(payload, 'alertsActive', countAlerts(status.alerts as unknown as Record<string, unknown> | undefined));
    put(payload, 'coverageAvailable', status.state === 1 ? 1 : status.state === 2 || status.state === 3 ? 0 : undefined);
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
