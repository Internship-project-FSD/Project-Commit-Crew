import { query, pool } from './src/config/db.js';

try {
  const file = await query(
    `SELECT file_name, status, total_rows, imported_rows, error_message
     FROM files
     WHERE file_name = 'invalid-test-vehicle-sales.csv'`
  );

  const run = await query(
    `SELECT id, status, total_files, success_files, failed_files, imported_rows
     FROM runs
     WHERE id = 4`
  );

  console.log('\nFILE DATABASE RECORD:');
  console.log(JSON.stringify(file.rows, null, 2));

  console.log('\nRUN DATABASE RECORD:');
  console.log(JSON.stringify(run.rows, null, 2));
} finally {
  await pool.end();
}
