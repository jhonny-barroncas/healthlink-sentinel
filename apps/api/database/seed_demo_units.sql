-- Seed de demonstração: unidades móveis cobrindo os 4 status operacionais.
-- Idempotente: pode ser rodado mais de uma vez (ON CONFLICT nos códigos).

DO $$
DECLARE
  v_tenant_id uuid;
  v_unit_online uuid;
  v_unit_degraded uuid;
  v_unit_offline uuid;
  v_unit_unknown uuid;
  v_type_mikrotik uuid;
  v_type_starlink uuid;
  v_type_vpn uuid;
  v_type_link uuid;
  v_type_linux uuid;
  v_equip uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "default" não encontrado.';
  END IF;

  SELECT id INTO v_type_mikrotik FROM equipment_types WHERE code = 'mikrotik';
  SELECT id INTO v_type_starlink FROM equipment_types WHERE code = 'starlink';
  SELECT id INTO v_type_vpn FROM equipment_types WHERE code = 'vpn';
  SELECT id INTO v_type_link FROM equipment_types WHERE code = 'internet_link';
  SELECT id INTO v_type_linux FROM equipment_types WHERE code = 'linux_server';

  -- ==== Unidade 1: totalmente operacional ====
  INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
  VALUES (v_tenant_id, 'UMS-201', 'Unidade Móvel Recife', 'PE', 'Recife', -8.047562, -34.877000)
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_unit_online;

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address, contracted_download_mbps, contracted_upload_mbps)
  VALUES (v_tenant_id, v_unit_online, v_type_mikrotik, 'Mikrotik WAN1 - Recife', 'SEED-201-MKT', '10.20.1.1', 100, 50)
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
  VALUES (v_equip, v_tenant_id, 'online', now(), '{"source":"seed_demo"}')
  ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;
  INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES
    (v_tenant_id, v_equip, 'network.latency.ms', 18, 'ms', now(), '{"source":"seed_demo"}'),
    (v_tenant_id, v_equip, 'network.loss.pct', 0, '%', now(), '{"source":"seed_demo"}'),
    (v_tenant_id, v_equip, 'network.in.bps', 62000000, 'bps', now(), '{"source":"seed_demo"}'),
    (v_tenant_id, v_equip, 'network.out.bps', 21000000, 'bps', now(), '{"source":"seed_demo"}');

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, contracted_download_mbps, contracted_upload_mbps)
  VALUES (v_tenant_id, v_unit_online, v_type_starlink, 'Starlink - Recife', 'SEED-201-STL', 220, 25)
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
  VALUES (v_equip, v_tenant_id, 'online', now(), '{"source":"seed_demo"}')
  ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
  VALUES (v_tenant_id, v_unit_online, v_type_linux, 'Servidor Local - Recife', 'SEED-201-SRV')
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
  VALUES (v_equip, v_tenant_id, 'online', now(), '{"source":"seed_demo"}')
  ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;

  INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
  VALUES (v_unit_online, v_tenant_id, 'online', 0, now())
  ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at;

  -- ==== Unidade 2: em atenção (degraded) ====
  INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
  VALUES (v_tenant_id, 'UMS-202', 'Unidade Móvel Salvador', 'BA', 'Salvador', -12.971598, -38.501300)
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_unit_degraded;

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address, contracted_download_mbps, contracted_upload_mbps)
  VALUES (v_tenant_id, v_unit_degraded, v_type_link, 'Link Internet WAN1 - Salvador', 'SEED-202-LNK', '10.20.2.1', 150, 60)
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
  VALUES (v_equip, v_tenant_id, 'degraded', now(), '{"source":"seed_demo"}')
  ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;
  INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES
    (v_tenant_id, v_equip, 'network.latency.ms', 148, 'ms', now(), '{"source":"seed_demo"}'),
    (v_tenant_id, v_equip, 'network.loss.pct', 6.4, '%', now(), '{"source":"seed_demo"}'),
    (v_tenant_id, v_equip, 'network.in.bps', 24000000, 'bps', now(), '{"source":"seed_demo"}'),
    (v_tenant_id, v_equip, 'network.out.bps', 9000000, 'bps', now(), '{"source":"seed_demo"}');

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
  VALUES (v_tenant_id, v_unit_degraded, v_type_mikrotik, 'Mikrotik Core - Salvador', 'SEED-202-MKT')
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
  VALUES (v_equip, v_tenant_id, 'online', now(), '{"source":"seed_demo"}')
  ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;

  INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
  VALUES (v_unit_degraded, v_tenant_id, 'degraded', 1, now())
  ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at;

  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
  SELECT v_tenant_id, v_unit_degraded, id, 'seed-degraded-201', 'Latência acima do limite aceitável', 2, 'open', now() - interval '18 minutes', '{"source":"seed_demo"}'
  FROM equipment WHERE tenant_id = v_tenant_id AND serial_number = 'SEED-202-LNK'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  -- ==== Unidade 3: indisponível (offline) ====
  INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
  VALUES (v_tenant_id, 'UMS-203', 'Unidade Móvel Fortaleza', 'CE', 'Fortaleza', -3.731862, -38.526670)
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_unit_offline;

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address, contracted_download_mbps, contracted_upload_mbps)
  VALUES (v_tenant_id, v_unit_offline, v_type_vpn, 'VPN Site-to-Site - Fortaleza', 'SEED-203-VPN', '10.20.3.1', 80, 40)
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
  VALUES (v_equip, v_tenant_id, 'offline', now(), '{"source":"seed_demo","reason":"communication_loss"}')
  ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
  VALUES (v_tenant_id, v_unit_offline, v_type_linux, 'Servidor Local - Fortaleza', 'SEED-203-SRV')
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
  VALUES (v_equip, v_tenant_id, 'offline', now(), '{"source":"seed_demo","reason":"communication_loss"}')
  ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;

  INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
  VALUES (v_unit_offline, v_tenant_id, 'offline', 1, now())
  ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at;

  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
  SELECT v_tenant_id, v_unit_offline, id, 'seed-offline-203', 'Sem comunicação com o link principal', 4, 'open', now() - interval '52 minutes', '{"source":"seed_demo"}'
  FROM equipment WHERE tenant_id = v_tenant_id AND serial_number = 'SEED-203-VPN'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  -- ==== Unidade 4: sem telemetria (unknown) ====
  INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
  VALUES (v_tenant_id, 'UMS-204', 'Unidade Móvel Manaus', 'AM', 'Manaus', -3.119027, -60.021730)
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_unit_unknown;

  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
  VALUES (v_tenant_id, v_unit_unknown, v_type_starlink, 'Starlink - Manaus', 'SEED-204-STL')
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_equip;
  -- Nenhum equipment_status_snapshots: equipamento aguardando primeira coleta (status 'unknown' por ausência de linha).

  INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
  VALUES (v_unit_unknown, v_tenant_id, 'unknown', 0, now())
  ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at;

  RAISE NOTICE 'Seed de unidades de demonstração concluído.';
END $$;
