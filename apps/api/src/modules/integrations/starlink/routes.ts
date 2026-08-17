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

  app.post('/v1/integrations/starlink/telemetry', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireAccess(request);
    const input = ingestSchema.parse(request.body);
    const observedAt = input.observedAt ?? new Date().toISOString();
    const samples = normalizeStarlinkPayload(input.payload, observedAt);
    if (!samples.length) return reply.code(422).send({ error: 'Nenhuma métrica Starlink reconhecida; dados ausentes permanecem N/D.' });
    return withTenant(request.auth.tenantId, async (db) => {
      const ownership = await db.query(`SELECT 1 FROM equipment e JOIN equipment_types et ON et.id = e.equipment_type_id WHERE e.id = $1 AND e.tenant_id = $2 AND e.active = true AND et.code = 'starlink'`, [input.equipmentId, request.auth.tenantId]);
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
      const status = deriveStarlinkStatus(samples);
      await db.query(`INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at, source_payload = EXCLUDED.source_payload`, [input.equipmentId, request.auth.tenantId, status, observedAt, { source: `starlink_${input.source}`, sampleCount: samples.length }]);
      return { equipmentId: input.equipmentId, source: input.source satisfies StarlinkSource, samplesPersisted, operationalStatus: status, observedAt, batchId: input.batchId ?? null };
    });
  });
};
