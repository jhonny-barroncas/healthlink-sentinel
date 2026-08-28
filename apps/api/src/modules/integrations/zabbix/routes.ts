import type { FastifyPluginAsync } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../../platform/env.js';
import { hasPermission, permission } from '../../../platform/authorization.js';
import { database, withTenant } from '../../../platform/database.js';
import { isDeployableAgentArtifact } from '../agent/provisioning.js';
import { embedAgentVersion, extractEmbeddedAgentVersion, nextAgentVersion } from '../agent/versioning.js';
import { ZabbixClient, ZabbixHttpTransport } from './client.js';
import { selectLinkMetricCandidates, type LinkMetric, type ZabbixItem } from './telemetry.js';

function requireIntegrationAccess(request: { auth: { roles: string[] } }): void {
  if (!hasPermission(request.auth.roles, permission.integrationsManage)) throw Object.assign(new Error('Permissão insuficiente.'), { statusCode: 403 });
}

function requireAgentVersionAccess(request: { auth: { roles: string[] } }): void {
  if (!hasPermission(request.auth.roles, permission.agentVersionsManage)) throw Object.assign(new Error('Permissão insuficiente para publicar versões do agente.'), { statusCode: 403 });
}

function configuredClient(): ZabbixClient {
  if (!env.ZABBIX_API_URL || !env.ZABBIX_API_TOKEN) throw Object.assign(new Error('Integração Zabbix não configurada no ambiente.'), { statusCode: 503 });
  return new ZabbixClient(new ZabbixHttpTransport(env.ZABBIX_API_URL, env.ZABBIX_API_TOKEN));
}

async function ensureZabbixIntegration(client: import('pg').PoolClient, tenantId: string): Promise<string> {
  // Keep one stable integration per tenant. The mapping and sync endpoints are
  // called independently, so creating a row on every request would orphan
  // mappings under older integration ids.
  const existingStable = await client.query<{ id: string }>(`
    SELECT i.id
    FROM integrations i
    WHERE i.tenant_id = $1 AND i.kind = 'zabbix' AND i.active = true
    ORDER BY EXISTS (SELECT 1 FROM zabbix_host_mappings m WHERE m.integration_id = i.id) DESC, i.created_at
    LIMIT 1
  `, [tenantId]);
  if (existingStable.rows[0]) return existingStable.rows[0].id;
  const result = await client.query<{ id: string }>(`
    INSERT INTO integrations (tenant_id, kind, name, config)
    VALUES ($1, 'zabbix', 'Zabbix API (ambiente)', '{"source":"environment"}')
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [tenantId]);
  if (result.rows[0]) return result.rows[0].id;
  const existingFallback = await client.query<{ id: string }>(`SELECT id FROM integrations WHERE tenant_id = $1 AND kind = 'zabbix' ORDER BY created_at LIMIT 1`, [tenantId]);
  const existing = existingFallback;
  if (!existing.rows[0]) throw Object.assign(new Error('Não foi possível preparar a integração Zabbix.'), { statusCode: 500 });
  return existingFallback.rows[0].id;
}

async function resetEquipmentTelemetry(client: import('pg').PoolClient, tenantId: string, equipmentIds: string[]): Promise<void> {
  const uniqueEquipmentIds = [...new Set(equipmentIds)];
  if (uniqueEquipmentIds.length === 0) return;
  await client.query(`
    UPDATE equipment_status_snapshots
    SET operational_status = 'unknown', observed_at = now(), source_payload = '{"reason":"zabbix_mapping_changed"}'::jsonb
    WHERE tenant_id = $1 AND equipment_id = ANY($2::uuid[])
  `, [tenantId, uniqueEquipmentIds]);
  await client.query(`
    INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
    SELECT hu.id, hu.tenant_id,
      CASE WHEN bool_or(COALESCE(es.operational_status, 'unknown') = 'offline') THEN 'offline'::operational_status
           WHEN bool_or(COALESCE(es.operational_status, 'unknown') = 'degraded') THEN 'degraded'::operational_status
           WHEN bool_and(COALESCE(es.operational_status, 'unknown') = 'online') THEN 'online'::operational_status
           ELSE 'unknown'::operational_status END,
      count(DISTINCT a.id) FILTER (WHERE a.status IN ('open','acknowledged'))::int, now()
    FROM health_units hu
    LEFT JOIN equipment e ON e.unit_id = hu.id AND e.tenant_id = hu.tenant_id AND e.active = true
    LEFT JOIN equipment_status_snapshots es ON es.equipment_id = e.id AND es.tenant_id = hu.tenant_id
    LEFT JOIN alerts a ON a.unit_id = hu.id AND a.tenant_id = hu.tenant_id
    WHERE hu.tenant_id = $1 AND hu.active = true
      AND hu.id IN (SELECT unit_id FROM equipment WHERE tenant_id = $1 AND id = ANY($2::uuid[]))
    GROUP BY hu.id, hu.tenant_id
    ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status,
      active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at
  `, [tenantId, uniqueEquipmentIds]);
}

async function writeMappingAudit(
  client: import('pg').PoolClient,
  tenantId: string,
  actorUserId: string,
  action: string,
  mappingId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await client.query(`
    INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
    VALUES ($1, $2, $3, 'zabbix_host_mapping', $4, $5)
  `, [tenantId, actorUserId, action, mappingId, metadata]);
}

type ZabbixInterface = { available?: string; error?: string; main?: string; type?: string; ip?: string; dns?: string; port?: string };
type ZabbixHost = { hostid: string; host: string; name: string; status: string; interfaces?: ZabbixInterface[]; inventory?: { location?: string; location_lat?: string; location_lon?: string } };
type ZabbixProblem = { eventid: string; name: string; severity: string; clock: string; r_eventid?: string };
type ZabbixMappingContext = { zabbix_host_id: string; equipment_id: string; unit_id: string };

async function synchronizeLinkTelemetry(tenantId: string): Promise<{ itemsSeen: number; samplesPersisted: number; synchronizedAt: string }> {
  const context = await getMappingContext(tenantId);
  if (context.mappings.length === 0) return { itemsSeen: 0, samplesPersisted: 0, synchronizedAt: new Date().toISOString() };
  const items = await configuredClient().getItems({
    output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock', 'units', 'status', 'state'],
    hostids: context.mappings.map((mapping) => mapping.zabbix_host_id), monitored: true, limit: 5000,
  }) as ZabbixItem[];
  const candidates = selectLinkMetricCandidates(items);
  const samplesPersisted = await withTenant(tenantId, async (db) => {
    let persisted = 0;
    for (const mapping of context.mappings) {
      for (const metricKey of ['network.latency.ms', 'network.loss.pct', 'network.in.bps', 'network.out.bps'] as LinkMetric[]) {
        const selected = candidates.get(`${mapping.zabbix_host_id}:${metricKey}`);
        if (!selected || !Number(selected.item.lastclock)) continue;
        const insertion = await db.query(`
          INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload)
          SELECT $1,$2,$3,$4,$5,to_timestamp($6),$7
          WHERE NOT EXISTS (
            SELECT 1 FROM metric_samples
            WHERE tenant_id = $1 AND equipment_id = $2 AND metric_key = $3 AND observed_at = to_timestamp($6)
          )
        `, [tenantId, mapping.equipment_id, metricKey, selected.metric.value,
          metricKey.endsWith('.ms') ? 'ms' : metricKey.endsWith('.pct') ? '%' : 'bps', Number(selected.item.lastclock),
          { source: 'zabbix_item_fast_sync', itemId: selected.item.itemid, itemName: selected.item.name, itemKey: selected.item.key_ }]);
        persisted += insertion.rowCount ?? 0;
      }
    }
    return persisted;
  });
  return { itemsSeen: items.length, samplesPersisted, synchronizedAt: new Date().toISOString() };
}

function deriveHostStatus(host: ZabbixHost | undefined, activeSeverities: number[]): 'online' | 'degraded' | 'offline' | 'unknown' {
  if (!host || host.status === '1') return 'unknown';
  const mainInterfaces = (host.interfaces ?? []).filter((item) => item.main !== '0');
  const hasAvailableInterface = mainInterfaces.some((item) => item.available === '1');
  const hasUnavailableInterface = mainInterfaces.some((item) => item.available === '2');
  if (hasUnavailableInterface && !hasAvailableInterface) return 'offline';
  const maximumSeverity = Math.max(0, ...activeSeverities);
  if (maximumSeverity >= 4) return 'offline';
  if (activeSeverities.length > 0) return 'degraded';
  return 'online';
}

function hostCoordinates(host: ZabbixHost | undefined): { latitude: number; longitude: number } | null {
  const latitude = Number(host?.inventory?.location_lat);
  const longitude = Number(host?.inventory?.location_lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

async function getMappingContext(tenantId: string): Promise<{ integrationId: string; mappings: ZabbixMappingContext[] }> {
  return withTenant(tenantId, async (db) => {
    const integrationId = await ensureZabbixIntegration(db, tenantId);
    const mappings = await db.query<ZabbixMappingContext>(`
      SELECT m.zabbix_host_id, m.equipment_id, e.unit_id
      FROM zabbix_host_mappings m
      JOIN equipment e ON e.id = m.equipment_id AND e.tenant_id = m.tenant_id AND e.active = true
      WHERE m.tenant_id = $1 AND m.integration_id = $2
    `, [tenantId, integrationId]);
    return { integrationId, mappings: mappings.rows };
  });
}

async function recordSyncFailure(tenantId: string, integrationId: string, startedAt: number, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : 'Falha desconhecida na sincronização Zabbix').slice(0, 1000);
  await withTenant(tenantId, async (db) => {
    const failure = await db.query<{ consecutive_failures: number }>(`
      INSERT INTO integration_sync_status (integration_id, tenant_id, health_status, last_attempt_at, last_failure_at, consecutive_failures, last_error, duration_ms)
      VALUES ($1,$2,'degraded',now(),now(),1,$3,$4)
      ON CONFLICT (integration_id) DO UPDATE SET
        health_status = CASE WHEN integration_sync_status.consecutive_failures + 1 >= 3 THEN 'unavailable' ELSE 'degraded' END,
        last_attempt_at = now(), last_failure_at = now(),
        consecutive_failures = integration_sync_status.consecutive_failures + 1,
        last_error = EXCLUDED.last_error, duration_ms = EXCLUDED.duration_ms, updated_at = now()
      RETURNING consecutive_failures
    `, [integrationId, tenantId, message, Date.now() - startedAt]);
    if ((failure.rows[0]?.consecutive_failures ?? 0) < 3) return;
    await db.query(`
      UPDATE equipment_status_snapshots es
      SET operational_status = 'unknown', observed_at = now(),
        source_payload = jsonb_build_object('reason', 'zabbix_integration_unavailable', 'lastError', $3::text)
      WHERE es.tenant_id = $1 AND es.equipment_id IN (
        SELECT equipment_id FROM zabbix_host_mappings
        WHERE tenant_id = $1 AND integration_id = $2
      )
    `, [tenantId, integrationId, message]);
    await db.query(`
      INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
      SELECT hu.id, hu.tenant_id,
        CASE WHEN bool_or(COALESCE(es.operational_status, 'unknown') = 'offline') THEN 'offline'::operational_status
             WHEN bool_or(COALESCE(es.operational_status, 'unknown') = 'degraded') THEN 'degraded'::operational_status
             WHEN bool_and(COALESCE(es.operational_status, 'unknown') = 'online') THEN 'online'::operational_status
             ELSE 'unknown'::operational_status END,
        count(DISTINCT a.id) FILTER (WHERE a.status IN ('open','acknowledged'))::int, now()
      FROM health_units hu
      LEFT JOIN equipment e ON e.unit_id = hu.id AND e.tenant_id = hu.tenant_id AND e.active = true
      LEFT JOIN equipment_status_snapshots es ON es.equipment_id = e.id AND es.tenant_id = hu.tenant_id
      LEFT JOIN alerts a ON a.unit_id = hu.id AND a.tenant_id = hu.tenant_id
      WHERE hu.tenant_id = $1 AND hu.active = true
      GROUP BY hu.id, hu.tenant_id
      ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status,
        active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at
    `, [tenantId]);
  });
}

export const zabbixRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/integrations/zabbix/test', { preHandler: [app.authenticate] }, async (request) => {
    requireIntegrationAccess(request);
    const hosts = await configuredClient().getHosts({ output: ['hostid', 'host', 'name', 'status'], limit: 5 }) as unknown[];
    return { connected: true, hostsReturned: hosts.length };
  });

  app.get('/v1/integrations/zabbix/status', { preHandler: [app.authenticate] }, async (request) => {
    if (!hasPermission(request.auth.roles, permission.monitoringRead)) throw Object.assign(new Error('Permissão insuficiente.'), { statusCode: 403 });
    return withTenant(request.auth.tenantId, async (db) => {
      const integrationId = await ensureZabbixIntegration(db, request.auth.tenantId);
      const result = await db.query(`
        SELECT integration_id, health_status, last_attempt_at, last_success_at, last_failure_at,
          consecutive_failures, last_error, hosts_seen, mapped_hosts, problems_seen, duration_ms
        FROM integration_sync_status
        WHERE tenant_id = $1 AND integration_id = $2
      `, [request.auth.tenantId, integrationId]);
      return result.rows[0] ?? {
        integration_id: integrationId, health_status: 'unknown', last_attempt_at: null,
        last_success_at: null, last_failure_at: null, consecutive_failures: 0,
        last_error: null, hosts_seen: 0, mapped_hosts: 0, problems_seen: 0, duration_ms: null,
      };
    });
  });

  app.post('/v1/integrations/zabbix/sync-preview', { preHandler: [app.authenticate] }, async (request) => {
    requireIntegrationAccess(request);
    const client = configuredClient();
    const [hosts, problems, mapped] = await Promise.all([
      client.getHosts({ output: ['hostid', 'host', 'name', 'status'], limit: 1000 }) as Promise<Array<{ hostid: string; host: string; name: string; status: string }>>,
      client.getProblems({ output: ['eventid', 'name', 'severity', 'clock', 'r_eventid'], recent: true }) as Promise<Array<{ eventid: string; name: string; severity: string; clock: string; r_eventid?: string }>>,
      withTenant(request.auth.tenantId, (db) => db.query<{ count: string }>('SELECT count(*)::text AS count FROM zabbix_host_mappings WHERE tenant_id = $1', [request.auth.tenantId]).then((result) => result.rows[0]?.count ?? '0')),
    ]);
    return { connected: true, hostsFound: hosts.length, problemsFound: problems.length, mappedHosts: Number(mapped), unmappedHosts: Math.max(hosts.length - Number(mapped), 0), problems: problems.slice(0, 20).map((problem) => ({ externalEventId: problem.eventid, title: problem.name, severity: Number(problem.severity), openedAt: new Date(Number(problem.clock) * 1000).toISOString(), recovered: Boolean(problem.r_eventid) })) };
  });

  app.post('/v1/integrations/zabbix/sync', { preHandler: [app.authenticate] }, async (request) => {
    requireIntegrationAccess(request);
    const startedAt = Date.now();
    const context = await getMappingContext(request.auth.tenantId);
    let hosts: ZabbixHost[];
    let problems: ZabbixProblem[];
    let items: ZabbixItem[];
    let events: Array<{ eventid: string; hosts?: Array<{ hostid: string; host?: string; name?: string }> }>;
    try {
      const client = configuredClient();
      [hosts, problems, items] = await Promise.all([
        client.getHosts({ output: ['hostid', 'host', 'name', 'status'], selectInterfaces: ['available', 'error', 'main', 'type'], selectInventory: 'extend', limit: 1000 }) as Promise<ZabbixHost[]>,
        client.getProblems({ output: ['eventid', 'name', 'severity', 'clock', 'r_eventid'], recent: true }) as Promise<ZabbixProblem[]>,
        context.mappings.length ? client.getItems({
          output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock', 'units', 'status', 'state'],
          hostids: context.mappings.map((mapping) => mapping.zabbix_host_id), monitored: true, limit: 5000,
        }) as Promise<ZabbixItem[]> : Promise.resolve([]),
      ]);
      events = problems.length === 0 ? [] : await client.getEvents({
        eventids: problems.map((problem) => problem.eventid), output: ['eventid'], selectHosts: ['hostid', 'host', 'name'],
      }) as Array<{ eventid: string; hosts?: Array<{ hostid: string; host?: string; name?: string }> }>;
    } catch (error) {
      await recordSyncFailure(request.auth.tenantId, context.integrationId, startedAt, error);
      throw error;
    }
    const hostsByEvent = new Map(events.map((event) => [event.eventid, event.hosts ?? []]));
    const activeSeverityByHost = new Map<string, number[]>();
    for (const problem of problems.filter((item) => !item.r_eventid)) {
      for (const host of hostsByEvent.get(problem.eventid) ?? []) {
        const severities = activeSeverityByHost.get(host.hostid) ?? [];
        severities.push(Math.max(0, Math.min(5, Number(problem.severity) || 0)));
        activeSeverityByHost.set(host.hostid, severities);
      }
    }

    const result = await withTenant(request.auth.tenantId, async (db) => {
      const integrationId = context.integrationId;
      const byHost = new Map(context.mappings.map((row) => [row.zabbix_host_id, row]));
      const hostsById = new Map(hosts.map((host) => [host.hostid, host]));
      let persisted = 0;
      let unmapped = 0;
      let autoLocated = 0;
      const affectedEquipment = new Set<string>();

      const metricCandidates = selectLinkMetricCandidates(items);

      for (const mapping of context.mappings) {
        let telemetryCollected = false;
        for (const metricKey of ['network.latency.ms', 'network.loss.pct', 'network.in.bps', 'network.out.bps'] as LinkMetric[]) {
          const selected = metricCandidates.get(`${mapping.zabbix_host_id}:${metricKey}`);
          if (!selected || !Number(selected.item.lastclock)) continue;
          telemetryCollected = true;
          await db.query(`
            INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload)
            SELECT $1,$2,$3,$4,$5,to_timestamp($6),$7
            WHERE NOT EXISTS (
              SELECT 1 FROM metric_samples
              WHERE tenant_id = $1 AND equipment_id = $2 AND metric_key = $3 AND observed_at = to_timestamp($6)
            )
          `, [request.auth.tenantId, mapping.equipment_id, metricKey, selected.metric.value,
            metricKey.endsWith('.ms') ? 'ms' : metricKey.endsWith('.pct') ? '%' : 'bps', Number(selected.item.lastclock),
            { source: 'zabbix_item', itemId: selected.item.itemid, itemName: selected.item.name, itemKey: selected.item.key_ }]);
        }
        await db.query(`
          UPDATE equipment_status_snapshots
          SET operational_status = CASE WHEN $3 THEN operational_status ELSE 'unknown'::operational_status END,
              observed_at = now(),
              source_payload = CASE WHEN $3
                THEN source_payload || jsonb_build_object('source', 'zabbix_telemetry')
                ELSE jsonb_build_object('source', 'zabbix_telemetry', 'reason', 'no_recent_samples') END
          WHERE equipment_id = $1 AND tenant_id = $2
        `, [mapping.equipment_id, request.auth.tenantId, telemetryCollected]);
      }

      for (const problem of problems) {
        const hostMapping = (hostsByEvent.get(problem.eventid) ?? []).map((host) => byHost.get(host.hostid)).find(Boolean);
        if (!hostMapping) { unmapped += 1; continue; }
        const severity = Math.max(0, Math.min(5, Number(problem.severity) || 0));
        const openedAt = new Date(Number(problem.clock) * 1000);
        const recovered = Boolean(problem.r_eventid);
        const status = recovered ? 'resolved' : 'open';
        const operationalStatus = recovered ? 'online' : severity >= 4 ? 'offline' : 'degraded';
        const alert = await db.query<{ id: string }>(`
          INSERT INTO alerts (tenant_id, unit_id, equipment_id, integration_id, external_id, title, severity, status, opened_at, resolved_at, raw_payload)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (integration_id, external_id) DO UPDATE SET title = EXCLUDED.title, severity = EXCLUDED.severity,
            status = EXCLUDED.status, resolved_at = EXCLUDED.resolved_at, raw_payload = EXCLUDED.raw_payload
          RETURNING id
        `, [request.auth.tenantId, hostMapping.unit_id, hostMapping.equipment_id, integrationId, problem.eventid, problem.name, severity, status, openedAt, recovered ? new Date() : null, problem]);
        if (alert.rows[0]) {
          await db.query(`INSERT INTO alert_events (tenant_id, alert_id, event_type, payload) VALUES ($1,$2,$3,$4)`, [request.auth.tenantId, alert.rows[0].id, recovered ? 'recovered' : 'observed', problem]);
          await db.query(`
            INSERT INTO monitoring_events (tenant_id, equipment_id, integration_id, external_event_id, event_kind, operational_status, severity, title, observed_at, payload)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (tenant_id, integration_id, external_event_id) DO NOTHING
          `, [request.auth.tenantId, hostMapping.equipment_id, integrationId, problem.eventid, recovered ? 'recovery' : 'problem', operationalStatus, severity, problem.name, new Date(), problem]);
          affectedEquipment.add(hostMapping.equipment_id);
          persisted += 1;
        }
      }

      for (const mapping of context.mappings) {
        const host = hostsById.get(mapping.zabbix_host_id);
        const operationalStatus = deriveHostStatus(host, activeSeverityByHost.get(mapping.zabbix_host_id) ?? []);
        const coordinates = hostCoordinates(host);
        if (coordinates) {
          const locationUpdate = await db.query(`
            UPDATE health_units
            SET latitude = $1, longitude = $2, updated_at = now()
            WHERE id = $3 AND tenant_id = $4 AND active = true
              AND latitude IS NULL AND longitude IS NULL
          `, [coordinates.latitude, coordinates.longitude, mapping.unit_id, request.auth.tenantId]);
          if (locationUpdate.rowCount) autoLocated += locationUpdate.rowCount;
        }
        const previous = await db.query<{ operational_status: string }>(`
          SELECT operational_status FROM equipment_status_snapshots WHERE equipment_id = $1 AND tenant_id = $2
        `, [mapping.equipment_id, request.auth.tenantId]);
        const sourcePayload = {
          source: 'zabbix_host_sync', zabbixHostId: mapping.zabbix_host_id,
          hostEnabled: host?.status === '0', interfaces: host?.interfaces ?? [],
          activeProblemSeverities: activeSeverityByHost.get(mapping.zabbix_host_id) ?? [],
          hostFound: Boolean(host),
        };
        await db.query(`
          INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
          VALUES ($1,$2,$3,now(),$4)
          ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status,
            observed_at = EXCLUDED.observed_at, source_payload = EXCLUDED.source_payload
        `, [mapping.equipment_id, request.auth.tenantId, operationalStatus, sourcePayload]);
        if (previous.rows[0]?.operational_status !== operationalStatus) {
          await db.query(`
            INSERT INTO monitoring_events (tenant_id, equipment_id, integration_id, external_event_id, event_kind, operational_status, title, observed_at, payload)
            VALUES ($1,$2,$3,$4,'status',$5,$6,now(),$7)
            ON CONFLICT (tenant_id, integration_id, external_event_id) DO NOTHING
          `, [request.auth.tenantId, mapping.equipment_id, integrationId, `host-status:${mapping.zabbix_host_id}:${Date.now()}`, operationalStatus, `Host ${host?.name ?? mapping.zabbix_host_id}: ${operationalStatus}`, sourcePayload]);
        }
        affectedEquipment.add(mapping.equipment_id);
      }

      await db.query(`
        INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
        SELECT hu.id, hu.tenant_id,
          CASE WHEN bool_or(COALESCE(es.operational_status, 'unknown') = 'offline') THEN 'offline'::operational_status
               WHEN bool_or(COALESCE(es.operational_status, 'unknown') = 'degraded') THEN 'degraded'::operational_status
               WHEN bool_and(COALESCE(es.operational_status, 'unknown') = 'online') THEN 'online'::operational_status
               ELSE 'unknown'::operational_status END,
          count(DISTINCT a.id) FILTER (WHERE a.status IN ('open','acknowledged'))::int, now()
        FROM health_units hu
        LEFT JOIN equipment e ON e.unit_id = hu.id AND e.tenant_id = hu.tenant_id AND e.active = true
        LEFT JOIN equipment_status_snapshots es ON es.equipment_id = e.id AND es.tenant_id = hu.tenant_id
        LEFT JOIN alerts a ON a.unit_id = hu.id AND a.tenant_id = hu.tenant_id
        WHERE hu.tenant_id = $1 AND hu.active = true
        GROUP BY hu.id, hu.tenant_id
        ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at
      `, [request.auth.tenantId]);
      const missingMappedHosts = context.mappings.filter((mapping) => !hostsById.has(mapping.zabbix_host_id)).length;
      const healthStatus = missingMappedHosts > 0 ? 'degraded' : 'healthy';
      await db.query(`
        INSERT INTO integration_sync_status (integration_id, tenant_id, health_status, last_attempt_at, last_success_at,
          consecutive_failures, last_error, hosts_seen, mapped_hosts, problems_seen, duration_ms)
        VALUES ($1,$2,$3,now(),now(),0,NULL,$4,$5,$6,$7)
        ON CONFLICT (integration_id) DO UPDATE SET health_status = EXCLUDED.health_status,
          last_attempt_at = EXCLUDED.last_attempt_at, last_success_at = EXCLUDED.last_success_at,
          consecutive_failures = 0, last_error = NULL, hosts_seen = EXCLUDED.hosts_seen,
          mapped_hosts = EXCLUDED.mapped_hosts, problems_seen = EXCLUDED.problems_seen,
          duration_ms = EXCLUDED.duration_ms, updated_at = now()
      `, [integrationId, request.auth.tenantId, healthStatus, hosts.length, context.mappings.length, problems.length, Date.now() - startedAt]);
      return { connected: true, healthStatus, hostsFound: hosts.length, mappedHosts: context.mappings.length,
        missingMappedHosts, problemsFound: problems.length, persisted, unmapped, autoLocated, affectedEquipment: affectedEquipment.size,
        durationMs: Date.now() - startedAt, synchronizedAt: new Date().toISOString() };
    });
    return result;
  });

  app.post('/v1/integrations/zabbix/telemetry-sync', { preHandler: [app.authenticate] }, async (request) => {
    requireIntegrationAccess(request);
    return synchronizeLinkTelemetry(request.auth.tenantId);
  });

  app.get('/v1/integrations/zabbix/mapping-candidates', { preHandler: [app.authenticate] }, async (request) => {
    requireIntegrationAccess(request);
    const client = configuredClient();
    const [hosts, catalog] = await Promise.all([
      client.getHosts({ output: ['hostid', 'host', 'name', 'status'], selectInterfaces: ['ip', 'dns', 'port', 'main'], selectTags: 'extend', selectInventory: 'extend', limit: 1000 }) as Promise<unknown[]>,
      withTenant(request.auth.tenantId, async (db) => {
        const integrationId = await ensureZabbixIntegration(db, request.auth.tenantId);
        const equipment = await db.query(`SELECT e.id, e.unit_id, e.name, et.code AS equipment_type FROM equipment e JOIN equipment_types et ON et.id = e.equipment_type_id WHERE e.tenant_id = $1 AND e.active = true ORDER BY e.name`, [request.auth.tenantId]);
        const mappings = await db.query(`SELECT id, zabbix_host_id, equipment_id FROM zabbix_host_mappings WHERE tenant_id = $1 AND integration_id = $2`, [request.auth.tenantId, integrationId]);
        return { integrationId, equipment: equipment.rows, mappings: mappings.rows };
      }),
    ]);
    return { hosts, ...catalog };
  });

  app.get('/v1/integrations/zabbix/agent-versions', { preHandler: [app.authenticate] }, async (request) => {
    requireIntegrationAccess(request);
    return withTenant(request.auth.tenantId, async (db) => {
      const result = await db.query(`
        SELECT id, version, platform, file_name, file_size, checksum_sha256, active, created_at
        FROM agent_versions WHERE tenant_id = $1 ORDER BY platform, created_at DESC
      `, [request.auth.tenantId]);
      return result.rows;
    });
  });

  app.post('/v1/integrations/zabbix/agent-versions', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireAgentVersionAccess(request);
    const input = z.object({
      platform: z.enum(['windows', 'linux']),
      fileName: z.string().min(1).max(200),
      artifactBase64: z.string().min(1).max(25_000_000),
    }).parse(request.body);
    if (!isDeployableAgentArtifact(input.fileName)) throw Object.assign(new Error('Publique um bundle executável .cjs ou .js do agente; o instalador .ps1/.sh é gerado automaticamente por servidor.'), { statusCode: 422 });
    const uploadedArtifact = Buffer.from(input.artifactBase64, 'base64');
    if (!uploadedArtifact.length || uploadedArtifact.length > 20 * 1024 * 1024) throw Object.assign(new Error('O arquivo precisa ter entre 1 byte e 20 MB.'), { statusCode: 422 });
    return withTenant(request.auth.tenantId, async (db) => {
      const versions = await db.query<{ version: string }>('SELECT version FROM agent_versions WHERE tenant_id = $1', [request.auth.tenantId]);
      const version = nextAgentVersion(versions.rows.map((row) => row.version));
      let artifact: Buffer;
      try { artifact = embedAgentVersion(uploadedArtifact, version); }
      catch (error) { throw Object.assign(new Error(error instanceof Error ? error.message : 'Bundle sem versão embutida.'), { statusCode: 422 }); }
      if (extractEmbeddedAgentVersion(artifact) !== version) throw Object.assign(new Error('A versão embutida no bundle não pôde ser validada.'), { statusCode: 422 });
      const checksum = createHash('sha256').update(artifact).digest('hex');
      const result = await db.query(`
        INSERT INTO agent_versions (tenant_id, version, platform, file_name, artifact, file_size, checksum_sha256)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (tenant_id, version, platform) DO UPDATE SET file_name = EXCLUDED.file_name,
          artifact = EXCLUDED.artifact, file_size = EXCLUDED.file_size, checksum_sha256 = EXCLUDED.checksum_sha256,
          active = true, created_at = now()
        RETURNING id, version, platform, file_name, file_size, checksum_sha256, active, created_at
      `, [request.auth.tenantId, version, input.platform, input.fileName, artifact, artifact.length, checksum]);
      return reply.code(201).send(result.rows[0]);
    });
  });

  app.get('/v1/integrations/zabbix/agent-versions/:id/download', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireIntegrationAccess(request);
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    return withTenant(request.auth.tenantId, async (db) => {
      const result = await db.query<{ artifact: Buffer; file_name: string; checksum_sha256: string }>(
        'SELECT artifact, file_name, checksum_sha256 FROM agent_versions WHERE id = $1 AND tenant_id = $2 AND active = true', [id, request.auth.tenantId]);
      const version = result.rows[0];
      if (!version) throw Object.assign(new Error('Versão do agente não encontrada.'), { statusCode: 404 });
      return reply.type('application/octet-stream').header('content-disposition', `attachment; filename="${version.file_name}"`).header('x-checksum-sha256', version.checksum_sha256).send(version.artifact);
    });
  });

  app.post('/v1/integrations/zabbix/mappings', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireIntegrationAccess(request);
    const input = z.object({ equipmentId: z.string().uuid(), zabbixHostId: z.string().min(1).max(100) }).parse(request.body);
    const result = await withTenant(request.auth.tenantId, async (db) => {
      const integrationId = await ensureZabbixIntegration(db, request.auth.tenantId);
      const equipment = await db.query('SELECT 1 FROM equipment WHERE id = $1 AND tenant_id = $2 AND active = true', [input.equipmentId, request.auth.tenantId]);
      if (!equipment.rows[0]) throw Object.assign(new Error('Equipamento não encontrado neste tenant.'), { statusCode: 404 });
      const previousHostMapping = await db.query<{ id: string; equipment_id: string }>(`
        SELECT id, equipment_id FROM zabbix_host_mappings
        WHERE tenant_id = $1 AND integration_id = $2 AND zabbix_host_id = $3
      `, [request.auth.tenantId, integrationId, input.zabbixHostId]);
      const previousEquipmentMapping = await db.query<{ id: string; zabbix_host_id: string }>(`
        SELECT id, zabbix_host_id FROM zabbix_host_mappings
        WHERE tenant_id = $1 AND integration_id = $2 AND equipment_id = $3
      `, [request.auth.tenantId, integrationId, input.equipmentId]);
      const currentHostMapping = previousHostMapping.rows[0];
      const currentEquipmentMapping = previousEquipmentMapping.rows[0];

      if (currentHostMapping?.equipment_id === input.equipmentId) {
        return { id: currentHostMapping.id, integration_id: integrationId, equipment_id: input.equipmentId, zabbix_host_id: input.zabbixHostId, change: 'unchanged' };
      }

      if (currentEquipmentMapping && currentEquipmentMapping.zabbix_host_id !== input.zabbixHostId) {
        await db.query('DELETE FROM zabbix_host_mappings WHERE id = $1 AND tenant_id = $2', [currentEquipmentMapping.id, request.auth.tenantId]);
      }
      const mapping = await db.query<{ id: string; integration_id: string; equipment_id: string; zabbix_host_id: string }>(`
        INSERT INTO zabbix_host_mappings (tenant_id, integration_id, equipment_id, zabbix_host_id)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (integration_id, zabbix_host_id) DO UPDATE SET equipment_id = EXCLUDED.equipment_id
        RETURNING id, integration_id, equipment_id, zabbix_host_id
      `, [request.auth.tenantId, integrationId, input.equipmentId, input.zabbixHostId]);
      const changedMapping = mapping.rows[0];
      const affectedEquipment = [input.equipmentId];
      if (currentHostMapping?.equipment_id && currentHostMapping.equipment_id !== input.equipmentId) affectedEquipment.push(currentHostMapping.equipment_id);
      await resetEquipmentTelemetry(db, request.auth.tenantId, affectedEquipment);
      await writeMappingAudit(db, request.auth.tenantId, request.auth.userId, currentHostMapping ? 'zabbix.mapping.changed' : 'zabbix.mapping.created', changedMapping.id, {
        zabbixHostId: input.zabbixHostId,
        equipmentId: input.equipmentId,
        previousEquipmentId: currentHostMapping?.equipment_id ?? null,
        displacedZabbixHostId: currentEquipmentMapping?.zabbix_host_id ?? null,
      });
      return { ...changedMapping, change: currentHostMapping ? 'changed' : 'created' };
    });
    return reply.code(201).send(result);
  });

  app.delete('/v1/integrations/zabbix/mappings/:zabbixHostId', { preHandler: [app.authenticate] }, async (request) => {
    requireIntegrationAccess(request);
    const { zabbixHostId } = z.object({ zabbixHostId: z.string().min(1).max(100) }).parse(request.params);
    return withTenant(request.auth.tenantId, async (db) => {
      const integrationId = await ensureZabbixIntegration(db, request.auth.tenantId);
      const removed = await db.query<{ id: string; equipment_id: string; zabbix_host_id: string }>(`
        DELETE FROM zabbix_host_mappings
        WHERE tenant_id = $1 AND integration_id = $2 AND zabbix_host_id = $3
        RETURNING id, equipment_id, zabbix_host_id
      `, [request.auth.tenantId, integrationId, zabbixHostId]);
      const mapping = removed.rows[0];
      if (!mapping) throw Object.assign(new Error('Vínculo Zabbix não encontrado neste tenant.'), { statusCode: 404 });
      await resetEquipmentTelemetry(db, request.auth.tenantId, [mapping.equipment_id]);
      await writeMappingAudit(db, request.auth.tenantId, request.auth.userId, 'zabbix.mapping.removed', mapping.id, {
        zabbixHostId: mapping.zabbix_host_id,
        equipmentId: mapping.equipment_id,
      });
      return { success: true, unlinked: true, zabbixHostId: mapping.zabbix_host_id, equipmentId: mapping.equipment_id };
    });
  });

  if (env.ZABBIX_API_URL && env.ZABBIX_API_TOKEN) {
    let fullSyncRunning = false;
    let telemetrySyncRunning = false;
    const listSchedulerTenants = () => database.query<{ tenant_id: string; user_id: string }>(`
      SELECT DISTINCT ON (ut.tenant_id) ut.tenant_id, ut.user_id
      FROM user_tenants ut
      JOIN user_role_assignments ura ON ura.user_id = ut.user_id AND ura.tenant_id = ut.tenant_id
      JOIN roles r ON r.id = ura.role_id
      WHERE ut.active = true AND r.code IN ('global_administrator', 'tenant_administrator')
      ORDER BY ut.tenant_id, CASE WHEN r.code = 'global_administrator' THEN 0 ELSE 1 END
    `);
    const runScheduledSync = async () => {
      if (fullSyncRunning) return;
      fullSyncRunning = true;
      try {
        const tenants = await listSchedulerTenants();
        for (const tenant of tenants.rows) {
          const token = await app.jwt.sign({ sub: tenant.user_id, tenantId: tenant.tenant_id, roles: ['global_administrator'] }, { expiresIn: Math.ceil(env.ZABBIX_SYNC_INTERVAL_MS / 1000) + 30 });
          const response = await fetch(`http://127.0.0.1:${env.PORT}/v1/integrations/zabbix/sync`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' });
          if (!response.ok) app.log.warn({ tenantId: tenant.tenant_id, status: response.status }, 'Zabbix scheduled sync failed');
        }
      } catch (error) {
        app.log.error(error, 'Zabbix scheduler error');
      } finally {
        fullSyncRunning = false;
      }
    };
    const runScheduledTelemetrySync = async () => {
      if (telemetrySyncRunning || fullSyncRunning) return;
      telemetrySyncRunning = true;
      try {
        const tenants = await listSchedulerTenants();
        for (const tenant of tenants.rows) {
          const token = await app.jwt.sign({ sub: tenant.user_id, tenantId: tenant.tenant_id, roles: ['global_administrator'] }, { expiresIn: Math.ceil(env.ZABBIX_TELEMETRY_INTERVAL_MS / 1000) + 30 });
          const response = await fetch(`http://127.0.0.1:${env.PORT}/v1/integrations/zabbix/telemetry-sync`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' });
          if (!response.ok) app.log.debug({ tenantId: tenant.tenant_id, status: response.status }, 'Zabbix telemetry sync unavailable');
        }
      } catch (error) {
        app.log.debug(error, 'Zabbix telemetry scheduler unavailable');
      } finally {
        telemetrySyncRunning = false;
      }
    };
    setTimeout(runScheduledSync, 5_000);
    setInterval(runScheduledSync, env.ZABBIX_SYNC_INTERVAL_MS);
    setTimeout(runScheduledTelemetrySync, 12_000);
    setInterval(runScheduledTelemetrySync, env.ZABBIX_TELEMETRY_INTERVAL_MS);
    app.log.info({ intervalMs: env.ZABBIX_SYNC_INTERVAL_MS }, 'Zabbix scheduler enabled');
    app.log.info({ intervalMs: env.ZABBIX_TELEMETRY_INTERVAL_MS }, 'Zabbix telemetry scheduler enabled');
  }
};
