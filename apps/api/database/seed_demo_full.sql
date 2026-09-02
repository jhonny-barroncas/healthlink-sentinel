-- Seed de demonstração COMPLETO: popula todo o inventário operacional.
--   * 16 unidades (8 fixas + 8 móveis) espalhadas pelo Brasil, com coordenadas reais;
--   * para cada unidade: servidor de borda, MikroTik, link dedicado, Starlink e túnel VPN;
--   * snapshots de status de equipamento e de unidade nos 4 estados operacionais;
--   * amostras de telemetria de link (network.*) e de Starlink (starlink.*, incl. localização);
--   * fontes de telemetria Starlink (starlink_telemetry_sources);
--   * agentes de coleta (collection_agents) com atribuições, heartbeat e enrollment;
--   * alertas em aberto / reconhecidos / resolvidos e eventos de monitoramento.
--
-- Idempotente: remove tudo que ele mesmo criou (prefixos UFX-3xx / UMS-3xx e
-- marcadores 'seedfull-' / 'seed_demo_full') antes de recriar.

DO $$
DECLARE
  v_tenant   uuid;
  t_srv uuid; t_mkt uuid; t_stl uuid; t_vpn uuid; t_lnk uuid;

  codes  text[]    := ARRAY[
    'UFX-301','UFX-302','UFX-303','UFX-304','UFX-305','UFX-306','UFX-307','UFX-308',
    'UMS-301','UMS-302','UMS-303','UMS-304','UMS-305','UMS-306','UMS-307','UMS-308'];
  names  text[]    := ARRAY[
    'Hospital Regional São Paulo','Hospital Regional Rio de Janeiro','Hospital Regional Belo Horizonte',
    'Hospital Regional Porto Alegre','Hospital Regional Curitiba','Hospital Regional Brasília',
    'Hospital Regional Goiânia','Hospital Regional Florianópolis',
    'Unidade Móvel Belém','Unidade Móvel Manaus','Unidade Móvel São Luís','Unidade Móvel Recife',
    'Unidade Móvel Fortaleza','Unidade Móvel Cuiabá','Unidade Móvel Campo Grande','Unidade Móvel Porto Velho'];
  cities text[]    := ARRAY[
    'São Paulo','Rio de Janeiro','Belo Horizonte','Porto Alegre','Curitiba','Brasília','Goiânia','Florianópolis',
    'Belém','Manaus','São Luís','Recife','Fortaleza','Cuiabá','Campo Grande','Porto Velho'];
  ufs    text[]    := ARRAY[
    'SP','RJ','MG','RS','PR','DF','GO','SC',
    'PA','AM','MA','PE','CE','MT','MS','RO'];
  lats   numeric[] := ARRAY[
    -23.550520,-22.906847,-19.916681,-30.034647,-25.428356,-15.793889,-16.686882,-27.594870,
    -1.455833,-3.119027,-2.530730,-8.047562,-3.731862,-15.601411,-20.469711,-8.761920];
  lngs   numeric[] := ARRAY[
    -46.633308,-43.172897,-43.934493,-51.217658,-49.273251,-47.882778,-49.264789,-48.548219,
    -48.490179,-60.021731,-44.306824,-34.877000,-38.526670,-56.097892,-54.620121,-63.903948];
  types  text[]    := ARRAY[
    'fixed','fixed','fixed','fixed','fixed','fixed','fixed','fixed',
    'mobile','mobile','mobile','mobile','mobile','mobile','mobile','mobile'];
  states text[]    := ARRAY[
    'online','degraded','online','offline','online','degraded','unknown','online',
    'online','degraded','offline','online','degraded','unknown','online','offline'];

  i          int;
  st         text;
  v_unit     uuid;
  v_srv uuid; v_mkt uuid; v_stl uuid; v_lnk uuid; v_vpn uuid;
  v_agent    uuid;
  ag_status  text;
  ag_plat    text;
  ag_hb      timestamptz;
  down_mbps  numeric;
  up_mbps    numeric;
  link_st    text;   -- status dos equipamentos de rede (link/mikrotik/starlink)
  lat_ms     numeric;
  loss_pct   numeric;
BEGIN
  SELECT id INTO v_tenant FROM tenants WHERE slug = 'default' LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant "default" não encontrado.';
  END IF;

  SELECT id INTO t_srv FROM equipment_types WHERE code = 'linux_server';
  SELECT id INTO t_mkt FROM equipment_types WHERE code = 'mikrotik';
  SELECT id INTO t_stl FROM equipment_types WHERE code = 'starlink';
  SELECT id INTO t_vpn FROM equipment_types WHERE code = 'vpn';
  SELECT id INTO t_lnk FROM equipment_types WHERE code = 'internet_link';

  -- ---- limpeza idempotente -------------------------------------------------
  DELETE FROM alerts            WHERE tenant_id = v_tenant AND external_id       LIKE 'seedfull-%';
  DELETE FROM monitoring_events WHERE tenant_id = v_tenant AND external_event_id LIKE 'seedfull-%';
  DELETE FROM health_units      WHERE tenant_id = v_tenant AND (code LIKE 'UFX-3%' OR code LIKE 'UMS-3%');
  --   equipment / snapshots / metric_samples / starlink_telemetry_sources /
  --   collection_agents(+assignments/enrollments/batches) caem por ON DELETE CASCADE.

  FOR i IN 1 .. array_length(codes, 1) LOOP
    st        := states[i];
    down_mbps := 200 + i * 15;
    up_mbps   := 40  + i * 3;
    ag_plat   := CASE WHEN i % 2 = 0 THEN 'linux' ELSE 'windows' END;
    link_st   := CASE WHEN st = 'degraded' THEN 'degraded'
                      WHEN st = 'offline'  THEN 'offline'
                      WHEN st = 'online'   THEN 'online'
                      ELSE 'unknown' END;
    lat_ms    := CASE st WHEN 'online' THEN 18 + i WHEN 'degraded' THEN 140 + i * 3 ELSE 0 END;
    loss_pct  := CASE st WHEN 'online' THEN 0.2 WHEN 'degraded' THEN 5.5 ELSE 0 END;

    ------------------------------------------------------------------ unidade
    INSERT INTO health_units (tenant_id, code, name, state_code, city, latitude, longitude, unit_type)
    VALUES (v_tenant, codes[i], names[i], ufs[i], cities[i], lats[i], lngs[i], types[i])
    RETURNING id INTO v_unit;

    ------------------------------------------------------------- servidor de borda
    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address)
    VALUES (v_tenant, v_unit, t_srv, 'Servidor de Borda - ' || cities[i], 'SEEDF-' || codes[i] || '-SRV', ('10.60.' || i || '.10')::inet)
    RETURNING id INTO v_srv;

    ------------------------------------------------------------------- mikrotik
    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address, contracted_download_mbps, contracted_upload_mbps)
    VALUES (v_tenant, v_unit, t_mkt, 'MikroTik RB5009 - ' || cities[i], 'SEEDF-' || codes[i] || '-MKT', ('10.60.' || i || '.1')::inet, down_mbps, up_mbps)
    RETURNING id INTO v_mkt;

    -------------------------------------------------------------- link dedicado
    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address, contracted_download_mbps, contracted_upload_mbps)
    VALUES (v_tenant, v_unit, t_lnk, 'Link Dedicado - ' || cities[i], 'SEEDF-' || codes[i] || '-LNK', ('10.60.' || i || '.2')::inet, down_mbps, up_mbps)
    RETURNING id INTO v_lnk;

    ---------------------------------------------------------------------- starlink
    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, contracted_download_mbps, contracted_upload_mbps)
    VALUES (v_tenant, v_unit, t_stl, 'Starlink Business - ' || cities[i], 'SEEDF-' || codes[i] || '-STL', 220, 25)
    RETURNING id INTO v_stl;

    -------------------------------------------------------------------- túnel vpn
    INSERT INTO equipment (tenant_id, unit_id, equipment_type_id, name, serial_number, management_address)
    VALUES (v_tenant, v_unit, t_vpn, 'Túnel VPN Regional - ' || cities[i], 'SEEDF-' || codes[i] || '-VPN', ('10.60.' || i || '.254')::inet)
    RETURNING id INTO v_vpn;

    ------------------------------------------------ snapshots de status por equipamento
    IF st <> 'unknown' THEN
      INSERT INTO equipment_status_snapshots (equipment_id, tenant_id, operational_status, observed_at, source_payload) VALUES
        (v_srv, v_tenant, (CASE WHEN st = 'offline' THEN 'offline' ELSE 'online' END)::operational_status, now(), '{"source":"seed_demo_full"}'),
        (v_mkt, v_tenant, link_st::operational_status,                                                     now(), '{"source":"seed_demo_full"}'),
        (v_lnk, v_tenant, link_st::operational_status,                                                     now(), '{"source":"seed_demo_full"}'),
        (v_stl, v_tenant, (CASE WHEN st = 'degraded' THEN 'online' ELSE link_st END)::operational_status,  now(), '{"source":"seed_demo_full"}'),
        (v_vpn, v_tenant, (CASE WHEN st = 'offline' THEN 'offline' ELSE 'online' END)::operational_status, now(), '{"source":"seed_demo_full"}');
    END IF;

    ------------------------------------------------ telemetria de link (network.*)
    IF st IN ('online', 'degraded') THEN
      INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES
        (v_tenant, v_lnk, 'network.latency.ms', lat_ms,                     'ms',  now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_lnk, 'network.loss.pct',   loss_pct,                   '%',   now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_lnk, 'network.in.bps',     down_mbps * 1000000 * 0.62, 'bps', now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_lnk, 'network.out.bps',    up_mbps   * 1000000 * 0.41, 'bps', now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_mkt, 'network.latency.ms', lat_ms + 3,                 'ms',  now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_mkt, 'network.loss.pct',   loss_pct,                   '%',   now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_mkt, 'network.in.bps',     down_mbps * 1000000 * 0.55, 'bps', now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_mkt, 'network.out.bps',    up_mbps   * 1000000 * 0.38, 'bps', now(), '{"source":"seed_demo_full"}');
    END IF;

    ------------------------------------------------ telemetria Starlink (starlink.*)
    IF st IN ('online', 'degraded') THEN
      INSERT INTO metric_samples (tenant_id, equipment_id, metric_key, value, unit, observed_at, source_payload) VALUES
        (v_tenant, v_stl, 'starlink.latency.ms',        CASE st WHEN 'online' THEN 28 + i ELSE 210 + i END, 'ms',      now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.loss.pct',          CASE st WHEN 'online' THEN 0.4 ELSE 9.0 END,        '%',       now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.download.bps',      CASE st WHEN 'online' THEN 185000000 ELSE 70000000 END, 'bps', now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.upload.bps',        CASE st WHEN 'online' THEN 15000000 ELSE 5000000 END,   'bps', now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.uptime.s',          86400 * (3 + i),                                   's',       now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.obstruction.pct',   CASE st WHEN 'online' THEN 0.8 ELSE 4.5 END,        '%',       now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.signal.snr',        CASE st WHEN 'online' THEN 9.5 ELSE 5.5 END,        'dB',      now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.temperature.c',     38 + (i % 6),                                      '°C',      now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.power.w',           95 + (i % 12),                                     'W',       now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.alerts.active',     CASE st WHEN 'online' THEN 0 ELSE 2 END,            'count',   now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.coverage.available', 1,                                                'boolean', now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.location.latitude',  lats[i],                                          'deg',     now(), '{"source":"seed_demo_full"}'),
        (v_tenant, v_stl, 'starlink.location.longitude', lngs[i],                                          'deg',     now(), '{"source":"seed_demo_full"}');
    END IF;

    ------------------------------------------------ fonte de telemetria Starlink
    INSERT INTO starlink_telemetry_sources (tenant_id, equipment_id, source_kind, endpoint, enabled, metadata)
    VALUES (
      v_tenant, v_stl,
      CASE WHEN st = 'unknown' THEN 'official_api' ELSE 'local_agent' END,
      CASE WHEN st = 'unknown' THEN 'https://api.starlink.com/telemetry' ELSE NULL END,
      st <> 'unknown',
      '{"source":"seed_demo_full"}');

    ------------------------------------------------ agente de coleta
    ag_status := CASE
                   WHEN st = 'unknown'        THEN 'pending'
                   WHEN codes[i] = 'UMS-308'  THEN 'revoked'
                   ELSE 'active' END;
    ag_hb := CASE
               WHEN ag_status = 'pending'  THEN NULL
               WHEN ag_status = 'revoked'  THEN now() - interval '2 days'
               WHEN st = 'online'          THEN now()
               WHEN st = 'degraded'        THEN now() - interval '12 seconds'
               ELSE now() - interval '20 minutes' END;

    INSERT INTO collection_agents (
      tenant_id, unit_id, server_equipment_id, platform, status,
      credential_hash, desired_version, installed_version,
      last_heartbeat_at, last_collection_at, enrolled_at, revoked_at)
    VALUES (
      v_tenant, v_unit, v_srv, ag_plat, ag_status,
      CASE WHEN ag_status = 'pending' THEN NULL ELSE encode(digest(codes[i] || '-agent-secret', 'sha256'), 'hex') END,
      '1.0.0',
      CASE WHEN ag_status = 'active' THEN '1.0.0' ELSE NULL END,
      ag_hb, ag_hb,
      CASE WHEN ag_status = 'pending' THEN NULL ELSE now() - interval '4 days' END,
      CASE WHEN ag_status = 'revoked' THEN now() - interval '2 days' ELSE NULL END)
    RETURNING id INTO v_agent;

    INSERT INTO collection_agent_assignments (agent_id, tenant_id, equipment_id, source_kind, active) VALUES
      (v_agent, v_tenant, v_stl, 'starlink',      true),
      (v_agent, v_tenant, v_mkt, 'mikrotik',      true),
      (v_agent, v_tenant, v_lnk, 'internet_link', true);

    IF ag_status = 'pending' THEN
      INSERT INTO collection_agent_enrollments (tenant_id, agent_id, token_hash, expires_at)
      VALUES (v_tenant, v_agent, encode(digest(codes[i] || '-enroll-token', 'sha256'), 'hex'), now() + interval '30 minutes');
    END IF;

    ------------------------------------------------ snapshot de status da unidade
    INSERT INTO unit_status_snapshots (unit_id, tenant_id, operational_status, active_alerts_count, observed_at)
    VALUES (
      v_unit, v_tenant, st::operational_status,
      CASE st WHEN 'degraded' THEN 2 WHEN 'offline' THEN 2 WHEN 'unknown' THEN 0 ELSE 0 END,
      now());

    ------------------------------------------------ alertas
    IF st = 'degraded' THEN
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
      VALUES (v_tenant, v_unit, v_lnk, 'seedfull-' || codes[i] || '-lat', 'Latência acima do limite aceitável', 2, 'open', now() - interval '22 minutes', '{"source":"seed_demo_full"}');
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, acknowledged_at, raw_payload)
      VALUES (v_tenant, v_unit, v_mkt, 'seedfull-' || codes[i] || '-loss', 'Perda de pacotes intermitente no core', 3, 'acknowledged', now() - interval '55 minutes', now() - interval '30 minutes', '{"source":"seed_demo_full"}');
    ELSIF st = 'offline' THEN
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
      VALUES (v_tenant, v_unit, v_vpn, 'seedfull-' || codes[i] || '-vpn', 'Túnel VPN sem resposta', 4, 'open', now() - interval '1 hour 5 minutes', '{"source":"seed_demo_full"}');
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
      VALUES (v_tenant, v_unit, v_srv, 'seedfull-' || codes[i] || '-srv', 'Servidor de borda inacessível', 5, 'open', now() - interval '48 minutes', '{"source":"seed_demo_full"}');
    ELSIF st = 'unknown' THEN
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, raw_payload)
      VALUES (v_tenant, v_unit, v_stl, 'seedfull-' || codes[i] || '-wait', 'Aguardando primeira coleta do agente', 1, 'open', now() - interval '3 hours', '{"source":"seed_demo_full"}');
    ELSE
      INSERT INTO alerts (tenant_id, unit_id, equipment_id, external_id, title, severity, status, opened_at, resolved_at, raw_payload)
      VALUES (v_tenant, v_unit, v_stl, 'seedfull-' || codes[i] || '-obs', 'Obstrução transitória da antena', 2, 'resolved', now() - interval '6 hours', now() - interval '5 hours 10 minutes', '{"source":"seed_demo_full"}');
    END IF;

    ------------------------------------------------ eventos de monitoramento
    INSERT INTO monitoring_events (tenant_id, equipment_id, external_event_id, event_kind, operational_status, severity, title, observed_at, payload) VALUES
      (v_tenant, v_srv, 'seedfull-' || codes[i] || '-ev-srv', 'status',
        CASE WHEN st = 'offline' THEN 'offline' WHEN st = 'unknown' THEN 'unknown' ELSE 'online' END::operational_status,
        CASE WHEN st = 'offline' THEN 5 ELSE 0 END,
        'Coleta de status do servidor de borda', now() - interval '2 minutes', '{"source":"seed_demo_full"}'),
      (v_tenant, v_lnk, 'seedfull-' || codes[i] || '-ev-lnk',
        CASE WHEN st = 'degraded' THEN 'problem' WHEN st = 'offline' THEN 'problem' ELSE 'status' END,
        link_st::operational_status,
        CASE WHEN st = 'degraded' THEN 2 WHEN st = 'offline' THEN 4 ELSE 0 END,
        'Sondagem do link dedicado', now() - interval '90 seconds', '{"source":"seed_demo_full"}');
  END LOOP;

  RAISE NOTICE 'Seed COMPLETO concluído: % unidades, % equipamentos, agentes, telemetria e alertas.',
    array_length(codes, 1), array_length(codes, 1) * 5;
END $$;
