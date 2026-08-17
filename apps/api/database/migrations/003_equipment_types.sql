INSERT INTO equipment_types (code, name) VALUES
  ('linux_server', 'Servidor Linux'),
  ('mikrotik', 'Mikrotik'),
  ('starlink', 'Starlink'),
  ('vpn', 'VPN'),
  ('internet_link', 'Link de internet')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
