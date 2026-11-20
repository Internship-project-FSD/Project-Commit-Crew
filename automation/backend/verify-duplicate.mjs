import { query, pool } from './src/config/db.js';

try {
  const files = await query(
    "SELECT file_name, status, imported_rows, error_message FROM files WHERE run_id = 3"
  );

  const run = await query(
    "SELECT id, status, total_files, success_files, failed_files, imported_rows FROM runs WHERE id = 3"
  );

  console.log('FILE RECORD:', files.rows);
  console.log('RUN RECORD:', run.rows);
} finally {
  await pool.end();
}
