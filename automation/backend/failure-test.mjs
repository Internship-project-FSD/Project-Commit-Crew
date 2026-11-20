import fs from 'node:fs';
import path from 'node:path';
import { query, pool } from './src/config/db.js';
import { startRun, endRun } from './src/services/runService.js';
import { processFile } from './src/services/importService.js';

const incomingDir = path.resolve('../../downloads/incoming');
const failedDir = path.resolve('../../downloads/failed');

const fileName = 'invalid-test-vehicle-sales.csv';
const filePath = path.join(incomingDir, fileName);

async function runFailureTest() {
  try {
    fs.mkdirSync(incomingDir, { recursive: true });

    // Deliberately create a CSV with incorrect headers.
    fs.writeFileSync(
      filePath,
      'WrongColumn,AnotherColumn\nTEST001,TEST002\n',
      'utf8'
    );

    const configResult = await query(
      `SELECT * FROM report_configs
       WHERE report_name = 'vehicle_sales' AND is_active = true
       LIMIT 1`
    );

    if (!configResult.rows.length) {
      throw new Error('Active vehicle_sales configuration not found.');
    }

    const run = await startRun('manual');

    const result = await processFile(
      run.id,
      filePath,
      configResult.rows[0]
    );

    await endRun(
      run.id,
      'failed',
      {
        totalFiles: 1,
        successFiles: 0,
        failedFiles: 1,
        totalRows: result.totalRows || 0,
        importedRows: 0,
        skippedRows: 0,
        rejectedRows: 0,
      }
    );

    console.log('\nFAILURE TEST RESULT');
    console.log(JSON.stringify({
      runId: run.id,
      ...result,
      originalFileStillInIncoming: fs.existsSync(filePath),
      fileMovedToFailed: fs.existsSync(path.join(failedDir, fileName)),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

runFailureTest().catch((error) => {
  console.error('FAILURE TEST ERROR:', error);
  process.exitCode = 1;
});
