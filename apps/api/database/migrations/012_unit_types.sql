ALTER TABLE health_units ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'mobile';
ALTER TABLE health_units DROP CONSTRAINT IF EXISTS health_units_unit_type_check;
ALTER TABLE health_units ADD CONSTRAINT health_units_unit_type_check CHECK (unit_type IN ('mobile', 'fixed'));
CREATE INDEX IF NOT EXISTS health_units_tenant_type_idx ON health_units (tenant_id, unit_type);
