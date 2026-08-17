CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX user_sessions_user_idx ON user_sessions (user_id, revoked_at, expires_at);
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user_sessions ON user_sessions
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

INSERT INTO permissions (code, description) VALUES
  ('tenant.manage', 'Gerenciar configurações do cliente'),
  ('users.manage', 'Gerenciar usuários e papéis'),
  ('units.read', 'Visualizar unidades'),
  ('units.manage', 'Gerenciar unidades e equipamentos'),
  ('monitoring.read', 'Visualizar monitoramento'),
  ('alerts.read', 'Visualizar alertas'),
  ('alerts.acknowledge', 'Reconhecer e resolver alertas'),
  ('reports.read', 'Visualizar relatórios'),
  ('audit.read', 'Visualizar auditoria'),
  ('integrations.manage', 'Gerenciar integrações')
ON CONFLICT (code) DO NOTHING;
