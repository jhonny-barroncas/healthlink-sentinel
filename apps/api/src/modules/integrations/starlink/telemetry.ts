export type StarlinkSource = 'official_api' | 'local_agent' | 'zabbix';
export type StarlinkMetricKey =
  | 'starlink.latency.ms' | 'starlink.loss.pct' | 'starlink.download.bps' | 'starlink.upload.bps'
  | 'starlink.uptime.s' | 'starlink.obstruction.pct' | 'starlink.signal.snr'
  | 'starlink.temperature.c' | 'starlink.power.w' | 'starlink.alerts.active'
  | 'starlink.location.latitude' | 'starlink.location.longitude' | 'starlink.coverage.available';

export type StarlinkSample = { metricKey: StarlinkMetricKey; value: number; unit: string; observedAt: string };

const aliases: Record<StarlinkMetricKey, string[]> = {
  'starlink.latency.ms': ['latency_ms', 'latencyMs', 'ping_ms', 'pingMs'],
  'starlink.loss.pct': ['loss_pct', 'lossPct', 'packet_loss_pct'],
  'starlink.download.bps': ['download_bps', 'downloadBps', 'rx_bps', 'downlink_bps'],
  'starlink.upload.bps': ['upload_bps', 'uploadBps', 'tx_bps', 'uplink_bps'],
  'starlink.uptime.s': ['uptime_s', 'uptimeSeconds', 'uptime'],
  'starlink.obstruction.pct': ['obstruction_pct', 'obstructionPct', 'obstruction'],
  'starlink.signal.snr': ['signal_snr', 'snr', 'snrDb'],
  'starlink.temperature.c': ['temperature_c', 'temperatureC', 'dish_temperature_c'],
  'starlink.power.w': ['power_w', 'powerW', 'power'],
  'starlink.alerts.active': ['alerts_active', 'activeAlerts', 'alert_count'],
  'starlink.location.latitude': ['latitude', 'latitude_deg', 'lat'],
  'starlink.location.longitude': ['longitude', 'longitude_deg', 'lon', 'lng'],
  'starlink.coverage.available': ['coverage_available', 'service_available'],
};

const units: Record<StarlinkMetricKey, string> = {
  'starlink.latency.ms': 'ms', 'starlink.loss.pct': '%', 'starlink.download.bps': 'bps',
  'starlink.upload.bps': 'bps', 'starlink.uptime.s': 's', 'starlink.obstruction.pct': '%',
  'starlink.signal.snr': 'dB', 'starlink.temperature.c': '°C', 'starlink.power.w': 'W', 'starlink.alerts.active': 'count',
  'starlink.location.latitude': 'deg', 'starlink.location.longitude': 'deg', 'starlink.coverage.available': 'boolean',
};

export function normalizeStarlinkPayload(payload: Record<string, unknown>, observedAt = new Date().toISOString()): StarlinkSample[] {
  const samples: StarlinkSample[] = [];
  for (const [metricKey, keys] of Object.entries(aliases) as Array<[StarlinkMetricKey, string[]]>) {
    const key = keys.find((candidate) => payload[candidate] !== undefined && payload[candidate] !== null);
    if (!key) continue;
    const value = Number(payload[key]);
    if (!Number.isFinite(value)) continue;
    samples.push({ metricKey, value, unit: units[metricKey], observedAt });
  }
  return samples;
}

export function deriveStarlinkStatus(samples: StarlinkSample[]): 'online' | 'degraded' | 'offline' | 'unknown' {
  if (!samples.length) return 'unknown';
  const latency = samples.find((sample) => sample.metricKey === 'starlink.latency.ms')?.value;
  const loss = samples.find((sample) => sample.metricKey === 'starlink.loss.pct')?.value;
  const obstruction = samples.find((sample) => sample.metricKey === 'starlink.obstruction.pct')?.value;
  if (loss !== undefined && loss >= 100) return 'offline';
  if ((latency !== undefined && latency >= 250) || (loss !== undefined && loss >= 10) || (obstruction !== undefined && obstruction >= 20)) return 'degraded';
  return 'online';
}
