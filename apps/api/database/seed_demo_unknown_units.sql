-- Seed de demonstração: unidades "Sem telemetria" (unknown) em mais estados,
-- para testar a cor cinza em todo o mapa. Equipamento cadastrado, porém sem
-- nenhum equipment_status_snapshots (aguardando a primeira coleta).

DO $$
DECLARE
  v_tenant_id uuid;
  v_type_starlink uuid;
  v_type_mikrotik uuid;
  v_unit uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "default" não encontrado.';
  END IF;
  SELECT id INTO v_type_starlink FROM equipment_types WHERE code = 'starlink';
  SELECT id INTO v_type_mikrotik FROM equipment_types WHERE code = 'mikrotik';

  -- MT Cuiabá: reaproveita a unidade já existente (UMS-308) e some seu status.
  UPDATE health_units SET name = 'Unidade Móvel Cuiabá' WHERE tenant_id = v_tenant_id AND code = 'UMS-308';
  DELETE FROM equipment_status_snapshots WHERE tenant_id = v_tenant_id AND equipment_id IN (SELECT id FROM equipment WHERE tenant_id = v_tenant_id AND serial_number = 'SEED-UMS-308-LNK');
  DELETE FROM unit_status_snapshots us USING health_units hu WHERE hu.id = us.unit_id AND hu.tenant_id = v_tenant_id AND hu.code = 'UMS-308';

  -- Novas unidades dedicadas, criadas já sem telemetria.
  INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
  VALUES (v_tenant_id, 'UMS-401', 'Unidade Móvel Natal (Instalação)', 'RN', 'Natal', -5.7945, -35.2110)
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_unit;
  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
  VALUES (v_tenant_id, v_unit, v_type_starlink, 'Starlink - Natal', 'SEED-401-STL')
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name;

  INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
  VALUES (v_tenant_id, 'UMS-402', 'Unidade Móvel Curitiba (Instalação)', 'PR', 'Curitiba', -25.4284, -49.2733)
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_unit;
  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
  VALUES (v_tenant_id, v_unit, v_type_mikrotik, 'Mikrotik - Curitiba', 'SEED-402-MKT')
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name;

  INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude)
  VALUES (v_tenant_id, 'UMS-403', 'Unidade Móvel Boa Vista (Instalação)', 'RR', 'Boa Vista', 2.8235, -60.6758)
  ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_unit;
  INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number)
  VALUES (v_tenant_id, v_unit, v_type_starlink, 'Starlink - Boa Vista', 'SEED-403-STL')
  ON CONFLICT (tenant_id, serial_number) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '' DO UPDATE SET name = EXCLUDED.name;

  RAISE NOTICE 'Seed de unidades sem telemetria concluído.';
END $$;
