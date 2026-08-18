-- Seed de demonstração: alertas adicionais variados (severidade/status/idade) para as unidades de teste.
-- Idempotente via UNIQUE (integration_id, external_id) com integration_id NULL — usamos external_id únicos.

DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant "default" não encontrado.';
  END IF;

  -- UMS-201 Recife: pico de latência pontual, já resolvido
  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, resolved_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-alert-201-a', 'Pico de latência transitório', 1, 'resolved', now() - interval '3 hours', now() - interval '2 hours 40 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-201' AND e.name = 'Mikrotik WAN1 - Recife'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  -- UMS-202 Salvador: nova ocorrência crítica em aberto no link
  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-alert-202-b', 'Perda de pacotes acima de 5%', 3, 'open', now() - interval '9 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-202' AND e.name = 'Link Internet WAN1 - Salvador'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  -- UMS-202 Salvador: reboot do mikrotik, reconhecido pelo operador
  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, acknowledged_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-alert-202-c', 'Reinicialização inesperada do equipamento', 2, 'acknowledged', now() - interval '35 minutes', now() - interval '20 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-202' AND e.name = 'Mikrotik Core - Salvador'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  -- UMS-203 Fortaleza: falha crítica de energia, em aberto
  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-alert-203-b', 'Falha de energia no rack principal', 5, 'open', now() - interval '4 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-203' AND e.name = 'Servidor Local - Fortaleza'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  -- UMS-203 Fortaleza: instabilidade de VPN já resolvida
  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, resolved_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-alert-203-c', 'Túnel VPN reconectando com frequência', 1, 'resolved', now() - interval '1 day 2 hours', now() - interval '1 day 1 hour 10 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-203' AND e.name = 'VPN Site-to-Site - Fortaleza'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  -- UMS-204 Manaus: sem coleta de telemetria (starlink aguardando primeira leitura)
  INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
  SELECT v_tenant_id, u.id, e.id, 'seed-alert-204-a', 'Nenhuma telemetria recebida desde o cadastro', 2, 'open', now() - interval '1 hour 15 minutes', '{"source":"seed_demo"}'
  FROM health_units u JOIN equipment e ON e.unit_id = u.id
  WHERE u.tenant_id = v_tenant_id AND u.code = 'UMS-204' AND e.name = 'Starlink - Manaus'
  ON CONFLICT (integration_id, external_id) DO NOTHING;

  RAISE NOTICE 'Seed de alertas de demonstração concluído.';
END $$;
