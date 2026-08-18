-- Seed de demonstração: expansão geral — segunda unidade em vários estados
-- (com status variados) e mais alertas cobrindo severidades e idades diferentes.
-- Idempotente via ON CONFLICT.

DO $$
DECLARE
  v_tenant_id uuid;
  v_type_mikrotik uuid;
  v_type_starlink uuid;
  v_type_vpn uuid;
  v_type_link uuid;
  v_type_linux uuid;
  v_unit uuid;
  v_equip uuid;
  v_row record;
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

  -- ==== Segunda unidade em vários estados, status e equipamentos variados ====
  FOR v_row IN
    SELECT * FROM (VALUES
      ('UMS-501', 'SP', 'São Paulo (Zona Norte)', -23.520, -46.620, 'online'),
      ('UMS-502', 'RJ', 'Niterói',                -22.883, -43.104, 'degraded'),
      ('UMS-503', 'MG', 'Uberlândia',             -18.918, -48.277, 'online'),
      ('UMS-504', 'RS', 'Caxias do Sul',          -29.167, -51.179, 'offline'),
      ('UMS-505', 'PR', 'Londrina',               -23.310, -51.163, 'online'),
      ('UMS-506', 'GO', 'Anápolis',               -16.328, -48.953, 'unknown'),
      ('UMS-507', 'PA', 'Ananindeua',              -1.365, -48.372, 'degraded'),
      ('UMS-508', 'SC', 'Joinville',              -26.304, -48.846, 'online')
    ) AS s(code, state_code, city, lat, lon, target_status)
  LOOP
    INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
    VALUES (v_tenant_id, v_row.code, 'Unidade Móvel ' || v_row.city, v_row.state_code, v_row.city, v_row.lat, v_row.lon)
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
    RETURNING id INTO v_unit;

    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, contracted_download_mbps, contracted_upload_mbps)
    VALUES (v_tenant_id, v_unit, v_type_mikrotik, 'Mikrotik WAN1 - ' || v_row.city, 'SEED-' || v_row.code || '-MKT', 120, 50)
    ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_equip;

    IF v_row.target_status = 'unknown' THEN
      DELETE FROM equipment_status_snapshots WHERE equipment_id = v_equip;
    ELSE
      INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
      VALUES (v_equip, v_tenant_id, v_row.target_status::operational_status, now(), '{"source":"seed_demo"}')
      ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;
      INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES
        (v_tenant_id, v_equip, 'network.latency.ms', CASE v_row.target_status WHEN 'offline' THEN 0 WHEN 'degraded' THEN 160 ELSE 22 END, 'ms', now(), '{"source":"seed_demo"}'),
        (v_tenant_id, v_equip, 'network.loss.pct', CASE v_row.target_status WHEN 'offline' THEN 100 WHEN 'degraded' THEN 7.8 ELSE 0.2 END, '%', now(), '{"source":"seed_demo"}'),
        (v_tenant_id, v_equip, 'network.in.bps', CASE v_row.target_status WHEN 'offline' THEN 0 ELSE 20000000 + random() * 50000000 END, 'bps', now(), '{"source":"seed_demo"}'),
        (v_tenant_id, v_equip, 'network.out.bps', CASE v_row.target_status WHEN 'offline' THEN 0 ELSE 6000000 + random() * 12000000 END, 'bps', now(), '{"source":"seed_demo"}');
    END IF;

    INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
    VALUES (v_unit, v_tenant_id, v_row.target_status::operational_status, CASE WHEN v_row.target_status IN ('degraded','offline') THEN 1 ELSE 0 END, now())
    ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at;

    IF v_row.target_status IN ('degraded', 'offline') THEN
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
      VALUES (v_tenant_id, v_unit, v_equip, 'seed-expansion-' || v_row.code,
        CASE v_row.target_status WHEN 'offline' THEN 'Interface WAN sem resposta' ELSE 'Latência acima do aceitável' END,
        CASE v_row.target_status WHEN 'offline' THEN 4 ELSE 3 END, 'open',
        now() - (random() * interval '2 hours'), '{"source":"seed_demo"}')
      ON CONFLICT (integration_id, external_id) DO NOTHING;
    END IF;
  END LOOP;

  -- ==== Mais alertas variados nas unidades já existentes ====
  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-more-001', 'Uso de CPU acima de 90%', 3, 'open', now() - interval '6 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-201' AND e.name = 'Servidor Local - Recife'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, acknowledged_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-more-002', 'Certificado VPN expira em 7 dias', 2, 'acknowledged', now() - interval '3 hours', now() - interval '2 hours 40 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-203' AND e.name = 'VPN Site-to-Site - Fortaleza'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, resolved_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-more-003', 'Obstrução temporária detectada na antena', 1, 'resolved', now() - interval '5 hours', now() - interval '4 hours 30 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-201' AND e.name = 'Starlink - Recife'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-more-004', 'Zabbix: host inacessível via SNMP', 5, 'open', now() - interval '2 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-204' AND e.name = 'Starlink - Manaus'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, resolved_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-more-005', 'Falha momentânea de autenticação no túnel', 2, 'resolved', now() - interval '30 hours', now() - interval '29 hours 45 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-202' AND e.name = 'Mikrotik Core - Salvador'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  RAISE NOTICE 'Seed de expansão concluído.';
END $$;
