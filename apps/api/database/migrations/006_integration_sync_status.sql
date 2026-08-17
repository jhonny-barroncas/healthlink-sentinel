CREATE TABLE IF NOT EXISTS integration_sync_status (
  integration_id uuid PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  health_status text NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unavailable', 'unknown')),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error text,
  hosts_seen integer NOT NULL DEFAULT 0 CHECK (hosts_seen >= 0),
  mapped_hosts integer NOT NULL DEFAULT 0 CHECK (mapped_hosts >= 0),
  problems_seen integer NOT NULL DEFAULT 0 CHECK (problems_seen >= 0),
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_sync_status_tenant_idx
  ON integration_sync_status (tenant_id, updated_at DESC);

ALTER TABLE integration_sync_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_sync_status_tenant_isolation ON integration_sync_status;
CREATE POLICY integration_sync_status_tenant_isolation ON integration_sync_status
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
