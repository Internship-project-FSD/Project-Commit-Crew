const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { chromium } = require('playwright');

const INCOMING_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'downloads',
  'incoming'
);

const REPORTS = [
  {
    id: 'vehicle-sales-purchases',
    name: 'Vehicle Sales & Purchases'
  },
  {
    id: 'service-transactions',
    name: 'Service Transactions'
  },
  {
    id: 'spare-parts-sales-purchases',
    name: 'Spare Parts Sales & Purchases'
  },
  {
    id: 'insurance-renewals',
    name: 'Insurance Renewals'
  }
];

async function runAllReports(
  startDate = '2026-01-01',
  endDate = '2026-01-10',
  reportId = 'all',
  authMode = 'manual'
) {  if (startDate > endDate) {
    throw new Error('Start date cannot be after end date.');
  }

  const selectedReports = reportId === 'all'
    ? REPORTS
    : REPORTS.filter(report => report.id === reportId);

  if (selectedReports.length === 0) {
    throw new Error(`Invalid report ID: ${reportId}`);
  }
  if (
  !process.env.DMS_URL ||
  !process.env.DMS_USERNAME ||
  !process.env.DMS_PASSWORD
    ) {
      throw new Error('Missing Mock DMS configuration in .env');
    }

    if (
      authMode === 'scheduled' &&
      (!process.env.DMS_API_URL || !process.env.AUTOMATION_SECRET)
    ) {
      throw new Error('Missing scheduled automation configuration.');
    }

    if (!['manual', 'scheduled'].includes(authMode)) {
      throw new Error(`Invalid authentication mode: ${authMode}`);
    }

  fs.mkdirSync(INCOMING_DIR, { recursive: true });

  const isHeadless = process.env.PLAYWRIGHT_HEADLESS === 'true';
  const browser = await chromium.launch({
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 300
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: true
    });

    const page = await context.newPage();

    // 1. Authentication
      if (authMode === 'scheduled') {
        console.log('\nUsing scheduled automation authentication...');

        const response = await context.request.post(
          `${process.env.DMS_API_URL}/api/auth/automation-login`,
          {
            data: {
              username: process.env.DMS_USERNAME,
              password: process.env.DMS_PASSWORD
            },
            headers: {
              'x-automation-secret': process.env.AUTOMATION_SECRET
            }
          }
        );

        if (!response.ok()) {
          const errorBody = await response.text();
          throw new Error(
            `Scheduled login failed (${response.status()}): ${errorBody}`
          );
        }

        console.log('Scheduled authentication successful!');
        await page.goto(process.env.DMS_URL);

      } else {
        console.log('\nOpening Mock DMS...');
        await page.goto(process.env.DMS_URL);

        console.log('Please complete the email OTP in the browser.');

        await page.locator('#username').fill(process.env.DMS_USERNAME);
        await page.locator('#password').fill(process.env.DMS_PASSWORD);
        await page.getByTestId('auth-submit').click();
      }

      // Wait for access to the reports.
      const loginTimeout = authMode === 'manual'
        ? 5 * 60 * 1000
        : 15000;

      await page.getByTestId(
        `report-link-${selectedReports[0].id}`
      ).waitFor({ timeout: loginTimeout });

      console.log('Login successful!');

    // 3. Process each report
    for (const report of selectedReports) {
      console.log(`\nProcessing: ${report.name}`);

      await page.getByTestId(
        `report-link-${report.id}`
      ).click();

      // Select date range
     await page.getByTestId('start-date').fill(startDate);
     await page.getByTestId('end-date').fill(endDate);

      // Use normal synthetic data
      await page.getByTestId('scenario').selectOption('normal');

      // Generate report
      await page.getByTestId('generate-report').click();

      const status = page.getByTestId('status-message');
      await status.waitFor({ timeout: 15000 });

      const message = await status.textContent();

      if (!message || !message.includes('Report generated:')) {
        throw new Error(
          `Report generation failed: ${report.name}. ${message || ''}`
        );
      }

      console.log(message.trim());

      // Start listening before clicking Download
      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('download-csv').click();

      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      const filePath = path.join(INCOMING_DIR, filename);

      await download.saveAs(filePath);

      console.log(`Downloaded: ${filename}`);
      console.log(`Saved to: ${filePath}`);
    }

    console.log('\nAll four reports downloaded successfully!');


  } finally {
    await browser.close();
  }
}
const [startDate, endDate, reportId = 'all', authMode = 'manual'] = process.argv.slice(2);

runAllReports(
  startDate || '2026-01-01',
  endDate || '2026-01-10',
  reportId,
  authMode
).catch(error => {
  console.error('\nAutomation failed:', error.message);
  process.exitCode = 1;
});
