-- Keep skipped rows separate from imported and rejected rows in run/file history.
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS skipped_rows INTEGER NOT NULL DEFAULT 0;

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS skipped_rows INTEGER NOT NULL DEFAULT 0;
