import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTenant } from '../../platform/database.js';
import { canOnlySeeMobileUnits, hasPermission, permission } from '../../platform/authorization.js';
import { createHealthUnit, deactivateHealthUnit, getHealthUnit, listHealthUnits, updateHealthUnit, writeUnitAudit, type HealthUnitInput } from './repository.js';

const unitSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(150),
  stateCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  city: z.string().trim().min(2).max(120),
  unitType: z.enum(['mobile', 'fixed']).default('mobile'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

function requirePermission(request: { auth: { roles: string[] } }, required: typeof permission.unitsManage | typeof permission.unitsRead): void {
  if (!hasPermission(request.auth.roles, required)) {
    const error = new Error('Permissão insuficiente.') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }
}

export const unitRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/units', { preHandler: [app.authenticate] }, async (request) => {
    requirePermission(request, permission.unitsRead);
    const tenantId = request.auth.tenantId;
    return withTenant(tenantId, (client) => listHealthUnits(client, tenantId, canOnlySeeMobileUnits(request.auth.roles)));
  });

  app.get('/v1/units/:id', { preHandler: [app.authenticate] }, async (request) => {
    requirePermission(request, permission.unitsRead);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const unit = await withTenant(request.auth.tenantId, (client) => getHealthUnit(client, request.auth.tenantId, params.id));
    if (!unit || (canOnlySeeMobileUnits(request.auth.roles) && unit.unit_type !== 'mobile')) {
      const error = new Error('Unidade não encontrada.') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return unit;
  });

  app.post('/v1/units', { preHandler: [app.authenticate] }, async (request, reply) => {
    requirePermission(request, permission.unitsManage);
    const input = unitSchema.parse(request.body) as HealthUnitInput;
    const unit = await withTenant(request.auth.tenantId, async (client) => {
      const created = await createHealthUnit(client, request.auth.tenantId, input);
      await writeUnitAudit(client, request.auth.tenantId, request.auth.userId, 'health_unit.created', created.id);
      return created;
    });
    return reply.code(201).send(unit);
  });

  app.patch('/v1/units/:id', { preHandler: [app.authenticate] }, async (request) => {
    requirePermission(request, permission.unitsManage);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const input = unitSchema.parse(request.body) as HealthUnitInput;
    const unit = await withTenant(request.auth.tenantId, async (client) => {
      const updated = await updateHealthUnit(client, request.auth.tenantId, params.id, input);
      if (updated) await writeUnitAudit(client, request.auth.tenantId, request.auth.userId, 'health_unit.updated', params.id);
      return updated;
    });
    if (!unit) {
      const error = new Error('Unidade não encontrada.') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return unit;
  });

  app.delete('/v1/units/:id', { preHandler: [app.authenticate] }, async (request) => {
    requirePermission(request, permission.unitsManage);
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const deactivated = await withTenant(request.auth.tenantId, async (client) => {
      const changed = await deactivateHealthUnit(client, request.auth.tenantId, params.id);
      if (changed) await writeUnitAudit(client, request.auth.tenantId, request.auth.userId, 'health_unit.deactivated', params.id);
      return changed;
    });
    if (!deactivated) {
      const error = new Error('Unidade não encontrada ou já desativada.') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    return { success: true, deactivated: true };
  });
};
