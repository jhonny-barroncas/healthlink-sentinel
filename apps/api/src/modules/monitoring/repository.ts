import type { PoolClient } from 'pg';
import { isTelemetryStale } from './telemetry-freshness.js';

export type OperationalStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export interface MonitoringEventInput {
  equipmentId?: string;
  integrationId?: string;
  externalEventId?: string;
  eventKind: 'status' | 'problem' | 'recovery';
  operationalStatus: OperationalStatus;
  severity?: number;
  title?: string;
  observedAt: string;
  payload?: Record<string, unknown>;
}

export async function ingestEvent(client: PoolClient, tenantId: string, input: MonitoringEventInput) {
  if (input.equipmentId) {
    const ownership = await client.query('SELECT 1 FROM equipment WHERE id = $1 AND tenant_id = $2 AND active = true', [input.equipmentId, tenantId]);
    if (!ownership.rows[0]) throw Object.assign(new Error('Equipamento não encontrado neste tenant.'), { statusCode: 404 });
  }
  if (input.integrationId) {
    const ownership = await client.query('SELECT 1 FROM integrations WHERE id = $1 AND tenant_id = $2 AND active = true', [input.integrationId, tenantId]);
    if (!ownership.rows[0]) throw Object.assign(new Error('Integração não encontrada neste tenant.'), { statusCode: 404 });
  }
  const event = await client.query(`
    INSERT INTO monitoring_events (tenant_id, equipment_id, integration_id, external_event_id, event_kind, operational_status, severity, title, observed_at, payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (tenant_id, integration_id, external_event_id) DO NOTHING
    RETURNING id, equipment_id, event_kind, operational_status, severity, title, observed_at
  `, [tenantId, input.equipmentId ?? null, input.integrationId ?? null, input.externalEventId ?? null, input.eventKind, input.operationalStatus, input.severity ?? null, input.title ?? null, input.observedAt, input.payload ?? {}]);
  if (!event.rows[0]) return { duplicate: true };
  if (input.equipmentId) {
    await client.query(`
      INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at, source_payload = EXCLUDED.source_payload
      WHERE equipment_status_snapshots.tenant_id = EXCLUDED.tenant_id
    `, [input.equipmentId, tenantId, input.operationalStatus, input.observedAt, input.payload ?? {}]);
  }
  return { duplicate: false, event: event.rows[0] };
}

export async function listEquipmentStatus(client: PoolClient, tenantId: string, mobileOnly = false) {
  const result = await client.query(`
    SELECT e.id AS equipment_id, e.unit_id, et.code AS equipment_type, e.name, e.active,
           e.serial_number, e.management_address,
           e.contracted_download_mbps::float8, e.contracted_upload_mbps::float8,
           CASE WHEN NOT e.active THEN 'unknown'
                WHEN s.observed_at IS NULL THEN 'unknown'
                WHEN (COALESCE(s.source_payload->>'source', '') LIKE 'starlink_%' AND s.observed_at < now() - interval '30 seconds') OR (COALESCE(s.source_payload->>'source', '') LIKE 'zabbix_%' AND s.observed_at < now() - interval '90 seconds') THEN 'unknown'
                ELSE s.operational_status END AS operational_status,
           s.observed_at
    FROM equipment e
    JOIN equipment_types et ON et.id = e.equipment_type_id
    LEFT JOIN equipment_status_snapshots s ON s.equipment_id = e.id AND s.tenant_id = e.tenant_id
    WHERE e.tenant_id = $1 AND ($2 = false OR EXISTS (SELECT 1 FROM health_units hu WHERE hu.id = e.unit_id AND hu.unit_type = 'mobile'))
    ORDER BY e.unit_id, e.name
  `, [tenantId, mobileOnly]);
  return result.rows;
}

export async function listUnitOperationalStatus(client: PoolClient, tenantId: string, mobileOnly = false) {
  const result = await client.query(`
    SELECT hu.id AS unit_id, hu.code, hu.name, hu.state_code, hu.city, hu.unit_type, hu.latitude, hu.longitude,
      CASE WHEN bool_or(CASE WHEN s.observed_at IS NULL THEN 'unknown' WHEN (COALESCE(s.source_payload->>'source', '') LIKE 'starlink_%' AND s.observed_at < now() - interval '30 seconds') OR (COALESCE(s.source_payload->>'source', '') LIKE 'zabbix_%' AND s.observed_at < now() - interval '90 seconds') THEN 'unknown' ELSE COALESCE(s.operational_status, 'unknown') END = 'offline') THEN 'offline'
           WHEN bool_or(CASE WHEN s.observed_at IS NULL THEN 'unknown' WHEN (COALESCE(s.source_payload->>'source', '') LIKE 'starlink_%' AND s.observed_at < now() - interval '30 seconds') OR (COALESCE(s.source_payload->>'source', '') LIKE 'zabbix_%' AND s.observed_at < now() - interval '90 seconds') THEN 'unknown' ELSE COALESCE(s.operational_status, 'unknown') END = 'degraded') THEN 'degraded'
           WHEN bool_and(CASE WHEN s.observed_at IS NULL THEN 'unknown' WHEN (COALESCE(s.source_payload->>'source', '') LIKE 'starlink_%' AND s.observed_at < now() - interval '30 seconds') OR (COALESCE(s.source_payload->>'source', '') LIKE 'zabbix_%' AND s.observed_at < now() - interval '90 seconds') THEN 'unknown' ELSE COALESCE(s.operational_status, 'unknown') END = 'online') THEN 'online'
           ELSE 'unknown' END AS operational_status,
      count(*) FILTER (WHERE (CASE WHEN s.observed_at IS NULL THEN 'unknown' WHEN (COALESCE(s.source_payload->>'source', '') LIKE 'starlink_%' AND s.observed_at < now() - interval '30 seconds') OR (COALESCE(s.source_payload->>'source', '') LIKE 'zabbix_%' AND s.observed_at < now() - interval '90 seconds') THEN 'unknown' ELSE COALESCE(s.operational_status, 'unknown') END) = 'offline')::int AS offline_equipment,
      count(*) FILTER (WHERE (CASE WHEN s.observed_at IS NULL THEN 'unknown' WHEN (COALESCE(s.source_payload->>'source', '') LIKE 'starlink_%' AND s.observed_at < now() - interval '30 seconds') OR (COALESCE(s.source_payload->>'source', '') LIKE 'zabbix_%' AND s.observed_at < now() - interval '90 seconds') THEN 'unknown' ELSE COALESCE(s.operational_status, 'unknown') END) = 'degraded')::int AS degraded_equipment
    FROM health_units hu
    LEFT JOIN equipment e ON e.unit_id = hu.id AND e.tenant_id = hu.tenant_id AND e.active = true
    LEFT JOIN equipment_status_snapshots s ON s.equipment_id = e.id AND s.tenant_id = hu.tenant_id
    WHERE hu.tenant_id = $1 AND hu.active = true AND ($2 = false OR hu.unit_type = 'mobile')
    GROUP BY hu.id ORDER BY hu.code
  `, [tenantId, mobileOnly]);
  return result.rows;
}

export async function listLinkTelemetry(client: PoolClient, tenantId: string, mobileOnly = false) {
  const result = await client.query(`
    SELECT hu.id AS unit_id, hu.code AS unit_code, hu.name AS unit_name,
      e.id AS equipment_id, e.name AS equipment_name,
      et.code AS equipment_type,
      e.contracted_download_mbps::float8, e.contracted_upload_mbps::float8,
      CASE WHEN s.observed_at IS NULL THEN 'unknown'
           WHEN (COALESCE(s.source_payload->>'source', '') LIKE 'starlink_%' AND s.observed_at < now() - interval '30 seconds') OR (COALESCE(s.source_payload->>'source', '') LIKE 'zabbix_%' AND s.observed_at < now() - interval '90 seconds') THEN 'unknown'
           ELSE s.operational_status END AS operational_status,
      s.source_payload->>'source' AS status_source,
      ms.metric_key, ms.value::float8 AS value, ms.observed_at
    FROM health_units hu
    JOIN equipment e ON e.unit_id = hu.id AND e.tenant_id = hu.tenant_id AND e.active = true
    JOIN equipment_types et ON et.id = e.equipment_type_id
    LEFT JOIN equipment_status_snapshots s ON s.equipment_id = e.id AND s.tenant_id = e.tenant_id
    LEFT JOIN LATERAL (
      SELECT metric_key, value, observed_at
      FROM metric_samples
      WHERE tenant_id = e.tenant_id AND equipment_id = e.id
        AND metric_key IN ('network.latency.ms','network.loss.pct','network.in.bps','network.out.bps','starlink.latency.ms','starlink.loss.pct','starlink.download.bps','starlink.upload.bps')
        AND observed_at >= now() - interval '24 hours'
        AND NOT (COALESCE(source_payload->>'itemKey', '') ~* '(discard|error|drop)'
          OR COALESCE(source_payload->>'itemName', '') ~* '(discard|error|drop)')
      ORDER BY observed_at DESC
      LIMIT 60
    ) ms ON true
    WHERE hu.tenant_id = $1 AND hu.active = true AND ($2 = false OR hu.unit_type = 'mobile')
      AND (lower(et.code) LIKE '%link%' OR lower(et.code) LIKE '%router%' OR lower(et.code) LIKE '%starlink%' OR lower(et.code) LIKE '%mikrotik%' OR lower(et.code) LIKE '%vpn%')
    ORDER BY hu.code, e.name, ms.observed_at DESC
  `, [tenantId, mobileOnly]);
  const equipment = new Map<string, any>();
  for (const row of result.rows) {
    const current = equipment.get(row.equipment_id) ?? {
      unit_id: row.unit_id, unit_code: row.unit_code, unit_name: row.unit_name,
      equipment_id: row.equipment_id, equipment_name: row.equipment_name,
      equipment_type: row.equipment_type,
      contracted_download_mbps: row.contracted_download_mbps,
      contracted_upload_mbps: row.contracted_upload_mbps,
      operational_status: row.operational_status, status_source: row.status_source, observed_at: null, telemetry_stale: true, telemetry_error: 'Telemetria zerada: sem comunicação recente.', metrics: {}, latency_history: [],
    };
    if (row.metric_key && current.metrics[row.metric_key] === undefined) current.metrics[row.metric_key] = row.value;
    if ((row.metric_key === 'network.latency.ms' || row.metric_key === 'starlink.latency.ms') && current.latency_history.length < 14) current.latency_history.unshift({ value: row.value, observed_at: row.observed_at });
    if (row.observed_at && (!current.observed_at || row.observed_at > current.observed_at)) current.observed_at = row.observed_at;
    equipment.set(row.equipment_id, current);
  }
  return [...equipment.values()].map((item) => {
    const stale = isTelemetryStale(item.observed_at, item.status_source);
    if (!stale) return { ...item, telemetry_stale: false, telemetry_error: null };
    return {
      ...item,
      operational_status: item.status_source?.startsWith('zabbix_') ? item.operational_status : 'unknown',
      telemetry_stale: true,
      telemetry_error: 'Telemetria zerada: sem comunicação há mais de 30 segundos. Verifique o Zabbix, o agente e a conectividade da unidade.',
      metrics: {},
      latency_history: [],
    };
  });
}
