import type { PoolClient } from 'pg';

export interface EquipmentSummary {
  id: string;
  unit_id: string;
  type_code: string;
  type_name: string;
  name: string;
  serial_number: string | null;
  management_address: string | null;
  contracted_download_mbps: number | null;
  contracted_upload_mbps: number | null;
  active: boolean;
}

export interface EquipmentInput {
  equipmentTypeCode: string;
  name: string;
  serialNumber?: string;
  managementAddress?: string;
  contractedDownloadMbps?: number;
  contractedUploadMbps?: number;
}

function optionalText(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

const selectEquipment = `
  SELECT e.id, e.unit_id, et.code AS type_code, et.name AS type_name,
         e.name, e.serial_number, e.management_address,
         e.contracted_download_mbps::float8, e.contracted_upload_mbps::float8, e.active
  FROM equipment e
  JOIN equipment_types et ON et.id = e.equipment_type_id
`;

export async function listEquipment(client: PoolClient, tenantId: string, unitId: string): Promise<EquipmentSummary[]> {
  const result = await client.query<EquipmentSummary>(`${selectEquipment} WHERE e.tenant_id = $1 AND e.unit_id = $2 ORDER BY e.name`, [tenantId, unitId]);
  return result.rows;
}

export async function createEquipment(client: PoolClient, tenantId: string, unitId: string, input: EquipmentInput): Promise<EquipmentSummary> {
  const result = await client.query<{ id: string }>(`
    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address,
      contracted_download_mbps, contracted_upload_mbps)
    SELECT $1, $2, et.id, $3, $4, $5, $7, $8 FROM equipment_types et
    WHERE et.code = $6 AND EXISTS (SELECT 1 FROM health_units hu WHERE hu.id = $2 AND hu.tenant_id = $1 AND hu.active)
    RETURNING id
  `, [tenantId, unitId, input.name.trim(), optionalText(input.serialNumber), optionalText(input.managementAddress), input.equipmentTypeCode,
    input.contractedDownloadMbps ?? null, input.contractedUploadMbps ?? null]);
  if (!result.rows[0]) throw Object.assign(new Error('Tipo de equipamento inválido.'), { statusCode: 400 });
  const created = await client.query<EquipmentSummary>(`${selectEquipment} WHERE e.id = $1`, [result.rows[0].id]);
  return created.rows[0];
}

export async function updateEquipment(client: PoolClient, tenantId: string, id: string, input: EquipmentInput): Promise<EquipmentSummary | null> {
  const result = await client.query<{ id: string }>(`
    UPDATE equipment e SET equipment_type_id = et.id, name = $2, serial_number = $3,
      management_address = $4, contracted_download_mbps = $7, contracted_upload_mbps = $8, updated_at = now()
    FROM equipment_types et
    WHERE e.id = $1 AND e.tenant_id = $6 AND et.code = $5
    RETURNING e.id
  `, [id, input.name.trim(), optionalText(input.serialNumber), optionalText(input.managementAddress), input.equipmentTypeCode, tenantId,
    input.contractedDownloadMbps ?? null, input.contractedUploadMbps ?? null]);
  if (!result.rows[0]) return null;
  const updated = await client.query<EquipmentSummary>(`${selectEquipment} WHERE e.id = $1`, [id]);
  return updated.rows[0] ?? null;
}

export async function deactivateEquipment(client: PoolClient, tenantId: string, id: string): Promise<boolean> {
  const result = await client.query('UPDATE equipment SET active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = true', [id, tenantId]);
  return (result.rowCount ?? 0) > 0;
}

export async function reactivateEquipment(client: PoolClient, tenantId: string, id: string): Promise<boolean> {
  const result = await client.query('UPDATE equipment SET active = true, updated_at = now() WHERE id = $1 AND tenant_id = $2 AND active = false', [id, tenantId]);
  return (result.rowCount ?? 0) > 0;
}

export async function deleteEquipment(client: PoolClient, tenantId: string, id: string): Promise<boolean> {
  const result = await client.query('DELETE FROM equipment WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  return (result.rowCount ?? 0) > 0;
}

export async function writeEquipmentAudit(client: PoolClient, tenantId: string, actorUserId: string, action: string, equipmentId?: string): Promise<void> {
  await client.query(`
    INSERT INTO audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id)
    VALUES ($1, $2, $3, 'equipment', $4)
  `, [tenantId, actorUserId, action, equipmentId ?? null]);
}
