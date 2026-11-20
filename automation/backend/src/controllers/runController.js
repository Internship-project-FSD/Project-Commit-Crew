import { query } from '../config/db.js';
import { startRun as createRun, endRun, getRuns, getRunById } from '../services/runService.js';
import { runFullImport } from '../services/importService.js';
import { logAutomationFailures, extractAutomationSummary } from '../services/reportBatch.js';
import * as logger from '../services/logService.js';
import { selectReportConfigs } from '../services/importHelpers.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYWRIGHT_DIR = path.resolve(__dirname, '../../../playwright');
const PLAYWRIGHT_SCRIPT = path.join(PLAYWRIGHT_DIR, 'run-all-reports.js');

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function startRun(req, res, next) {
  let run;
  try {
    const { startDate, endDate } = req.body?.dateRange || {};
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({ error: 'Please provide valid start and end dates in YYYY-MM-DD format.' });
    }
    if (startDate > endDate) return res.status(400).json({ error: 'Start date cannot be after end date.' });

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (startDate > today || endDate > today) return res.status(400).json({ error: 'Future dates are not allowed. Select today or an earlier date.' });

    const requestedReportId = String(req.body?.reportId || 'all');
    const configsResult = await query('SELECT * FROM report_configs WHERE is_active = true ORDER BY id');
    const selectedConfigs = selectReportConfigs(configsResult.rows, requestedReportId);
    if (!selectedConfigs.length) return res.status(404).json({ error: 'No active report configuration found.' });

    const reports = selectedConfigs.map((config) => ({
      id: config.portal_path || config.report_name,
      name: config.report_name.replaceAll('_', ' '),
      reportName: config.report_name,
      portal_path: config.portal_path || config.report_name,
      report_name: config.report_name,
      download_folder: config.download_folder || 'downloads/incoming',
    }));
    const downloadFolders = Object.fromEntries(reports.map((report) => [report.id, report.download_folder]));
    const automationReportId = requestedReportId === 'all' ? 'all' : reports[0].id;

    run = await createRun('manual');
    await logger.info(run.id, 'Manual automation run started', { reportCount: selectedConfigs.length, reportId: requestedReportId });

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [PLAYWRIGHT_SCRIPT, startDate, endDate, automationReportId, 'manual', JSON.stringify(downloadFolders), JSON.stringify(reports)],
      {
        cwd: PLAYWRIGHT_DIR,
        timeout: 10 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PLAYWRIGHT_HEADLESS: process.env.PLAYWRIGHT_HEADLESS || 'true' },
      }
    );
    if (stderr) console.error(stderr);
    const automationSummary = extractAutomationSummary(stdout);
    if (!automationSummary) throw new Error('Playwright did not return a structured report result.');

    const downloadFailures = await logAutomationFailures(run.id, automationSummary, logger);
    const downloadFailedReports = (automationSummary.results || [])
      .filter((item) => item.status === 'failed')
      .flatMap((item) => [item.reportId, item.reportName])
      .filter(Boolean);

    const result = await runFullImport('manual', requestedReportId, run.id, {
      downloadFailures,
      downloadFailedReports,
      forceReprocess: req.body?.forceReprocess === true,
    });
    return res.json({ ...result, downloadResults: automationSummary.results || [] });
  } catch (error) {
    const message = error.stderr || error.stdout || error.message;
    if (run?.id) {
      await logger.error(run.id, `Automation run failed: ${error.message}`);
      try {
        await endRun(run.id, 'failed', {
          totalFiles: 1, successFiles: 0, failedFiles: 1,
          totalRows: 0, importedRows: 0, skippedRows: 0, rejectedRows: 0,
        });
      } catch (updateError) {
        console.error('Could not mark failed run:', updateError.message);
      }
    }
    console.error('Automation run failed:', error.message);
    return res.status(500).json({ error: 'Automation run failed.', details: String(message).slice(0, 4000), runId: run?.id || null });
  }
}

async function listRuns(req, res, next) {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const offset = Number.parseInt(req.query.offset, 10) || 0;
    res.json(await getRuns(limit, offset));
  } catch (error) { next(error); }
}

async function getRun(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid run ID.' });
    const run = await getRunById(id);
    if (!run) return res.status(404).json({ error: 'Run not found.' });
    return res.json(run);
  } catch (error) { next(error); }
}

export { startRun, listRuns, getRun, isValidDate };
