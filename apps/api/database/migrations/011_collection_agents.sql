INSERT INTO equipment_types (code, name)
VALUES ('server', 'Servidor')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

CREATE TABLE collection_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES health_units(id) ON DELETE CASCADE,
  server_equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('windows', 'linux')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  credential_hash text,
  desired_version text NOT NULL DEFAULT '1.0.0',
  installed_version text,
  last_heartbeat_at timestamptz,
  last_collection_at timestamptz,
  enrolled_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, server_equipment_id)
);

CREATE TABLE collection_agent_assignments (
  agent_id uuid NOT NULL REFERENCES collection_agents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('starlink', 'mikrotik', 'internet_link')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, equipment_id)
);

CREATE TABLE collection_agent_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES collection_agents(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE collection_agent_batches (
  agent_id uuid NOT NULL REFERENCES collection_agents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, batch_id)
);

CREATE INDEX collection_agents_tenant_unit_idx ON collection_agents (tenant_id, unit_id, status);
CREATE INDEX collection_agents_heartbeat_idx ON collection_agents (tenant_id, last_heartbeat_at DESC);
CREATE INDEX collection_agent_assignments_lookup_idx ON collection_agent_assignments (tenant_id, equipment_id, active);
CREATE INDEX collection_agent_enrollments_lookup_idx ON collection_agent_enrollments (tenant_id, agent_id, expires_at DESC);

ALTER TABLE collection_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_agent_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_agent_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_agents_tenant_isolation ON collection_agents
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY collection_agent_assignments_tenant_isolation ON collection_agent_assignments
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY collection_agent_enrollments_tenant_isolation ON collection_agent_enrollments
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
CREATE POLICY collection_agent_batches_tenant_isolation ON collection_agent_batches
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

