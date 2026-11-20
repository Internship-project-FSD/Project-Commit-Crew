const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { chromium } = require('playwright');
const DOWNLOADS_ROOT = path.resolve(__dirname, '..', '..', 'downloads');

const DEFAULT_REPORTS = [
  { id: 'vehicle-sales-purchases', name: 'Vehicle Sales & Purchases', reportName: 'vehicle_sales' },
  { id: 'service-transactions', name: 'Service Transactions', reportName: 'service_transactions' },
  { id: 'spare-parts-sales-purchases', name: 'Spare Parts Sales & Purchases', reportName: 'spare_parts' },
  { id: 'insurance-renewals', name: 'Insurance Renewals', reportName: 'insurance_renewals' },
];

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getDownloadDir(downloadFolder = 'downloads/incoming') {
  if (typeof downloadFolder !== 'string' || !downloadFolder.trim()) throw new Error('Invalid download folder path');
  const relativeFolder = downloadFolder.replace(/^downloads[\\/]/i, '');
  const destination = path.resolve(DOWNLOADS_ROOT, relativeFolder);
  if (destination === DOWNLOADS_ROOT || !destination.startsWith(DOWNLOADS_ROOT + path.sep)) {
    throw new Error('Invalid download folder path');
  }
  return destination;
}

function timestampForFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}-${value.hour}${value.minute}`;
}

function createReportFileName(report, startDate, endDate, date = new Date()) {
  const reportName = String(report.reportName || report.report_name || report.name || report.id)
    .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!reportName) throw new Error('Report name is required for the downloaded CSV');
  return `${reportName}_${startDate}_to_${endDate}_run-${timestampForFilename(date)}.csv`;
}

function validateAutomationConfig(env, authMode) {
  if (!env.DMS_URL || !env.DMS_USERNAME || !env.DMS_PASSWORD) {
    throw new Error('Missing Mock DMS configuration in automation/playwright/.env');
  }
  if (authMode === 'scheduled' && (!env.DMS_API_URL || !env.AUTOMATION_SECRET)) {
    throw new Error('Missing scheduled automation configuration.');
  }
  if (!['manual', 'scheduled'].includes(authMode)) throw new Error(`Invalid authentication mode: ${authMode}`);
}


async function processReportsIndividually(reports, processReport) {
  const results = [];
  for (const report of reports) {
    try {
      const value = await processReport(report);
      results.push({ reportId: report.id, reportName: report.name, status: 'success', value });
    } catch (error) {
      results.push({ reportId: report.id, reportName: report.name, status: 'failed', error: error.message });
    }
  }
  const successCount = results.filter((item) => item.status === 'success').length;
  const failedCount = results.length - successCount;
  return { status: failedCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial', totalReports: results.length, successCount, failedCount, results };
}

async function runAllReports(startDate, endDate, reportId = 'all', authMode = 'manual', options = {}) {
  if (!isValidDate(startDate) || !isValidDate(endDate)) throw new Error('Start and end dates must be valid YYYY-MM-DD dates.');
  if (startDate > endDate) throw new Error('Start date cannot be after end date.');
  const env = options.env || process.env;
  validateAutomationConfig(env, authMode);
  const availableReports = Array.isArray(options.reports) && options.reports.length ? options.reports : DEFAULT_REPORTS;
  const selectedReports = reportId === 'all'
    ? availableReports
    : availableReports.filter((report) => report.id === reportId || report.portal_path === reportId || report.report_name === reportId);
  if (!selectedReports.length) throw new Error(`Invalid report ID: ${reportId}`);

  const browserLauncher = options.chromium || chromium;
  const headless = authMode === 'scheduled';
  const browser = await browserLauncher.launch({ headless, slowMo: headless ? 0 : 250 });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    if (authMode === 'scheduled') {
      const response = await context.request.post(`${env.DMS_API_URL}/api/auth/automation-login`, {
        data: { username: env.DMS_USERNAME, password: env.DMS_PASSWORD },
        headers: { 'x-automation-secret': env.AUTOMATION_SECRET },
      });
      if (!response.ok()) throw new Error(`Scheduled login failed (${response.status()}): ${await response.text()}`);
      await page.goto(env.DMS_URL);
    } else {
      await page.goto(env.DMS_URL);
      await page.locator('#username').fill(env.DMS_USERNAME);
      await page.locator('#password').fill(env.DMS_PASSWORD);
      await page.getByTestId('auth-submit').click();
      console.log('Complete the email OTP in the browser if prompted.');
    }

    await page.getByTestId(`report-link-${selectedReports[0].id}`).waitFor({
      timeout: authMode === 'manual' ? 5 * 60 * 1000 : 15000,
    });

    return await processReportsIndividually(selectedReports, async (report) => {
      await page.getByTestId(`report-link-${report.id}`).click();
      await page.getByTestId('start-date').fill(startDate);
      await page.getByTestId('end-date').fill(endDate);
      await page.getByTestId('scenario').selectOption('normal');
      await page.getByTestId('generate-report').click();

      const status = page.getByTestId('status-message');
      await status.waitFor({ timeout: 15000 });
      const message = await status.textContent();
      if (!message || !message.includes('Report generated:')) {
        throw new Error(`Report generation failed: ${report.name}. ${message || ''}`);
      }

      const downloadPromise = page.waitForEvent('download', {
        timeout: Number(env.DMS_DOWNLOAD_TIMEOUT_MS) > 0 ? Number(env.DMS_DOWNLOAD_TIMEOUT_MS) : 30000,
      });
      await page.getByTestId('download-csv').click();
      const download = await downloadPromise;
      const filename = createReportFileName(report, startDate, endDate);
      const downloadFolder = options.downloadFolders?.[report.id] || report.download_folder || options.downloadFolder || 'downloads/incoming';
      const destinationDir = getDownloadDir(downloadFolder);
      fs.mkdirSync(destinationDir, { recursive: true });
      const filePath = path.join(destinationDir, filename);
      await download.saveAs(filePath);
      return { filename, filePath, message: message.trim() };
    });
  } finally {
    await browser.close();
  }
}

module.exports = { runAllReports, REPORTS: DEFAULT_REPORTS, getDownloadDir, timestampForFilename, createReportFileName };

if (require.main === module) {
  const [startDate, endDate, reportId = 'all', authMode = 'manual', downloadFoldersJson = '{}', reportsJson = ''] = process.argv.slice(2);
  let downloadFolders = {};
  let reports = DEFAULT_REPORTS;
  try { downloadFolders = JSON.parse(downloadFoldersJson); }
  catch { console.error('Invalid download folder JSON argument.'); process.exitCode = 1; }
  if (reportsJson) {
    try { reports = JSON.parse(reportsJson); }
    catch { console.error('Invalid report configuration JSON argument.'); process.exitCode = 1; }
  }
  runAllReports(startDate || '2026-01-01', endDate || '2026-01-10', reportId, authMode, { downloadFolders, reports })
    .then((summary) => console.log(`DMS_AUTOMATION_RESULT=${JSON.stringify(summary)}`))
    .catch((error) => {
      console.error('\nAutomation failed:', error.message);
      process.exitCode = 1;
    });
}
