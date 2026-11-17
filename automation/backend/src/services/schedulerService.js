import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { query } from '../config/db.js';
import { startRun, endRun } from './runService.js';
import { runFullImport } from './importService.js';
import * as logger from './logService.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Location of the Playwright automation script
const PLAYWRIGHT_DIR = path.resolve(__dirname, '../../../playwright');
const PLAYWRIGHT_SCRIPT = path.join(
  PLAYWRIGHT_DIR,
  'run-all-reports.js'
);

const TIMEZONE = 'Asia/Kolkata';
// Prevent overlapping scheduled batches
let isSchedulerRunning = false;
// Stores registered cron jobs so they can be refreshed
const scheduledJobs = [];

// Converts database report names into the IDs expected by Playwright
const REPORT_ID_MAP = {
  vehicle_sales: 'vehicle-sales-purchases',
  service_transactions: 'service-transactions',
  spare_parts: 'spare-parts-sales-purchases',
  insurance_renewals: 'insurance-renewals'
};

// Calculates the report date range using the saved date strategy
function getDateRange(dateStrategy) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const dateParts = {};

  for (const part of parts) {
    dateParts[part.type] = part.value;
  }

  // Get today's date in Indian Standard Time
  const endDate = new Date(Date.UTC(
    Number(dateParts.year),
    Number(dateParts.month) - 1,
    Number(dateParts.day)
  ));

  // Reports end yesterday, not today
  endDate.setUTCDate(endDate.getUTCDate() - 1);

  let numberOfDays;

  switch (dateStrategy) {
    case 'yesterday':
      numberOfDays = 1;
      break;

    case 'last_7_days':
      numberOfDays = 7;
      break;

    case 'last_30_days':
      numberOfDays = 30;
      break;

    case 'fixed':
      throw new Error(
        'Fixed date strategy requires configured start and end dates.'
      );

    default:
      throw new Error(
        'Unsupported date strategy: ' + dateStrategy
      );
  }

  // Calculate the beginning of the selected date range
  const startDate = new Date(endDate);
  startDate.setUTCDate(
    startDate.getUTCDate() - (numberOfDays - 1)
  );

  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10)
  };
}

async function downloadReport(reportId, startDate, endDate) {
  // Run the Playwright script with the selected report and date range
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [PLAYWRIGHT_SCRIPT, startDate, endDate, reportId, 'scheduled'],
    {
      cwd: PLAYWRIGHT_DIR,
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        PLAYWRIGHT_HEADLESS: 'true'
      }
    }
  );

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
}


async function runScheduledReport(config) {
  const reportId = REPORT_ID_MAP[config.report_name];

  if (!reportId) {
    console.error('Unknown report:', config.report_name);
    return;
  }

  let run;

  try {
    // Create a run record before starting the download
    run = await startRun('scheduled');

    const { startDate, endDate } = getDateRange(
    config.date_strategy || 'yesterday'
    );

    await logger.info(
      run.id,
      'Scheduled report started: ' + config.report_name
    );

    // Download the CSV using Playwright
    await downloadReport(reportId, startDate, endDate);

    // Import the downloaded CSV using the same run ID
    await runFullImport('scheduled', reportId, run.id);

  } catch (err) {
    console.error('Scheduled report failed:', err.message);

    if (run?.id) {
      await logger.error(
        run.id,
        'Scheduled report failed: ' + err.message
      );

      try {
        // Mark the run as failed
        await endRun(run.id, 'failed', {
          totalFiles: 0,
          successFiles: 0,
          failedFiles: 1,
          totalRows: 0,
          importedRows: 0,
          rejectedRows: 0
        });
      } catch (updateError) {
        console.error(
          'Could not update failed run:',
          updateError.message
        );
      }
    }
  }
}

async function initializeScheduler() {
  try {
      // Stop previously registered jobs before loading updated settings
      for (const job of scheduledJobs) {
        job.stop();
      }

      scheduledJobs.length = 0;
    // Fetch all active report configurations
    const result = await query(
      'SELECT * FROM report_configs WHERE is_active = true'
    );

    // Group reports that have the same cron schedule
    const scheduleGroups = {};

    for (const config of result.rows) {
      const schedule = config.schedule;

      if (!schedule || !cron.validate(schedule)) {
        console.warn('Invalid schedule for:', config.report_name);
        continue;
      }

      if (!REPORT_ID_MAP[config.report_name]) {
        console.warn('Unknown report:', config.report_name);
        continue;
      }

      if (!scheduleGroups[schedule]) {
        scheduleGroups[schedule] = [];
      }

      scheduleGroups[schedule].push(config);
    }

    // Register one cron job for each unique schedule
    for (const [schedule, configs] of Object.entries(scheduleGroups)) {
      const job = cron.schedule(schedule, async () => {
        if (isSchedulerRunning) {
        console.log('Previous scheduled batch is still running. Skipping.');
        return;
      }
      isSchedulerRunning = true;
      try {
        console.log('Scheduled reports started:', schedule);
        // Process reports sequentially
        for (const config of configs) {
          await runScheduledReport(config);
        }
      } finally {
        isSchedulerRunning = false;
      }
        }, {
        timezone: TIMEZONE
        });
          scheduledJobs.push(job);
          console.log('Registered schedule:', schedule);
        }

    console.log('Scheduler initialized successfully');

  } catch (err) {
    console.error('Scheduler initialization failed:', err.message);
  }
}

export { initializeScheduler };
