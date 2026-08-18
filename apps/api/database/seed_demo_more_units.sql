-- Seed de demonstração: mais unidades (terceira leva) para avaliar filtros de
-- nome/região/status e paginação. Idempotente via ON CONFLICT (tenant_id, code).

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

  FOR v_row IN
    SELECT * FROM (VALUES
      ('UMS-601', 'SP', 'Campinas',              -22.907, -47.063, 'online'),
      ('UMS-602', 'SP', 'Santos',                -23.960, -46.333, 'degraded'),
      ('UMS-603', 'SP', 'Ribeirão Preto',        -21.178, -47.807, 'online'),
      ('UMS-604', 'RJ', 'Petrópolis',            -22.505, -43.178, 'offline'),
      ('UMS-605', 'RJ', 'Duque de Caxias',       -22.785, -43.311, 'online'),
      ('UMS-606', 'MG', 'Juiz de Fora',          -21.764, -43.350, 'unknown'),
      ('UMS-607', 'MG', 'Contagem',              -19.932, -44.054, 'online'),
      ('UMS-608', 'BA', 'Feira de Santana',      -12.267, -38.966, 'degraded'),
      ('UMS-609', 'BA', 'Vitória da Conquista',  -14.866, -40.839, 'online'),
      ('UMS-610', 'PE', 'Caruaru',               -8.284, -35.976, 'online'),
      ('UMS-611', 'PE', 'Petrolina',             -9.398, -40.501, 'unknown'),
      ('UMS-612', 'CE', 'Juazeiro do Norte',     -7.213, -39.315, 'offline'),
      ('UMS-613', 'AM', 'Parintins',             -2.629, -56.736, 'degraded'),
      ('UMS-614', 'PA', 'Santarém',              -2.443, -54.708, 'online'),
      ('UMS-615', 'RS', 'Pelotas',               -31.772, -52.342, 'online')
    ) AS s(code, state_code, city, lat, lon, target_status)
  LOOP
    INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
    VALUES (v_tenant_id, v_row.code, 'Unidade Móvel ' || v_row.city, v_row.state_code, v_row.city, v_row.lat, v_row.lon)
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
    RETURNING id INTO v_unit;

    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, contracted_download_mbps, contracted_upload_mbps)
    VALUES (v_tenant_id, v_unit, v_type_link, 'Link Internet WAN1 - ' || v_row.city, 'SEED-' || v_row.code || '-LNK', 100, 40)
    ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_equip;

    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
    VALUES (v_tenant_id, v_unit, v_type_mikrotik, 'Mikrotik WAN1 - ' || v_row.city, 'SEED-' || v_row.code || '-MKT')
    ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name;

    IF v_row.target_status = 'unknown' THEN
      DELETE FROM equipment_status_snapshots WHERE equipment_id = v_equip;
    ELSE
      INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
      VALUES (v_equip, v_tenant_id, v_row.target_status::operational_status, now(), '{"source":"seed_demo"}')
      ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;
      INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES
        (v_tenant_id, v_equip, 'network.latency.ms', CASE v_row.target_status WHEN 'offline' THEN 0 WHEN 'degraded' THEN 172 ELSE 12 + random() * 30 END, 'ms', now(), '{"source":"seed_demo"}'),
        (v_tenant_id, v_equip, 'network.loss.pct', CASE v_row.target_status WHEN 'offline' THEN 100 WHEN 'degraded' THEN 8.1 ELSE round((random() * 1.2)::numeric, 2) END, '%', now(), '{"source":"seed_demo"}'),
        (v_tenant_id, v_equip, 'network.in.bps', CASE v_row.target_status WHEN 'offline' THEN 0 ELSE 25000000 + random() * 45000000 END, 'bps', now(), '{"source":"seed_demo"}'),
        (v_tenant_id, v_equip, 'network.out.bps', CASE v_row.target_status WHEN 'offline' THEN 0 ELSE 7000000 + random() * 13000000 END, 'bps', now(), '{"source":"seed_demo"}');
    END IF;

    INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
    VALUES (v_unit, v_tenant_id, v_row.target_status::operational_status, CASE WHEN v_row.target_status IN ('degraded','offline') THEN 1 ELSE 0 END, now())
    ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at;

    IF v_row.target_status IN ('degraded', 'offline') THEN
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
      VALUES (v_tenant_id, v_unit, v_equip, 'seed-more-units-' || v_row.code,
        CASE v_row.target_status WHEN 'offline' THEN 'Interface WAN sem resposta' ELSE 'Latência acima do aceitável' END,
        CASE v_row.target_status WHEN 'offline' THEN 4 ELSE 3 END, 'open',
        now() - (random() * interval '3 hours'), '{"source":"seed_demo"}')
      ON CONFLICT (integration_id, external_id) DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'Seed de mais unidades concluído.';
END $$;
