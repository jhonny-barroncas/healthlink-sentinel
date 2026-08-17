ALTER TABLE equipment
  ADD COLUMN contracted_download_mbps numeric(12,3),
  ADD COLUMN contracted_upload_mbps numeric(12,3),
  ADD CONSTRAINT equipment_contracted_download_positive
    CHECK (contracted_download_mbps IS NULL OR contracted_download_mbps > 0),
  ADD CONSTRAINT equipment_contracted_upload_positive
    CHECK (contracted_upload_mbps IS NULL OR contracted_upload_mbps > 0);

COMMENT ON COLUMN equipment.contracted_download_mbps IS
  'Velocidade contratada de download, cadastrada pelo operador em Mbps; nunca inferida da telemetria.';
COMMENT ON COLUMN equipment.contracted_upload_mbps IS
  'Velocidade contratada de upload, cadastrada pelo operador em Mbps; nunca inferida da telemetria.';
