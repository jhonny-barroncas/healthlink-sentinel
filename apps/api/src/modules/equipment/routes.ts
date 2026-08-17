import type { FastifyPluginAsync } from 'fastify';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { hasPermission, permission } from '../../platform/authorization.js';
import { withTenant } from '../../platform/database.js';
import { createEquipment, deactivateEquipment, deleteEquipment, listEquipment, updateEquipment, writeEquipmentAudit, type EquipmentInput } from './repository.js';

const paramsSchema = z.object({ unitId: z.string().uuid() });
const equipmentParamsSchema = z.object({ id: z.string().uuid() });
const equipmentSchema = z.object({
  equipmentTypeCode: z.enum(['linux_server', 'mikrotik', 'starlink', 'vpn', 'internet_link']),
  name: z.string().trim().min(2).max(150),
  serialNumber: z.string().trim().max(120).optional(),
  managementAddress: z.string().trim().max(120).optional(),
  contractedDownloadMbps: z.number().positive().max(1_000_000).optional(),
  contractedUploadMbps: z.number().positive().max(1_000_000).optional(),
});
const execFileAsync = promisify(execFile);
const diagnosticSchema = z.object({ action: z.enum(['ping', 'tracert']) });

function parsePingLatency(output: string): number | undefined {
  const average = output.match(/(?:m[eé]dia|average)\s*[=:]\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  if (average) {
    const value = Number(average[1].replace(',', '.'));
    if (Number.isFinite(value)) return value;
  }
  const values = [...output.matchAll(/(\d+(?:[.,]\d+)?)\s*ms/gi)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return values.at(-1);
}

function requireEquipmentPermission(request: { auth: { roles: string[] } }, required: typeof permission.unitsManage | typeof permission.monitoringRead): void {
  if (!hasPermission(request.auth.roles, required)) {
    const error = new Error('Permissão insuficiente.') as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }
}

export const equipmentRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/equipment/:id/diagnostics', { preHandler: [app.authenticate] }, async (request) => {
    requireEquipmentPermission(request, permission.monitoringRead);
    const { id } = equipmentParamsSchema.parse(request.params);
    const { action } = diagnosticSchema.parse(request.body);
    const result = await withTenant(request.auth.tenantId, (client) => client.query<{ management_address: string | null; name: string }>(
      'SELECT management_address, name FROM equipment WHERE id = $1 AND tenant_id = $2 AND active = true', [id, request.auth.tenantId]));
    const equipment = result.rows[0];
    if (!equipment) throw Object.assign(new Error('Equipamento não encontrado.'), { statusCode: 404 });
    const target = equipment.management_address?.trim();
    if (!target || !/^[a-zA-Z0-9._:-]+$/.test(target)) throw Object.assign(new Error('O equipamento não possui um endereço de gerenciamento válido.'), { statusCode: 422 });
    const command = process.platform === 'win32' ? (action === 'ping' ? 'ping' : 'tracert') : (action === 'ping' ? 'ping' : 'traceroute');
    const args = action === 'ping' ? (process.platform === 'win32' ? ['-n', '4', target] : ['-c', '4', target]) : (process.platform === 'win32' ? ['-h', '12', '-w', '1000', target] : ['-m', '12', '-w', '1', target]);
    try {
      const output = await execFileAsync(command, args, { timeout: 15000, windowsHide: true, maxBuffer: 128 * 1024 });
      const text = output.stdout || output.stderr;
      return { action, target, success: true, output: text, latencyMs: action === 'ping' ? parsePingLatency(text) : undefined };
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; code?: string | number };
      const text = failure.stdout || failure.stderr || 'Falha ao executar o diagnóstico.';
      return { action, target, success: false, output: text, code: failure.code ?? 'diagnostic_failed', latencyMs: action === 'ping' ? parsePingLatency(text) : undefined };
    }
  });
  app.get('/v1/units/:unitId/equipment', { preHandler: [app.authenticate] }, async (request) => {
    requireEquipmentPermission(request, permission.monitoringRead);
    const { unitId } = paramsSchema.parse(request.params);
    return withTenant(request.auth.tenantId, (client) => listEquipment(client, request.auth.tenantId, unitId));
  });

  app.post('/v1/units/:unitId/equipment', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireEquipmentPermission(request, permission.unitsManage);
    const { unitId } = paramsSchema.parse(request.params);
    const input = equipmentSchema.parse(request.body) as EquipmentInput;
    let equipment;
    try {
      equipment = await withTenant(request.auth.tenantId, async (client) => {
        const created = await createEquipment(client, request.auth.tenantId, unitId, input);
        await writeEquipmentAudit(client, request.auth.tenantId, request.auth.userId, 'equipment.created', created.id);
        return created;
      });
    } catch (error) {
      if ((error as { code?: string; constraint?: string }).code === '23505' && (error as { constraint?: string }).constraint?.includes('serial')) {
        throw Object.assign(new Error('Este número de série já está cadastrado neste cliente. Deixe o campo vazio ou informe outro número.'), { statusCode: 409 });
      }
      throw error;
    }
    return reply.code(201).send(equipment);
  });

  app.patch('/v1/equipment/:id', { preHandler: [app.authenticate] }, async (request) => {
    requireEquipmentPermission(request, permission.unitsManage);
    const { id } = equipmentParamsSchema.parse(request.params);
    const input = equipmentSchema.parse(request.body) as EquipmentInput;
    const equipment = await withTenant(request.auth.tenantId, async (client) => {
      const updated = await updateEquipment(client, request.auth.tenantId, id, input);
      if (updated) await writeEquipmentAudit(client, request.auth.tenantId, request.auth.userId, 'equipment.updated', id);
      return updated;
    });
    if (!equipment) throw Object.assign(new Error('Equipamento não encontrado.'), { statusCode: 404 });
    return equipment;
  });

  app.delete('/v1/equipment/:id', { preHandler: [app.authenticate] }, async (request) => {
    requireEquipmentPermission(request, permission.unitsManage);
    const { id } = equipmentParamsSchema.parse(request.params);
    const deactivated = await withTenant(request.auth.tenantId, async (client) => {
      const changed = await deactivateEquipment(client, request.auth.tenantId, id);
      if (changed) await writeEquipmentAudit(client, request.auth.tenantId, request.auth.userId, 'equipment.deactivated', id);
      return changed;
    });
    if (!deactivated) throw Object.assign(new Error('Equipamento não encontrado ou já desativado.'), { statusCode: 404 });
    return { success: true, deactivated: true };
  });

  app.delete('/v1/equipment/:id/permanent', { preHandler: [app.authenticate] }, async (request) => {
    requireEquipmentPermission(request, permission.unitsManage);
    const { id } = equipmentParamsSchema.parse(request.params);
    const deleted = await withTenant(request.auth.tenantId, async (client) => {
      const changed = await deleteEquipment(client, request.auth.tenantId, id);
      if (changed) await writeEquipmentAudit(client, request.auth.tenantId, request.auth.userId, 'equipment.deleted', id);
      return changed;
    });
    if (!deleted) throw Object.assign(new Error('Equipamento não encontrado.'), { statusCode: 404 });
    return { success: true, deleted: true };
  });
};
