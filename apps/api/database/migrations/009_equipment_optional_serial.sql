ALTER TABLE equipment DROP CONSTRAINT IF EXISTS equipment_tenant_id_serial_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS equipment_tenant_serial_number_unique_idx
  ON equipment (tenant_id, serial_number)
  WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '';
