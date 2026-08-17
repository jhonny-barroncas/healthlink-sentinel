import type { PoolClient } from 'pg';

export interface HealthUnitSummary {
  id: string;
  code: string;
  name: string;
  state_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  operational_status: 'online' | 'degraded' | 'offline' | 'unknown';
}

export async function listHealthUnits(client: PoolClient, tenantId: string): Promise<HealthUnitSummary[]> {
  const result = await client.query<HealthUnitSummary>(`
    SELECT u.id, u.code, u.name, u.state_code, u.city, u.latitude, u.longitude, u.active,
           COALESCE(s.operational_status, 'unknown') AS operational_status
    FROM health_units u
    LEFT JOIN unit_status_snapshots s ON s.unit_id = u.id
    WHERE u.tenant_id = $1
    ORDER BY u.name
  `, [tenantId]);
  return result.rows;
}

export interface HealthUnitInput {
  code: string;
  name: string;
  stateCode: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export async function getHealthUnit(client: PoolClient, tenantId: string, id: string): Promise<HealthUnitSummary | null> {
  const result = await client.query<HealthUnitSummary>(`
    SELECT u.id, u.code, u.name, u.state_code, u.city, u.latitude, u.longitude, u.active,
           COALESCE(s.operational_status, 'unknown') AS operational_status
    FROM health_units u
    LEFT JOIN unit_status_snapshots s ON s.unit_id = u.id
    WHERE u.id = $1 AND u.tenant_id = $2
  `, [id, tenantId]);
  return result.rows[0] ?? null;
}

export async function createHealthUnit(client: PoolClient, tenantId: string, input: HealthUnitInput): Promise<HealthUnitSummary> {
  const result = await client.query<{ id: string }>(`
    INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [tenantId, input.code, input.name, input.stateCode, input.city, input.latitude ?? null, input.longitude ?? null]);
  await client.query('INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status) VALUES ($1, $2, \'unknown\')', [result.rows[0].id, tenantId]);
  const unit = await getHealthUnit(client, tenantId, result.rows[0].id);
  if (!unit) throw new Error('Unidade criada, mas não encontrada.');
  return unit;
}

export async function updateHealthUnit(client: PoolClient, tenantId: string, id: string, input: HealthUnitInput): Promise<HealthUnitSummary | null> {
  await client.query(`
    UPDATE health_units SET code = $2, name = $3, state_code = $4, city = $5,
      latitude = $6, longitude = $7, updated_at = now()
    WHERE id = $1 AND tenant_id = $8
  `, [id, input.code, input.name, input.stateCode, input.city, input.latitude ?? null, input.longitude ?? null, tenantId]);
  return getHealthUnit(client, tenantId, id);
}

export async function deactivateHealthUnit(client: PoolClient, tenantId: string, id: string): Promise<boolean> {
  const result = await client.query('UPDATE health_units SET active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = true', [id, tenantId]);
  return (result.rowCount ?? 0) > 0;
}

export async function writeUnitAudit(client: PoolClient, tenantId: string, actorUserId: string, action: string, unitId?: string): Promise<void> {
  await client.query(`
    INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
    VALUES ($1, $2, $3, 'health_unit', $4)
  `, [tenantId, actorUserId, action, unitId ?? null]);
}
