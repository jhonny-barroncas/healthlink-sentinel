CREATE TABLE starlink_telemetry_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('official_api', 'local_agent', 'zabbix')),
  endpoint text,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, equipment_id)
);

CREATE INDEX starlink_telemetry_sources_tenant_idx ON starlink_telemetry_sources (tenant_id, enabled);
ALTER TABLE starlink_telemetry_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY starlink_telemetry_sources_tenant_isolation ON starlink_telemetry_sources
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
