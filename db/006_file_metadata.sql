-- D02 SRS FR-12: retain file path, byte size and download time with the hash.
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS file_path VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_files_file_hash_status ON files(file_hash, status);
