import cron from 'node-cron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { query } from '../config/db.js';
import { startRun, endRun } from './runService.js';
import { runFullImport } from './importService.js';
import { logAutomationFailures, extractAutomationSummary } from './reportBatch.js';
import * as logger from './logService.js';
import { getDateRange } from './dateRange.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYWRIGHT_DIR = path.resolve(__dirname, '../../../playwright');
const PLAYWRIGHT_SCRIPT = path.join(PLAYWRIGHT_DIR, 'run-all-reports.js');
const TIMEZONE = 'Asia/Kolkata';
let isSchedulerRunning = false;
const scheduledJobs = [];

function toAutomationReport(config) {
  return {
    id: String(config.portal_path || config.report_name),
    name: String(config.report_name || config.name || 'Configured report').replaceAll('_', ' '),
    reportName: String(config.report_name),
    report_name: String(config.report_name),
    portal_path: String(config.portal_path || config.report_name),
    download_folder: config.download_folder || 'downloads/incoming',
  };
}

async function downloadConfiguredReport(config, dates) {
  const report = toAutomationReport(config);
  const folders = { [report.id]: report.download_folder };
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    PLAYWRIGHT_SCRIPT,
    dates.startDate,
    dates.endDate,
    report.id,
    'scheduled',
    JSON.stringify(folders),
    JSON.stringify([report]),
  ], {
    cwd: PLAYWRIGHT_DIR,
    timeout: 10 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_HEADLESS: 'true' },
  });
  if (stderr) console.warn(stderr);
  const summary = extractAutomationSummary(stdout);
  if (!summary || !Array.isArray(summary.results) || summary.results.length !== 1) {
    throw new Error(`Playwright did not return a valid result for ${report.name}.`);
  }
  return { report, summary };
}

async function executeScheduledBatch(configs, schedule) {
  if (isSchedulerRunning) {
    console.log('Previous scheduled batch is still running. Skipping this tick.');
    return;
  }
  isSchedulerRunning = true;
  let run;
  try {
    run = await startRun('scheduled');
    await logger.info(run.id, `Scheduled batch started for ${schedule}`, { reportCount: configs.length });
    const downloadFailures = [];
    const downloadFailedReports = [];

    for (const config of configs) {
      const report = toAutomationReport(config);
      try {
        const dates = getDateRange(config.date_strategy || 'yesterday', config.fixed_start_date, config.fixed_end_date);
        await logger.info(run.id, `Downloading ${report.name}`, { reportId: report.id, ...dates });
        const { summary } = await downloadConfiguredReport(config, dates);
        const failures = await logAutomationFailures(run.id, summary, logger);
        downloadFailures.push(failures);
        for (const result of summary.results.filter((item) => item.status === 'failed')) {
          downloadFailedReports.push(String(result.reportId || report.id), String(result.reportName || report.report_name));
        }
      } catch (error) {
        downloadFailures.push(1);
        downloadFailedReports.push(report.id, report.report_name);
        await logger.error(run.id, `Scheduled download failed for ${report.name}: ${error.message}`, {
          reportId: report.id, reportName: report.report_name,
        });
      }
    }

    await runFullImport('scheduled', 'all', run.id, {
      downloadFailures: downloadFailures.reduce((sum, count) => sum + count, 0),
      downloadFailedReports,
    });
  } catch (error) {
    console.error('Scheduled batch failed:', error.message);
    if (run?.id) {
      await logger.error(run.id, `Scheduled batch failed: ${error.message}`);
      try {
        await endRun(run.id, 'failed', {
          totalFiles: 0, successFiles: 0, failedFiles: 1,
          totalRows: 0, importedRows: 0, skippedRows: 0, rejectedRows: 0,
        });
      } catch (updateError) {
        console.error('Could not update failed scheduled run:', updateError.message);
      }
    }
  } finally {
    isSchedulerRunning = false;
  }
}

async function initializeScheduler() {
  for (const job of scheduledJobs) job.stop();
  scheduledJobs.length = 0;
  try {
    const result = await query('SELECT * FROM report_configs WHERE is_active = true ORDER BY id');
    const scheduleGroups = new Map();
    for (const config of result.rows) {
      const schedule = config.schedule_cron || config.schedule;
      if (!schedule || !cron.validate(schedule)) {
        console.warn('Invalid schedule for:', config.report_name);
        continue;
      }
      if (!config.portal_path && !config.report_name) {
        console.warn('Skipping a report configuration without a portal path/name.');
        continue;
      }
      if (!scheduleGroups.has(schedule)) scheduleGroups.set(schedule, []);
      scheduleGroups.get(schedule).push(config);
    }

    for (const [schedule, configs] of scheduleGroups.entries()) {
      const job = cron.schedule(schedule, () => executeScheduledBatch(configs, schedule), { timezone: TIMEZONE });
      scheduledJobs.push(job);
      console.log(`Registered schedule ${schedule} for ${configs.length} report(s).`);
    }
    console.log(`Scheduler initialized: ${scheduledJobs.length} schedule(s) registered.`);
  } catch (error) {
    console.error('Scheduler initialization failed:', error.message);
    throw error;
  }
}

export { initializeScheduler, getDateRange, toAutomationReport, executeScheduledBatch };
