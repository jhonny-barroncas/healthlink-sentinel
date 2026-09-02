type Queryable = { query: <T = any>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> };

type OfflineInput = {
  tenantId: string;
  agentId: string;
  unitId: string;
  serverEquipmentId: string;
  lastHeartbeatAt: string | null;
  observedAt: string;
};

type RecoveryInput = {
  tenantId: string;
  agentId: string;
  serverEquipmentId: string;
  observedAt: string;
};

function externalId(agentId: string) {
  return `collection-agent:${agentId}:heartbeat-missing`;
}

export function isCollectionAgentHeartbeatExpired(lastHeartbeatAt: string | Date | null, now = new Date()): boolean {
  if (!lastHeartbeatAt) return false;
  return now.getTime() - new Date(lastHeartbeatAt).getTime() > 30_000;
}

export async function persistCollectionAgentOffline(db: Queryable, input: OfflineInput): Promise<boolean> {
  const incidentId = externalId(input.agentId);
  const current = await db.query<{ id: string; status: string }>(`
    SELECT id, status FROM alerts
    WHERE tenant_id = $1 AND equipment_id = $2 AND external_id = $3
    ORDER BY opened_at DESC LIMIT 1
  `, [input.tenantId, input.serverEquipmentId, incidentId]);
  if (current.rows[0]?.status === 'open' || current.rows[0]?.status === 'acknowledged') return false;
  const payload = { source: 'collection_agent', agentId: input.agentId, lastHeartbeatAt: input.lastHeartbeatAt };
  let alertId = current.rows[0]?.id;
  if (alertId) {
    await db.query(`
      UPDATE alerts SET unit_id = $1, title = $2, severity = $3, status = 'open', opened_at = $4,
        acknowledged_at = NULL, acknowledged_by = NULL, resolved_at = NULL, raw_payload = $5
      WHERE id = $6 AND tenant_id = $7
    `, [input.unitId, 'Agente sem comunicação', 4, input.observedAt, payload, alertId, input.tenantId]);
  } else {
    const created = await db.query<{ id: string }>(`
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
      VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8)
      RETURNING id
    `, [input.tenantId, input.unitId, input.serverEquipmentId, incidentId, 'Agente sem comunicação', 4, input.observedAt, payload]);
    alertId = created.rows[0]?.id;
  }
  if (!alertId) return false;
  await db.query(`INSERT INTO alert_events (tenant_id, alert_id, event_type, payload) VALUES ($1,$2,'observed',$3)`, [input.tenantId, alertId, payload]);
  await db.query(`
    INSERT INTO monitoring_events (tenant_id, equipment_id, external_event_id, event_kind, operational_status, severity, title, observed_at, payload)
    VALUES ($1,$2,$3,'problem','offline',4,$4,$5,$6)
  `, [input.tenantId, input.serverEquipmentId, `${incidentId}:opened:${input.observedAt}`, 'Agente sem comunicação', input.observedAt, payload]);
  return true;
}

export async function resolveCollectionAgentOffline(db: Queryable, input: RecoveryInput): Promise<boolean> {
  const incidentId = externalId(input.agentId);
  const current = await db.query<{ id: string; severity: number }>(`
    SELECT id, severity FROM alerts
    WHERE tenant_id = $1 AND equipment_id = $2 AND external_id = $3 AND status IN ('open', 'acknowledged')
    ORDER BY opened_at DESC LIMIT 1
  `, [input.tenantId, input.serverEquipmentId, incidentId]);
  const alert = current.rows[0];
  if (!alert) return false;
  const payload = { source: 'collection_agent', agentId: input.agentId };
  await db.query(`UPDATE alerts SET status = 'resolved', resolved_at = $1 WHERE id = $2 AND tenant_id = $3`, [input.observedAt, alert.id, input.tenantId]);
  await db.query(`INSERT INTO alert_events (tenant_id, alert_id, event_type, payload) VALUES ($1,$2,'recovered',$3)`, [input.tenantId, alert.id, payload]);
  await db.query(`
    INSERT INTO monitoring_events (tenant_id, equipment_id, external_event_id, event_kind, operational_status, severity, title, observed_at, payload)
    VALUES ($1,$2,$3,'recovery','online',$4,$5,$6,$7)
  `, [input.tenantId, input.serverEquipmentId, `${incidentId}:recovered:${input.observedAt}`, alert.severity, 'Agente voltou a comunicar', input.observedAt, payload]);
  return true;
}
