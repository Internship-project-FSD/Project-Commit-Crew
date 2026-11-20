-- Generic staging/final storage for additional report types added through report_configs.
-- The four standard report types continue using their typed staging/final tables.
CREATE TABLE IF NOT EXISTS stg_report_records (
  id BIGSERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id),
  run_id INTEGER NOT NULL REFERENCES runs(id),
  report_config_id INTEGER NOT NULL REFERENCES report_configs(id),
  row_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stg_report_records_file_id ON stg_report_records(file_id);

CREATE TABLE IF NOT EXISTS report_records (
  id BIGSERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id),
  run_id INTEGER NOT NULL REFERENCES runs(id),
  report_config_id INTEGER NOT NULL REFERENCES report_configs(id),
  unique_key_hash VARCHAR(64) NOT NULL,
  record_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_report_records_config_unique_key UNIQUE(report_config_id, unique_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_report_records_file_id ON report_records(file_id);
CREATE INDEX IF NOT EXISTS idx_report_records_run_id ON report_records(run_id);
