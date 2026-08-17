CREATE TABLE monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES equipment(id) ON DELETE SET NULL,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  external_event_id text,
  event_kind text NOT NULL CHECK (event_kind IN ('status', 'problem', 'recovery')),
  operational_status operational_status NOT NULL,
  severity smallint CHECK (severity BETWEEN 0 AND 5),
  title text,
  observed_at timestamptz NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, integration_id, external_event_id)
);

CREATE TABLE metric_samples (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  value numeric NOT NULL,
  unit text,
  observed_at timestamptz NOT NULL,
  source_payload jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX monitoring_events_tenant_observed_idx ON monitoring_events (tenant_id, observed_at DESC);
CREATE INDEX metric_samples_equipment_metric_observed_idx ON metric_samples (equipment_id, metric_key, observed_at DESC);

ALTER TABLE monitoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY monitoring_events_tenant_isolation ON monitoring_events USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY metric_samples_tenant_isolation ON metric_samples USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
