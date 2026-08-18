-- Seed de demonstração: uma unidade móvel georreferenciada por estado ainda sem
-- cobertura, para popular o mapa geográfico (Visão Geográfica) em todo o Brasil.
-- Idempotente via ON CONFLICT (tenant_id, code).

DO $$
DECLARE
  v_tenant_id uuid;
  v_type_link uuid;
  v_unit uuid;
  v_equip uuid;
  v_state record;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "default" não encontrado.';
  END IF;
  SELECT id INTO v_type_link FROM equipment_types WHERE code = 'internet_link';

  FOR v_state IN
    SELECT * FROM (VALUES
      ('UMS-301', 'AC', 'Rio Branco',        -9.974900, -67.824300),
      ('UMS-302', 'AL', 'Maceió',            -9.649800, -35.708900),
      ('UMS-303', 'AP', 'Macapá',             0.034900, -51.069400),
      ('UMS-304', 'DF', 'Brasília',         -15.794200, -47.882500),
      ('UMS-305', 'ES', 'Vitória',          -20.315500, -40.312800),
      ('UMS-306', 'GO', 'Goiânia',          -16.686900, -49.264800),
      ('UMS-307', 'MA', 'São Luís',          -2.530700, -44.306800),
      ('UMS-308', 'MT', 'Cuiabá',           -15.601000, -56.097400),
      ('UMS-309', 'MS', 'Campo Grande',     -20.469700, -54.620100),
      ('UMS-310', 'MG', 'Belo Horizonte',   -19.916700, -43.934500),
      ('UMS-311', 'PA', 'Belém',             -1.455800, -48.490200),
      ('UMS-312', 'PB', 'João Pessoa',       -7.119500, -34.845000),
      ('UMS-313', 'PR', 'Curitiba',         -25.428400, -49.273300),
      ('UMS-314', 'PI', 'Teresina',          -5.089200, -42.801900),
      ('UMS-315', 'RJ', 'Rio de Janeiro',   -22.906800, -43.172900),
      ('UMS-316', 'RN', 'Natal',             -5.794500, -35.211000),
      ('UMS-317', 'RS', 'Porto Alegre',     -30.034600, -51.217700),
      ('UMS-318', 'RO', 'Porto Velho',       -8.761900, -63.903900),
      ('UMS-319', 'RR', 'Boa Vista',          2.823500, -60.675800),
      ('UMS-320', 'SC', 'Florianópolis',    -27.595400, -48.548000),
      ('UMS-321', 'SP', 'São Paulo',        -23.550500, -46.633300),
      ('UMS-322', 'SE', 'Aracaju',          -10.947200, -37.073100),
      ('UMS-323', 'TO', 'Palmas',           -10.168900, -48.331700)
    ) AS s(code, state_code, city, lat, lon)
  LOOP
    INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
    VALUES (v_tenant_id, v_state.code, 'Unidade Móvel ' || v_state.city, v_state.state_code, v_state.city, v_state.lat, v_state.lon)
    ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
    RETURNING id INTO v_unit;

    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, contracted_download_mbps, contracted_upload_mbps)
    VALUES (v_tenant_id, v_unit, v_type_link, 'Link Internet WAN1 - ' || v_state.city, 'SEED-' || v_state.code || '-LNK', 100, 40)
    ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_equip;

    INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload)
    VALUES (v_equip, v_tenant_id, 'online', now(), '{"source":"seed_demo"}')
    ON CONFLICT (equipment_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, observed_at = EXCLUDED.observed_at;

    INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES
      (v_tenant_id, v_equip, 'network.latency.ms', 15 + random() * 40, 'ms', now(), '{"source":"seed_demo"}'),
      (v_tenant_id, v_equip, 'network.loss.pct', round((random() * 1.5)::numeric, 2), '%', now(), '{"source":"seed_demo"}'),
      (v_tenant_id, v_equip, 'network.in.bps', 30000000 + random() * 40000000, 'bps', now(), '{"source":"seed_demo"}'),
      (v_tenant_id, v_equip, 'network.out.bps', 8000000 + random() * 15000000, 'bps', now(), '{"source":"seed_demo"}');

    INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
    VALUES (v_unit, v_tenant_id, 'online', 0, now())
    ON CONFLICT (unit_id) DO UPDATE SET operational_status = EXCLUDED.operational_status, active_alerts_count = EXCLUDED.active_alerts_count, observed_at = EXCLUDED.observed_at;
  END LOOP;

  RAISE NOTICE 'Seed de unidades por estado concluído.';
END $$;
