-- D02 BR-09 / Test Plan TC-23: every staging and final record can be tied to a run.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'stg_vehicle_sales', 'stg_service_transactions', 'stg_spare_parts', 'stg_insurance_renewals',
    'vehicle_sales', 'service_transactions', 'spare_parts', 'insurance_renewals'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS run_id INTEGER REFERENCES runs(id)', table_name);
    EXECUTE format('UPDATE %I target SET run_id = files.run_id FROM files WHERE target.file_id = files.id AND target.run_id IS NULL', table_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(run_id)', 'idx_' || table_name || '_run_id', table_name);
  END LOOP;
END $$;
