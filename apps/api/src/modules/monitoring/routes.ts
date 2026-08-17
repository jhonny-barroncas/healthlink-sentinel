import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../../platform/database.js';
import { hasPermission, permission } from '../../platform/authorization.js';
import { ingestEvent, listEquipmentStatus, listLinkTelemetry, listUnitOperationalStatus, type MonitoringEventInput } from './repository.js';

const eventSchema = z.object({
  equipmentId: z.string().uuid().optional(), integrationId: z.string().uuid().optional(), externalEventId: z.string().max(200).optional(),
  eventKind: z.enum(['status', 'problem', 'recovery']), operationalStatus: z.enum(['online', 'degraded', 'offline', 'unknown']),
  severity: z.number().int().min(0).max(5).optional(), title: z.string().max(300).optional(), observedAt: z.string().datetime(), payload: z.record(z.string(), z.unknown()).optional(),
});

function requireMonitoring(request: { auth: { roles: string[] } }) {
  if (!hasPermission(request.auth.roles, permission.monitoringRead)) { const error = Object.assign(new Error('Permissão insuficiente.'), { statusCode: 403 }); throw error; }
}

export const monitoringRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/monitoring/equipment', { preHandler: [app.authenticate] }, async (request) => {
    requireMonitoring(request);
    return withTenant(request.auth.tenantId, (client) => listEquipmentStatus(client, request.auth.tenantId));
  });
  app.get('/v1/monitoring/units', { preHandler: [app.authenticate] }, async (request) => {
    requireMonitoring(request);
    return withTenant(request.auth.tenantId, (client) => listUnitOperationalStatus(client, request.auth.tenantId));
  });
  app.get('/v1/monitoring/link-telemetry', { preHandler: [app.authenticate] }, async (request) => {
    requireMonitoring(request);
    return withTenant(request.auth.tenantId, (client) => listLinkTelemetry(client, request.auth.tenantId));
  });
  app.get('/v1/monitoring/alerts', { preHandler: [app.authenticate] }, async (request) => {
    if (!hasPermission(request.auth.roles, permission.alertsRead)) { const error = Object.assign(new Error('PermissÃ£o insuficiente.'), { statusCode: 403 }); throw error; }
    const query = z.object({ status: z.enum(['open', 'acknowledged', 'resolved', 'suppressed']).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(request.query);
    return withTenant(request.auth.tenantId, async (client) => {
      const result = await client.query(`
        SELECT a.id, a.external_id, a.title, a.severity, a.status, a.opened_at, a.acknowledged_at, a.resolved_at,
               a.unit_id, hu.code AS unit_code, hu.name AS unit_name,
               a.equipment_id, e.name AS equipment_name,
               a.integration_id, a.raw_payload
        FROM alerts a
        LEFT JOIN health_units hu ON hu.id = a.unit_id AND hu.tenant_id = a.tenant_id
        LEFT JOIN equipment e ON e.id = a.equipment_id AND e.tenant_id = a.tenant_id
        WHERE a.tenant_id = $1 AND ($2::alert_status IS NULL OR a.status = $2::alert_status)
        ORDER BY CASE WHEN a.status IN ('open','acknowledged') THEN 0 ELSE 1 END, a.opened_at DESC
        LIMIT $3
      `, [request.auth.tenantId, query.status ?? null, query.limit]);
      return result.rows;
    });
  });
  app.post('/v1/monitoring/alerts/:id/acknowledge', { preHandler: [app.authenticate] }, async (request) => {
    if (!hasPermission(request.auth.roles, permission.alertsAcknowledge)) { const error = Object.assign(new Error('PermissÃ£o insuficiente.'), { statusCode: 403 }); throw error; }
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    return withTenant(request.auth.tenantId, async (client) => {
      const result = await client.query(`UPDATE alerts SET status = 'acknowledged', acknowledged_at = now(), acknowledged_by = $1 WHERE id = $2 AND tenant_id = $3 AND status = 'open' RETURNING id, status, acknowledged_at`, [request.auth.userId, id, request.auth.tenantId]);
      if (!result.rows[0]) throw Object.assign(new Error('Alerta não encontrado ou já processado.'), { statusCode: 404 });
      await client.query(`INSERT INTO alert_events (tenant_id, alert_id, event_type, actor_user_id, payload) VALUES ($1,$2,'acknowledged',$3,'{}')`, [request.auth.tenantId, id, request.auth.userId]);
      return result.rows[0];
    });
  });
  app.post('/v1/monitoring/alerts/:id/resolve', { preHandler: [app.authenticate] }, async (request) => {
    if (!hasPermission(request.auth.roles, permission.alertsAcknowledge)) { const error = Object.assign(new Error('PermissÃ£o insuficiente.'), { statusCode: 403 }); throw error; }
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    return withTenant(request.auth.tenantId, async (client) => {
      const result = await client.query(`UPDATE alerts SET status = 'resolved', resolved_at = now() WHERE id = $1 AND tenant_id = $2 AND status <> 'resolved' RETURNING id, status, resolved_at`, [id, request.auth.tenantId]);
      if (!result.rows[0]) throw Object.assign(new Error('Alerta não encontrado ou já resolvido.'), { statusCode: 404 });
      await client.query(`INSERT INTO alert_events (tenant_id, alert_id, event_type, actor_user_id, payload) VALUES ($1,$2,'resolved',$3,'{}')`, [request.auth.tenantId, id, request.auth.userId]);
      return result.rows[0];
    });
  });
  app.post('/v1/monitoring/events', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!hasPermission(request.auth.roles, permission.integrationsManage)) { const error = Object.assign(new Error('Permissão insuficiente.'), { statusCode: 403 }); throw error; }
    const input = eventSchema.parse(request.body) as MonitoringEventInput;
    const result = await withTenant(request.auth.tenantId, (client) => ingestEvent(client, request.auth.tenantId, input));
    return reply.code(result.duplicate ? 200 : 201).send(result);
  });
};
