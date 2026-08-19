CREATE TABLE IF NOT EXISTS agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version text NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  platform text NOT NULL CHECK (platform IN ('windows', 'linux')),
  file_name text NOT NULL,
  artifact bytea NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0),
  checksum_sha256 text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version, platform)
);

CREATE INDEX IF NOT EXISTS agent_versions_lookup_idx
  ON agent_versions (tenant_id, platform, active, created_at DESC);

-- Bootstrap seguro: a versão 1.0.0 já aparece no repositório para cada tenant.
-- O conteúdo é um launcher mínimo; o instalador completo pode substituí-lo pela tela de publicação.
INSERT INTO agent_versions (tenant_id, version, platform, file_name, artifact, file_size, checksum_sha256)
SELECT t.id, '1.0.0', 'linux', 'healthlink-agent-1.0.0.sh', a.artifact, octet_length(a.artifact), encode(digest(a.artifact, 'sha256'), 'hex')
FROM tenants t
CROSS JOIN (SELECT convert_to('#!/usr/bin/env bash\necho "HealthLink Sentinel Agent 1.0.0"\n', 'UTF8') AS artifact) a
WHERE NOT EXISTS (SELECT 1 FROM agent_versions v WHERE v.tenant_id = t.id AND v.version = '1.0.0' AND v.platform = 'linux');

INSERT INTO agent_versions (tenant_id, version, platform, file_name, artifact, file_size, checksum_sha256)
SELECT t.id, '1.0.0', 'windows', 'healthlink-agent-1.0.0.ps1', a.artifact, octet_length(a.artifact), encode(digest(a.artifact, 'sha256'), 'hex')
FROM tenants t
CROSS JOIN (SELECT convert_to('Write-Output "HealthLink Sentinel Agent 1.0.0"\n', 'UTF8') AS artifact) a
WHERE NOT EXISTS (SELECT 1 FROM agent_versions v WHERE v.tenant_id = t.id AND v.version = '1.0.0' AND v.platform = 'windows');
