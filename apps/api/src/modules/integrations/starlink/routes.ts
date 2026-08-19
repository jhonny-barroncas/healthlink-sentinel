import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../../../platform/database.js';
import { hasPermission, permission } from '../../../platform/authorization.js';
import { deriveStarlinkStatus, normalizeStarlinkPayload, type StarlinkSource } from './telemetry.js';

const sourceSchema = z.object({ sourceKind: z.enum(['official_api', 'local_agent', 'zabbix']), endpoint: z.string().url().optional().nullable(), enabled: z.boolean().default(true), metadata: z.record(z.string(), z.unknown()).default({}) });
const ingestSchema = z.object({ equipmentId: z.string().uuid(), source: z.enum(['official_api', 'local_agent', 'zabbix']), observedAt: z.string().datetime().optional(), batchId: z.string().uuid().optional(), payload: z.record(z.string(), z.unknown()) });

function requireAccess(request: { auth: { roles: string[] } }) {
  if (!hasPermission(request.auth.roles, permission.integrationsManage)) throw Object.assign(new Error('Permissão insuficiente.'), { statusCode: 403 });
}

function requireRead(request: { auth: { roles: string[] } }) {
  if (!hasPermission(request.auth.roles, permission.monitoringRead)) throw Object.assign(new Error('Permissão insuficiente.'), { statusCode: 403 });
}

export const starlinkRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/integrations/starlink/sources', { preHandler: [app.authenticate] }, async (request) => {
    requireAccess(request);
    return withTenant(request.auth.tenantId, async (db) => {
      const result = await db.query(`SELECT s.id, s.equipment_id, e.name AS equipment_name, s.source_kind, s.endpoint, s.enabled, s.metadata, s.updated_at FROM starlink_telemetry_sources s JOIN equipment e ON e.id = s.equipment_id AND e.tenant_id = s.tenant_id WHERE s.tenant_id = $1 ORDER BY e.name`, [request.auth.tenantId]);
      return result.rows;
    });
  });

  app.put('/v1/integrations/starlink/sources/:equipmentId', { preHandler: [app.authenticate] }, async (request) => {
    requireAccess(request);
    const equipmentId = z.string().uuid().parse((request.params as { equipmentId: string }).equipmentId);
    const input = sourceSchema.parse(request.body);
    return withTenant(request.auth.tenantId, async (db) => {
      const equipment = await db.query(`SELECT 1 FROM equipment e JOIN equipment_types et ON et.id = e.equipment_type_id WHERE e.id = $1 AND e.tenant_id = $2 AND e.active = true AND et.code = 'starlink'`, [equipmentId, request.auth.tenantId]);
      if (!equipment.rows[0]) throw Object.assign(new Error('Equipamento Starlink não encontrado neste tenant.'), { statusCode: 404 });
      const result = await db.query(`INSERT INTO starlink_telemetry_sources (tenant_id, equipment_id, source_kind, endpoint, enabled, metadata) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id, equipment_id) DO UPDATE SET source_kind = EXCLUDED.source_kind, endpoint = EXCLUDED.endpoint, enabled = EXCLUDED.enabled, metadata = EXCLUDED.metadata, updated_at = now() RETURNING id, equipment_id, source_kind, endpoint, enabled, metadata, updated_at`, [request.auth.tenantId, equipmentId, input.sourceKind, input.endpoint ?? null, input.enabled, input.metadata]);
      return result.rows[0];
    });
  });

  app.get('/v1/integrations/starlink/telemetry/:equipmentId', { preHandler: [app.authenticate] }, async (request) => {
    requireRead(request);
    const equipmentId = z.string().uuid().parse((request.params as { equipmentId: string }).equipmentId);
    return withTenant(request.auth.tenantId, async (db) => {
      const equipment = await db.query<{ id: string; name: string; equipment_type: string }>(`
        SELECT e.id, e.name, et.code AS equipment_type
        FROM equipment e JOIN equipment_types et ON et.id = e.equipment_type_id
        WHERE e.id = $1 AND e.tenant_id = $2 AND e.active = true AND et.code = 'starlink'
      `, [equipmentId, request.auth.tenantId]);
      if (!equipment.rows[0]) throw Object.assign(new Error('Equipamento Starlink não encontrado neste tenant.'), { statusCode: 404 });
      const samples = await db.query<{ metric_key: string; value: number; unit: string; observed_at: string }>(`
        SELECT DISTINCT ON (metric_key) metric_key, value, unit, observed_at
        FROM metric_samples
        WHERE tenant_id = $1 AND equipment_id = $2
        ORDER BY metric_key, observed_at DESC
      `, [request.auth.tenantId, equipmentId]);
      const observedAt = samples.rows.reduce<string | null>((latest, sample) => !latest || sample.observed_at > latest ? sample.observed_at : latest, null);
      const collectorStale = !observedAt || Date.now() - new Date(observedAt).getTime() > 30_000;
      return {
        equipmentId,
        equipmentName: equipment.rows[0].name,
        observedAt,
        collectorStatus: collectorStale ? 'offline' : 'online',
        collectorError: collectorStale ? 'Agente Starlink sem comunicação há mais de 30 segundos. Verifique se o serviço está em execução e se a antena está acessível.' : null,
        metrics: samples.rows,
      };
    });
  });

  app.get('/v1/monitoring/agents', { preHandler: [app.authenticate] }, async (request) => {
    requireRead(request);
    return withTenant(request.auth.tenantId, async (db) => {
      const result = await db.query(`
        SELECT hu.id AS unit_id, hu.code AS unit_code, hu.name AS unit_name, hu.city, hu.state_code,
               e.name AS equipment_name, s.metadata->>'version' AS version, latest.observed_at,
               CASE WHEN s.id IS NULL THEN 'unlinked'
                    WHEN latest.observed_at IS NOT NULL AND latest.observed_at >= now() - interval '30 seconds' THEN 'online'
                    ELSE 'offline' END AS status
        FROM health_units hu
        LEFT JOIN equipment e ON e.unit_id = hu.id AND e.tenant_id = hu.tenant_id AND e.active = true
          AND EXISTS (SELECT 1 FROM equipment_types et WHERE et.id = e.equipment_type_id AND et.code = 'starlink')
        LEFT JOIN starlink_telemetry_sources s ON s.equipment_id = e.id AND s.tenant_id = hu.tenant_id
          AND s.source_kind = 'local_agent' AND s.enabled = true
        LEFT JOIN LATERAL (
          SELECT MAX(ms.observed_at) AS observed_at FROM metric_samples ms
          WHERE ms.equipment_id = e.id AND ms.tenant_id = hu.tenant_id
        ) latest ON true
        WHERE hu.tenant_id = $1 AND hu.active = true
        ORDER BY hu.code
      `, [request.auth.tenantId]);
      return result.rows;
    });
  });

  app.post('/v1/integrations/starlink/telemetry', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireAccess(request);
    const input = ingestSchema.parse(request.body);
    const observedAt = input.observedAt ?? new Date().toISOString();
    const samples = normalizeStarlinkPayload(input.payload, observedAt);
    if (!samples.length) return reply.code(422).send({ error: 'Nenhuma métrica Starlink reconhecida; dados ausentes permanecem N/D.' });
    return withTenant(request.auth.tenantId, async (db) => {
      const ownership = await db.query<{ unit_id: string }>(`SELECT e.unit_id FROM equipment e JOIN equipment_types et ON et.id = e.equipment_type_id WHERE e.id = $1 AND e.tenant_id = $2 AND e.active = true AND et.code = 'starlink'`, [input.equipmentId, request.auth.tenantId]);
      if (!ownership.rows[0]) throw Object.assign(new Error('Equipamento Starlink não encontrado neste tenant.'), { statusCode: 404 });
      let samplesPersisted = 0;
      for (const sample of samples) {
        const sourcePayload = { source: `starlink_${input.source}`, provider: input.source, ...(input.batchId ? { batchId: input.batchId } : {}) };
        if (input.batchId) {
          const duplicate = await db.query(`SELECT 1 FROM metric_samples WHERE tenant_id = $1 AND equipment_id = $2 AND metric_key = $3 AND observed_at = $4 AND source_payload->>'batchId' = $5 LIMIT 1`, [request.auth.tenantId, input.equipmentId, sample.metricKey, sample.observedAt, input.batchId]);
          if (duplicate.rows[0]) continue;
        }
        await db.query(`INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [request.auth.tenantId, input.equipmentId, sample.metricKey, sample.value, sample.unit, sample.observedAt, sourcePayload]);
        samplesPersisted += 1;
      }
      const latitude = samples.find((sample) => sample.metricKey === 'starlink.location.latitude')?.value;
      const longitude = samples.find((sample) => sample.metricKey === 'starlink.location.longitude')?.value;
      if (latitude !== undefined && longitude !== undefined) {
        await db.query(`UPDATE health_units SET latitude = $1, longitude = $2, updated_at = now() WHERE id = $3 AND tenant_id = $4 AND latitude IS NULL AND longitude IS NULL`, [latitude, longitude, ownership.rows[0].unit_id, request.auth.tenantId]);
      }
      const status = deriveStarlinkStatus(samples);
      await db.query(`INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at, source_payload = EXCLUDED.source_payload`, [input.equipmentId, request.auth.tenantId, status, observedAt, { source: `starlink_${input.source}`, sampleCount: samples.length }]);
      return { equipmentId: input.equipmentId, source: input.source satisfies StarlinkSource, samplesPersisted, operationalStatus: status, observedAt, batchId: input.batchId ?? null };
    });
  });
};
