-- A tenant has one active Zabbix integration. Mappings must remain stable
-- across preview, mapping and scheduled-sync requests.
CREATE UNIQUE INDEX IF NOT EXISTS integrations_active_zabbix_tenant_uidx
  ON integrations (tenant_id)
  WHERE kind = 'zabbix' AND active = true;
