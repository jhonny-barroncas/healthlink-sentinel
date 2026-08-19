const ZABBIX_STALE_AFTER_MS = 90_000;
const DEFAULT_STALE_AFTER_MS = 30_000;

export function telemetryStaleAfterMs(source?: string | null): number {
  return source?.startsWith('zabbix_') ? ZABBIX_STALE_AFTER_MS : DEFAULT_STALE_AFTER_MS;
}

export function isTelemetryStale(observedAt?: string | null, source?: string | null, now = Date.now()): boolean {
  if (!observedAt) return true;
  const timestamp = new Date(observedAt).getTime();
  return !Number.isFinite(timestamp) || now - timestamp > telemetryStaleAfterMs(source);
}
