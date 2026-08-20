import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hasPermission, permission } from '../../../platform/authorization.js';
import { withTenant } from '../../../platform/database.js';
import { env } from '../../../platform/env.js';
import { deriveStarlinkStatus, normalizeStarlinkPayload } from '../starlink/telemetry.js';
import { renderLinuxInstaller, renderWindowsInstaller } from './installers.js';
import { validateEnrollment } from './lifecycle.js';
import {
  AGENT_SOURCE_TYPES,
  AGENT_SERVER_TYPES,
  collectionAgentInstallerFileName,
  createAgentCredential,
  createEnrollmentToken,
  hashAgentSecret,
  isDeployableAgentArtifact,
  parseAgentCredential,
  parseEnrollmentToken,
  resolveAgentApiUrl,
} from './provisioning.js';

type AgentAuthContext = {
  agentId: string;
  tenantId: string;
  unitId: string;
  serverEquipmentId: string;
  platform: 'windows' | 'linux';
};

declare module 'fastify' {
  interface FastifyRequest { collectionAgentAuth?: AgentAuthContext }
}

const enrollmentSchema = z.object({ token: z.string().min(80) });
const heartbeatSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), platform: z.enum(['windows', 'linux']) });
const telemetrySchema = z.object({
  equipmentId: z.string().uuid(),
  source: z.literal('local_agent'),
  observedAt: z.string().datetime().optional(),
  batchId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
});
const installerSchema = z.object({
  serverEquipmentId: z.string().uuid(),
  platform: z.enum(['windows', 'linux']),
});

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function requireUserAccess(request: { auth: { roles: string[] } }, required: typeof permission.integrationsManage | typeof permission.monitoringRead) {
  if (!hasPermission(request.auth.roles, required)) throw httpError('Permissão insuficiente.', 403);
}

function bearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function requiredAgentAuth(request: FastifyRequest): AgentAuthContext {
  if (!request.collectionAgentAuth) throw httpError('Credencial do agente ausente.', 401);
  return request.collectionAgentAuth;
}

export const collectionAgentRoutes: FastifyPluginAsync = async (app) => {
  const authenticateCollectionAgent = async (request: FastifyRequest) => {
    const parsed = parseAgentCredential(bearerToken(request) ?? '');
    if (!parsed) throw httpError('Credencial do agente inválida.', 401);
    const agent = await withTenant(parsed.tenantId, async (db) => {
      const result = await db.query<{
        id: string;
        tenant_id: string;
        unit_id: string;
        server_equipment_id: string;
        platform: 'windows' | 'linux';
        credential_hash: string | null;
      }>(`
        SELECT id, tenant_id, unit_id, server_equipment_id, platform, credential_hash
        FROM collection_agents
        WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND revoked_at IS NULL
      `, [parsed.agentId, parsed.tenantId]);
      return result.rows[0];
    });
    if (!agent?.credential_hash || agent.credential_hash !== hashAgentSecret(parsed.secret)) throw httpError('Credencial do agente inválida ou revogada.', 401);
    request.collectionAgentAuth = {
      agentId: agent.id,
      tenantId: agent.tenant_id,
      unitId: agent.unit_id,
      serverEquipmentId: agent.server_equipment_id,
      platform: agent.platform,
    };
  };

  app.post('/v1/collection-agents/enroll', async (request) => {
    const input = enrollmentSchema.parse(request.body);
    const parsed = parseEnrollmentToken(input.token);
    if (!parsed) throw httpError('Enrollment inválido.', 401);
    return withTenant(parsed.tenantId, async (db) => {
      const enrollmentResult = await db.query<{
        id: string;
        agent_id: string;
        token_hash: string;
        expires_at: string;
        consumed_at: string | null;
        revoked_at: string | null;
      }>(`
        SELECT id, agent_id, token_hash, expires_at, consumed_at, revoked_at
        FROM collection_agent_enrollments
        WHERE id = $1 AND tenant_id = $2
        FOR UPDATE
      `, [parsed.enrollmentId, parsed.tenantId]);
      const enrollment = enrollmentResult.rows[0];
      if (!enrollment) throw httpError('Enrollment inválido.', 401);
      const validation = validateEnrollment({
        tokenHash: enrollment.token_hash,
        expiresAt: enrollment.expires_at,
        consumedAt: enrollment.consumed_at,
        revokedAt: enrollment.revoked_at,
      }, parsed.secret);
      if (!validation.valid) {
        const message = validation.reason === 'expired' ? 'O instalador expirou. Gere um novo arquivo no HealthLink.'
          : validation.reason === 'consumed' ? 'Este instalador já foi utilizado.'
            : validation.reason === 'revoked' ? 'Este instalador foi revogado.' : 'Enrollment inválido.';
        throw httpError(message, validation.reason === 'expired' ? 410 : 401);
      }

      const agentResult = await db.query<{
        id: string;
        unit_id: string;
        server_equipment_id: string;
        platform: 'windows' | 'linux';
        desired_version: string;
      }>(`
        SELECT id, unit_id, server_equipment_id, platform, desired_version
        FROM collection_agents
        WHERE id = $1 AND tenant_id = $2 AND status <> 'revoked'
        FOR UPDATE
      `, [enrollment.agent_id, parsed.tenantId]);
      const agent = agentResult.rows[0];
      if (!agent) throw httpError('Agente não está mais disponível para instalação.', 410);
      const credential = createAgentCredential(parsed.tenantId, agent.id);
      await db.query(`
        UPDATE collection_agents
        SET credential_hash = $1, status = 'active', enrolled_at = COALESCE(enrolled_at, now()),
            revoked_at = NULL, updated_at = now()
        WHERE id = $2 AND tenant_id = $3
      `, [hashAgentSecret(credential.secret), agent.id, parsed.tenantId]);
      await db.query('UPDATE collection_agent_enrollments SET consumed_at = now() WHERE id = $1 AND tenant_id = $2', [enrollment.id, parsed.tenantId]);
      const assignments = await db.query<{
        equipment_id: string;
        equipment_name: string;
        equipment_type: string;
        management_address: string | null;
      }>(`
        SELECT e.id AS equipment_id, e.name AS equipment_name, et.code AS equipment_type,
               host(e.management_address) AS management_address
        FROM collection_agent_assignments a
        JOIN equipment e ON e.id = a.equipment_id AND e.tenant_id = a.tenant_id AND e.active = true
        JOIN equipment_types et ON et.id = e.equipment_type_id
        WHERE a.agent_id = $1 AND a.tenant_id = $2 AND a.active = true
        ORDER BY e.name
      `, [agent.id, parsed.tenantId]);
      return {
        agentId: agent.id,
        tenantId: parsed.tenantId,
        unitId: agent.unit_id,
        serverEquipmentId: agent.server_equipment_id,
        platform: agent.platform,
        version: agent.desired_version,
        credential: credential.token,
        assignments: assignments.rows.map((item) => ({
          equipmentId: item.equipment_id,
          name: item.equipment_name,
          type: item.equipment_type,
          managementAddress: item.management_address,
        })),
      };
    });
  });

  app.get('/v1/collection-agents/config', { preHandler: [authenticateCollectionAgent] }, async (request) => {
    const auth = requiredAgentAuth(request);
    return withTenant(auth.tenantId, async (db) => {
      const assignments = await db.query(`
        SELECT e.id AS "equipmentId", e.name, et.code AS type, host(e.management_address) AS "managementAddress"
        FROM collection_agent_assignments a
        JOIN equipment e ON e.id = a.equipment_id AND e.tenant_id = a.tenant_id AND e.active = true
        JOIN equipment_types et ON et.id = e.equipment_type_id
        WHERE a.agent_id = $1 AND a.tenant_id = $2 AND a.active = true
        ORDER BY e.name
      `, [auth.agentId, auth.tenantId]);
      return { agentId: auth.agentId, unitId: auth.unitId, serverEquipmentId: auth.serverEquipmentId, platform: auth.platform, assignments: assignments.rows };
    });
  });

  app.post('/v1/collection-agents/heartbeat', { preHandler: [authenticateCollectionAgent] }, async (request) => {
    const auth = requiredAgentAuth(request);
    const input = heartbeatSchema.parse(request.body);
    if (input.platform !== auth.platform) throw httpError('A plataforma informada não corresponde ao agente provisionado.', 422);
    return withTenant(auth.tenantId, async (db) => {
      await db.query(`
        UPDATE collection_agents
        SET installed_version = $1, last_heartbeat_at = now(), status = 'active', updated_at = now()
        WHERE id = $2 AND tenant_id = $3
      `, [input.version, auth.agentId, auth.tenantId]);
      return { ok: true, agentId: auth.agentId, serverTime: new Date().toISOString() };
    });
  });

  app.post('/v1/collection-agents/telemetry', { preHandler: [authenticateCollectionAgent] }, async (request, reply) => {
    const auth = requiredAgentAuth(request);
    const input = telemetrySchema.parse(request.body);
    const observedAt = input.observedAt ?? new Date().toISOString();
    const samples = normalizeStarlinkPayload(input.payload, observedAt);
    if (!samples.length) return reply.code(422).send({ error: 'Nenhuma métrica Starlink reconhecida; dados ausentes permanecem N/D.' });
    return withTenant(auth.tenantId, async (db) => {
      const assignment = await db.query<{ unit_id: string }>(`
        SELECT e.unit_id
        FROM collection_agent_assignments a
        JOIN equipment e ON e.id = a.equipment_id AND e.tenant_id = a.tenant_id AND e.active = true
        JOIN equipment_types et ON et.id = e.equipment_type_id
        WHERE a.agent_id = $1 AND a.tenant_id = $2 AND a.equipment_id = $3
          AND a.active = true AND et.code = 'starlink' AND e.unit_id = $4
      `, [auth.agentId, auth.tenantId, input.equipmentId, auth.unitId]);
      if (!assignment.rows[0]) throw httpError('Equipamento Starlink não está atribuído a este agente.', 403);
      const batch = await db.query(`
        INSERT INTO collection_agent_batches (agent_id, tenant_id, batch_id, equipment_id)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (agent_id, batch_id) DO NOTHING
        RETURNING batch_id
      `, [auth.agentId, auth.tenantId, input.batchId, input.equipmentId]);
      if (!batch.rows[0]) return { duplicate: true, batchId: input.batchId, samplesPersisted: 0 };
      for (const sample of samples) {
        await db.query(`
          INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [auth.tenantId, input.equipmentId, sample.metricKey, sample.value, sample.unit, sample.observedAt,
          { source: 'starlink_local_agent', provider: 'local_agent', agentId: auth.agentId, batchId: input.batchId }]);
      }
      const latitude = samples.find((sample) => sample.metricKey === 'starlink.location.latitude')?.value;
      const longitude = samples.find((sample) => sample.metricKey === 'starlink.location.longitude')?.value;
      if (latitude !== undefined && longitude !== undefined) {
        await db.query(`
          UPDATE health_units SET latitude = $1, longitude = $2, updated_at = now()
          WHERE id = $3 AND tenant_id = $4 AND latitude IS NULL AND longitude IS NULL
        `, [latitude, longitude, auth.unitId, auth.tenantId]);
      }
      const status = deriveStarlinkStatus(samples);
      await db.query(`
        INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status,
          observed_at = EXCLUDED.observed_at, source_payload = EXCLUDED.source_payload
      `, [input.equipmentId, auth.tenantId, status, observedAt, { source: 'starlink_local_agent', agentId: auth.agentId, sampleCount: samples.length }]);
      await db.query(`
        UPDATE collection_agents SET last_heartbeat_at = now(), last_collection_at = $1, updated_at = now()
        WHERE id = $2 AND tenant_id = $3
      `, [observedAt, auth.agentId, auth.tenantId]);
      return { duplicate: false, batchId: input.batchId, equipmentId: input.equipmentId, samplesPersisted: samples.length, operationalStatus: status, observedAt };
    });
  });

  app.get('/v1/collection-agents/releases', { preHandler: [authenticateCollectionAgent] }, async (request) => {
    const auth = requiredAgentAuth(request);
    return withTenant(auth.tenantId, async (db) => {
      const result = await db.query(`
        SELECT id, version, platform, file_name, file_size, checksum_sha256, active, created_at
        FROM agent_versions
        WHERE tenant_id = $1 AND platform = $2 AND active = true
        ORDER BY string_to_array(version, '.')::int[] DESC, created_at DESC
      `, [auth.tenantId, auth.platform]);
      return result.rows;
    });
  });

  app.get('/v1/collection-agents/releases/:id/download', { preHandler: [authenticateCollectionAgent] }, async (request, reply) => {
    const auth = requiredAgentAuth(request);
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    return withTenant(auth.tenantId, async (db) => {
      const result = await db.query<{ artifact: Buffer; file_name: string; checksum_sha256: string }>(`
        SELECT artifact, file_name, checksum_sha256 FROM agent_versions
        WHERE id = $1 AND tenant_id = $2 AND platform = $3 AND active = true
      `, [id, auth.tenantId, auth.platform]);
      const release = result.rows[0];
      if (!release) throw httpError('Versão do agente não encontrada para esta plataforma.', 404);
      return reply.type('application/octet-stream')
        .header('content-disposition', `attachment; filename="${release.file_name.replace(/["\r\n]/g, '')}"`)
        .header('x-checksum-sha256', release.checksum_sha256)
        .send(release.artifact);
    });
  });

  app.post('/v1/units/:unitId/collection-agents/installer', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireUserAccess(request, permission.integrationsManage);
    const unitId = z.string().uuid().parse((request.params as { unitId: string }).unitId);
    const input = installerSchema.parse(request.body);
    const forwardedProtocol = request.headers['x-forwarded-proto'];
    const apiUrl = resolveAgentApiUrl({
      configuredUrl: env.PUBLIC_API_URL,
      requestProtocol: request.protocol,
      forwardedProtocol: Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol,
      host: request.headers.host,
    });
    const generated = await withTenant(request.auth.tenantId, async (db) => {
      const equipmentResult = await db.query<{
        id: string | null;
        name: string | null;
        type: string | null;
        active: boolean | null;
        unit_code: string;
      }>(`
        SELECT e.id, e.name, et.code AS type, e.active, u.code AS unit_code
        FROM health_units u
        LEFT JOIN equipment e ON e.unit_id = u.id AND e.tenant_id = u.tenant_id
        LEFT JOIN equipment_types et ON et.id = e.equipment_type_id
        WHERE u.id = $1 AND u.tenant_id = $2
        ORDER BY e.name NULLS LAST
      `, [unitId, request.auth.tenantId]);
      if (!equipmentResult.rows.length) throw httpError('Unidade não encontrada.', 404);
      const equipment = equipmentResult.rows
        .filter((item): item is typeof item & { id: string; name: string; type: string; active: boolean } => Boolean(item.id && item.name && item.type))
        .map((item) => ({ id: item.id, name: item.name, type: item.type, active: item.active ?? false }));
      const server = equipment.find((item) => item.id === input.serverEquipmentId);
      if (!server || !server.active || !AGENT_SERVER_TYPES.includes(server.type as (typeof AGENT_SERVER_TYPES)[number])) {
        throw httpError('O equipamento selecionado precisa ser um servidor ativo desta unidade.', 422);
      }
      const sources = equipment.filter((item) => item.active && AGENT_SOURCE_TYPES.includes(item.type as (typeof AGENT_SOURCE_TYPES)[number]));
      if (!sources.length) {
        throw httpError('Requisito ausente: cadastre uma Starlink, um MikroTik ou um link de internet ativo nesta unidade.', 422);
      }
      const releaseResult = await db.query<{
        version: string;
        file_name: string;
        artifact: Buffer;
        checksum_sha256: string;
      }>(`
        SELECT version, file_name, artifact, checksum_sha256
        FROM agent_versions
        WHERE tenant_id = $1 AND platform = $2 AND active = true
        ORDER BY string_to_array(version, '.')::int[] DESC, created_at DESC
        LIMIT 1
      `, [request.auth.tenantId, input.platform]);
      const release = releaseResult.rows[0];
      if (!release) throw httpError(`Nenhuma versão ativa do agente ${input.platform} foi publicada.`, 422);
      if (!isDeployableAgentArtifact(release.file_name)) {
        throw httpError(`A versão ${release.version} do agente ${input.platform} ainda não possui um pacote executável completo. Publique o arquivo .cjs na aba Zabbix sincronização.`, 422);
      }

      const agentId = randomUUID();
      const enrollmentId = randomUUID();
      const enrollment = createEnrollmentToken(request.auth.tenantId, enrollmentId);
      const agentResult = await db.query<{ id: string }>(`
        INSERT INTO collection_agents (id, tenant_id, unit_id, server_equipment_id, platform, status, desired_version, created_by)
        VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
        ON CONFLICT (tenant_id, server_equipment_id) DO UPDATE SET
          unit_id = EXCLUDED.unit_id,
          platform = EXCLUDED.platform,
          desired_version = EXCLUDED.desired_version,
          status = CASE WHEN collection_agents.status = 'active' AND collection_agents.credential_hash IS NOT NULL THEN 'active' ELSE 'pending' END,
          revoked_at = NULL,
          updated_at = now()
        RETURNING id
      `, [agentId, request.auth.tenantId, unitId, server.id, input.platform, release.version, request.auth.userId]);
      const agent = agentResult.rows[0];
      await db.query(`
        UPDATE collection_agent_enrollments SET revoked_at = now()
        WHERE tenant_id = $1 AND agent_id = $2 AND consumed_at IS NULL AND revoked_at IS NULL
      `, [request.auth.tenantId, agent.id]);
      await db.query(`
        INSERT INTO collection_agent_enrollments (id, tenant_id, agent_id, token_hash, expires_at, created_by)
        VALUES ($1,$2,$3,$4,now() + interval '30 minutes',$5)
      `, [enrollmentId, request.auth.tenantId, agent.id, hashAgentSecret(enrollment.secret), request.auth.userId]);
      await db.query('UPDATE collection_agent_assignments SET active = false, updated_at = now() WHERE tenant_id = $1 AND agent_id = $2', [request.auth.tenantId, agent.id]);
      for (const source of sources) {
        await db.query(`
          INSERT INTO collection_agent_assignments (agent_id, tenant_id, equipment_id, source_kind, active)
          VALUES ($1,$2,$3,$4,true)
          ON CONFLICT (agent_id, equipment_id) DO UPDATE SET source_kind = EXCLUDED.source_kind, active = true, updated_at = now()
        `, [agent.id, request.auth.tenantId, source.id, source.type]);
        if (source.type === 'starlink') {
          await db.query(`
            INSERT INTO starlink_telemetry_sources (tenant_id, equipment_id, source_kind, enabled, metadata)
            VALUES ($1,$2,'local_agent',true,$3)
            ON CONFLICT (tenant_id, equipment_id) DO UPDATE SET source_kind = 'local_agent', enabled = true,
              metadata = EXCLUDED.metadata, updated_at = now()
          `, [request.auth.tenantId, source.id, { agentId: agent.id, version: release.version, source: 'collection_agent' }]);
        }
      }
      await db.query(`
        INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
        VALUES ($1,$2,'collection_agent.installer_generated','collection_agent',$3,$4)
      `, [request.auth.tenantId, request.auth.userId, agent.id, { unitId, serverEquipmentId: server.id, platform: input.platform, version: release.version, expiresInMinutes: 30 }]);
      return { agentId: agent.id, unitCode: equipmentResult.rows[0].unit_code, enrollmentToken: enrollment.token, release };
    });
    const installerOptions = {
      apiUrl,
      enrollmentToken: generated.enrollmentToken,
      artifact: generated.release.artifact,
      artifactChecksum: generated.release.checksum_sha256,
      version: generated.release.version,
      unitCode: generated.unitCode,
    };
    const content = input.platform === 'windows' ? renderWindowsInstaller(installerOptions) : renderLinuxInstaller(installerOptions);
    const fileName = collectionAgentInstallerFileName(generated.unitCode, input.platform);
    return reply.code(201)
      .type('text/plain; charset=utf-8')
      .header('content-disposition', `attachment; filename="${fileName}"`)
      .header('x-agent-id', generated.agentId)
      .header('x-enrollment-expires-in', '1800')
      .send(content);
  });

  app.get('/v1/units/:unitId/collection-agents', { preHandler: [app.authenticate] }, async (request) => {
    requireUserAccess(request, permission.monitoringRead);
    const unitId = z.string().uuid().parse((request.params as { unitId: string }).unitId);
    return withTenant(request.auth.tenantId, async (db) => {
      const result = await db.query(`
        SELECT a.id, a.server_equipment_id, e.name AS server_name, a.platform, a.status,
               a.desired_version, a.installed_version, a.last_heartbeat_at, a.last_collection_at,
               a.enrolled_at, a.revoked_at, a.created_at
        FROM collection_agents a
        JOIN equipment e ON e.id = a.server_equipment_id AND e.tenant_id = a.tenant_id
        WHERE a.tenant_id = $1 AND a.unit_id = $2
        ORDER BY a.created_at DESC
      `, [request.auth.tenantId, unitId]);
      return result.rows;
    });
  });

  app.post('/v1/collection-agents/:agentId/revoke', { preHandler: [app.authenticate] }, async (request) => {
    requireUserAccess(request, permission.integrationsManage);
    const agentId = z.string().uuid().parse((request.params as { agentId: string }).agentId);
    return withTenant(request.auth.tenantId, async (db) => {
      const result = await db.query(`
        UPDATE collection_agents
        SET status = 'revoked', credential_hash = NULL, revoked_at = now(), updated_at = now()
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `, [agentId, request.auth.tenantId]);
      if (!result.rows[0]) throw httpError('Agente não encontrado.', 404);
      await db.query(`
        UPDATE collection_agent_enrollments SET revoked_at = now()
        WHERE agent_id = $1 AND tenant_id = $2 AND consumed_at IS NULL AND revoked_at IS NULL
      `, [agentId, request.auth.tenantId]);
      await db.query(`
        INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
        VALUES ($1,$2,'collection_agent.revoked','collection_agent',$3)
      `, [request.auth.tenantId, request.auth.userId, agentId]);
      return { success: true, agentId, revoked: true };
    });
  });
};
