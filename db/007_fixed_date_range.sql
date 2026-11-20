-- Support the fixed date strategy exposed by report configuration.
ALTER TABLE report_configs
  ADD COLUMN IF NOT EXISTS fixed_start_date DATE,
  ADD COLUMN IF NOT EXISTS fixed_end_date DATE;
