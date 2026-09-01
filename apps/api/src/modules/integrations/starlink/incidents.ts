export type StarlinkIncident = { key: string; title: string; severity: number };

export type StarlinkIncidentState = StarlinkIncident & { status: 'open' | 'acknowledged' | 'resolved' };

export type StarlinkIncidentChanges = {
  opened: StarlinkIncident[];
  recovered: string[];
  unchanged: string[];
};

export function reconcileStarlinkIncidents(current: StarlinkIncidentState[], incoming: StarlinkIncident[]): StarlinkIncidentChanges {
  const currentByKey = new Map(current.map((incident) => [incident.key, incident]));
  const incomingByKey = new Map(incoming.map((incident) => [incident.key, incident]));
  const opened: StarlinkIncident[] = [];
  const unchanged: string[] = [];

  for (const incident of incomingByKey.values()) {
    if (currentByKey.has(incident.key)) unchanged.push(incident.key);
    else opened.push(incident);
  }

  return {
    opened,
    recovered: current.filter((incident) => !incomingByKey.has(incident.key)).map((incident) => incident.key),
    unchanged,
  };
}

type Queryable = { query: <T = any>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> };

export async function persistStarlinkIncidents(
  db: Queryable,
  tenantId: string,
  unitId: string,
  equipmentId: string,
  observedAt: string,
  incidents: StarlinkIncident[],
  source: string,
): Promise<StarlinkIncidentChanges> {
  const prefix = `starlink:${equipmentId}:`;
  const currentResult = await db.query(`
    SELECT external_id, status
    FROM alerts
    WHERE tenant_id = $1 AND equipment_id = $2 AND external_id LIKE $3
      AND status IN ('open', 'acknowledged')
  `, [tenantId, equipmentId, `${prefix}%`]);
  const current = currentResult.rows.map((row) => ({
    key: String(row.external_id).slice(prefix.length),
    title: String(row.external_id).slice(prefix.length),
    severity: 0,
    status: row.status as 'open' | 'acknowledged',
  }));
  const changes = reconcileStarlinkIncidents(current, incidents);

  for (const incident of incidents) {
    const externalId = `${prefix}${incident.key}`;
    const existing = await db.query<{ id: string; status: string }>(`
      SELECT id, status FROM alerts
      WHERE tenant_id = $1 AND equipment_id = $2 AND external_id = $3
      ORDER BY opened_at DESC LIMIT 1
    `, [tenantId, equipmentId, externalId]);
    if (existing.rows[0]?.status === 'open' || existing.rows[0]?.status === 'acknowledged') {
      await db.query(`UPDATE alerts SET title = $1, severity = $2, raw_payload = $3 WHERE id = $4 AND tenant_id = $5`, [incident.title, incident.severity, { source, incident }, existing.rows[0].id, tenantId]);
      continue;
    }
    let alertId = existing.rows[0]?.id;
    if (alertId) {
      await db.query(`UPDATE alerts SET unit_id = $1, title = $2, severity = $3, status = 'open', opened_at = $4, resolved_at = NULL, raw_payload = $5 WHERE id = $6 AND tenant_id = $7`, [unitId, incident.title, incident.severity, observedAt, { source, incident }, alertId, tenantId]);
    } else {
      const created = await db.query<{ id: string }>(`
        INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
        VALUES ($1,$2,$3,$4,$5,$6,'open',$7,$8)
        RETURNING id
      `, [tenantId, unitId, equipmentId, externalId, incident.title, incident.severity, observedAt, { source, incident }]);
      alertId = created.rows[0]?.id;
    }
    if (!alertId) continue;
    await db.query(`INSERT INTO alert_events (tenant_id, alert_id, event_type, payload) VALUES ($1,$2,'observed',$3)`, [tenantId, alertId, { source, incident }]);
    await db.query(`
      INSERT INTO monitoring_events (tenant_id, equipment_id, external_event_id, event_kind, operational_status, severity, title, observed_at, payload)
      VALUES ($1,$2,$3,'problem',$4,$5,$6,$7,$8)
      ON CONFLICT (tenant_id, integration_id, external_event_id) DO NOTHING
    `, [tenantId, equipmentId, `${externalId}:opened:${observedAt}`, incident.severity >= 4 ? 'offline' : 'degraded', incident.severity, incident.title, observedAt, { source, incident }]);
  }

  for (const key of changes.recovered) {
    const externalId = `${prefix}${key}`;
    const existing = await db.query<{ id: string; title: string; severity: number }>(`SELECT id, title, severity FROM alerts WHERE tenant_id = $1 AND equipment_id = $2 AND external_id = $3 AND status <> 'resolved' LIMIT 1`, [tenantId, equipmentId, externalId]);
    if (!existing.rows[0]) continue;
    await db.query(`UPDATE alerts SET status = 'resolved', resolved_at = $1 WHERE id = $2 AND tenant_id = $3`, [observedAt, existing.rows[0].id, tenantId]);
    await db.query(`INSERT INTO alert_events (tenant_id, alert_id, event_type, payload) VALUES ($1,$2,'recovered',$3)`, [tenantId, existing.rows[0].id, { source, key }]);
    await db.query(`
      INSERT INTO monitoring_events (tenant_id, equipment_id, external_event_id, event_kind, operational_status, severity, title, observed_at, payload)
      VALUES ($1,$2,$3,'recovery','online',$4,$5,$6,$7)
      ON CONFLICT (tenant_id, integration_id, external_event_id) DO NOTHING
    `, [tenantId, equipmentId, `${externalId}:recovered:${observedAt}`, existing.rows[0].severity ?? 0, existing.rows[0].title, observedAt, { source, key }]);
  }

  return changes;
}
