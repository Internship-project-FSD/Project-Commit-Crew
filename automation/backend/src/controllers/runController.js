import { getRuns, getRunById } from '../services/runService.js';
import { runFullImport } from '../services/importService.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYWRIGHT_DIR = path.resolve(
  __dirname,
  '../../../playwright'
);

const PLAYWRIGHT_SCRIPT = path.join(
  PLAYWRIGHT_DIR,
  'run-all-reports.js'
);

async function startRun(req, res, next) {
  try {
    console.log('DEBUG: startRun controller reached');
    const { startDate, endDate } = req.body.dateRange || {};
    const reportId = req.body.reportId || 'all';

    // Validate the selected dates
    const isValidDate = (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
        return false;
      }

      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
    };

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        error: 'Please provide valid start and end dates.'
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        error: 'Start date cannot be after end date.'
      });
    }

    // 1. Launch Playwright and download the selected reports
    console.log('\nStarting Playwright automation...');

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [PLAYWRIGHT_SCRIPT, startDate, endDate, reportId],
      {
        cwd: PLAYWRIGHT_DIR,
        timeout: 10 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024
      }
    );

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log('Playwright automation completed.');

    // 2. Import downloaded CSV files into PostgreSQL
    console.log('\nStarting CSV import...');

    const result = await runFullImport('manual',reportId);

    // 3. Return the actual import results
    res.json(result);

  } catch (err) {
    console.error('Automation run failed:', err.message);

    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);

    return res.status(500).json({
      error: 'Automation run failed.',
      details: err.stderr || err.stdout || err.message
    });
  }
}

async function listRuns(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const runs = await getRuns(limit, offset);
    res.json(runs);
  } catch (err) {
    next(err);
  }
}

async function getRun(req, res, next) {
  try {
    const run = await getRunById(parseInt(req.params.id));
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) {
    next(err);
  }
}
export { startRun, listRuns, getRun };
