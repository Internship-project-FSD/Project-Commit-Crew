'use strict';

/**
 * E2E Tests: Playwright Browser Automation
 *
 * Tests the actual browser automation workflow using real Chromium.
 * Browser launch is verified without depending on running services.
 * Navigation tests are marked BLOCKED if services are not running.
 *
 * SRS Coverage: CC-120 (complete workflow verification), FR-07 (Playwright automation),
 *               CC-47 (error/failure scenarios), FR-01 to FR-05 (four reports)
 *
 * SERVICES REQUIRED FOR FULL E2E:
 *   - Mock DMS Backend: http://localhost:5000
 *   - Mock DMS Frontend: http://localhost:5174
 *   - Automation Backend: http://localhost:3000
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../../automation/playwright/.env') });
jest.setTimeout(10 * 60 * 1000);

const RUN_E2E_TESTS = process.env.RUN_E2E_TESTS === 'true';
const describeE2E = RUN_E2E_TESTS ? describe : describe.skip;
let chromium;
let browserAvailable = false;
let servicesAvailable = false;

const DMS_API_URL = process.env.DMS_API_URL || 'http://localhost:5000';
const DMS_URL = process.env.DMS_URL || 'http://localhost:5174';

beforeAll(async () => {
  if (!RUN_E2E_TESTS) return;
  try {
    const playwrightPath = require.resolve('playwright', {
      paths: [path.join(__dirname, '../../../automation/playwright')],
    });
    const playwright = require(playwrightPath);
    chromium = playwright.chromium;
    browserAvailable = true;
    console.log('\n  ✔ Playwright chromium module loaded');
  } catch (err) {
    browserAvailable = false;
    if (RUN_E2E_TESTS) throw new Error(`RUN_E2E_TESTS=true but Playwright is not available: ${err.message}`);
  }

  // Check if services are running
  try {
    const http = require('http');
    await new Promise((resolve, reject) => {
      const req = http.get(`${DMS_API_URL}/api/health`, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.setTimeout(2000, () => reject(new Error('timeout')));
    });
    servicesAvailable = true;
    console.log(`  ✔ Mock DMS backend reachable at ${DMS_API_URL}`);
  } catch {
    servicesAvailable = false;
    throw new Error(`RUN_E2E_TESTS=true but Mock DMS backend is not reachable at ${DMS_API_URL}`);
  }
});

// ─── BROWSER LAUNCH ───────────────────────────────────────────────────────────

describeE2E('Playwright — browser launch', () => {
  test('Chromium browser launches and closes successfully', async () => {
    const browser = await chromium.launch({ headless: true });
    expect(browser).toBeDefined();
    const version = browser.version();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
    console.log(`    Browser version: ${version}`);
    await browser.close();
  });

  test('new page opens and can navigate to about:blank', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');
    await browser.close();
  });

  test('page.title() works on blank page', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('about:blank');
    const title = await page.title();
    expect(typeof title).toBe('string');
    await browser.close();
  });
});

// ─── MOCK DMS LOGIN PAGE (requires services) ──────────────────────────────────

describeE2E('Playwright — Mock DMS login page [BLOCKED if services down]', () => {
  let browser;
  let page;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterEach(async () => {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  });

  test('login page loads at DMS_URL', async () => {
    const response = await page.goto(DMS_URL, { timeout: 10000 });
    expect(response.status()).toBeLessThan(500);
  });

  test('login form has username and password fields', async () => {
    await page.goto(DMS_URL, { timeout: 10000 });
    await page.waitForSelector('#username', { timeout: 10000 });
    const usernameInput = await page.$('#username');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');
    expect(usernameInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
  });
});

// ─── AUTOMATION LOGIN (requires services) ─────────────────────────────────────

describeE2E('Playwright — automation-login API [BLOCKED if services down]', () => {
  test('automation-login endpoint responds (CC-120)', async () => {

    const http = require('http');
    const url = require('url');
    const parsed = new url.URL(`${DMS_API_URL}/api/auth/automation-login`);

    const statusCode = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => resolve(res.statusCode));
      req.on('error', reject);
      req.write(JSON.stringify({ secret: 'wrong_secret', username: 'automation' }));
      req.end();
    });

    // Wrong secret should NOT return 200
    expect(statusCode).not.toBe(200);
    expect([400, 401, 403]).toContain(statusCode);
  });
});

// ─── FOUR REPORTS DOWNLOAD (requires all services) ───────────────────────────

describeE2E('Playwright — four reports download [BLOCKED if services down]', () => {
  const FOUR_REPORTS = [
    'vehicle-sales-purchases',
    'service-transactions',
    'spare-parts-sales-purchases',
    'insurance-renewals'
  ];

  for (const reportId of FOUR_REPORTS) {
    test(`report "${reportId}" exists in Mock DMS (CC-120)`, async () => {

      const http = require('http');
      const statusCode = await new Promise((resolve, reject) => {
        const req = http.get(
          `${DMS_API_URL}/api/reports/${reportId}`,
          (res) => resolve(res.statusCode)
        );
        req.on('error', reject);
      });
      // 401 = endpoint exists but needs auth (correct behavior)
      expect([200, 401, 403]).toContain(statusCode);
    });
  }
});

// ─── PLAYWRIGHT SCRIPT EXISTS ─────────────────────────────────────────────────

describeE2E('Playwright — complete four-report download workflow (FR-07, FR-08, FR-10, FR-11)', () => {
  const tempFolderName = `downloads/e2e-${process.pid}-${Date.now()}`;
  const downloadsRoot = path.resolve(__dirname, '../../../downloads');

  test('scheduled automation logs in and downloads all four configured reports', async () => {
    for (const key of ['DMS_USERNAME', 'DMS_PASSWORD', 'AUTOMATION_SECRET', 'DMS_API_URL', 'DMS_URL']) {
      if (!process.env[key]) throw new Error(`E2E test requires ${key} in automation/playwright/.env`);
    }

    const { runAllReports } = require('../../../automation/playwright/run-all-reports.js');
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const dateMap = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
    const today = new Date(Date.UTC(Number(dateMap.year), Number(dateMap.month) - 1, Number(dateMap.day)));
    today.setUTCDate(today.getUTCDate() - 1);
    const yesterday = today.toISOString().slice(0, 10);

    const summary = await runAllReports(yesterday, yesterday, 'all', 'scheduled', {
      downloadFolder: tempFolderName,
      env: process.env,
      chromium,
    });

    expect(summary.status).toBe('success');
    expect(summary.totalReports).toBe(4);
    expect(summary.successCount).toBe(4);
    expect(summary.failedCount).toBe(0);
    for (const result of summary.results) {
      expect(result.status).toBe('success');
      expect(result.value.filename).toMatch(/_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}_run-\d{8}-\d{4}\.csv$/);
      expect(fs.existsSync(result.value.filePath)).toBe(true);
      expect(fs.statSync(result.value.filePath).size).toBeGreaterThan(0);
    }
  }, 9 * 60 * 1000);

  afterAll(() => {
    const tempPath = path.resolve(downloadsRoot, tempFolderName.replace(/^downloads[\\/]/, ''));
    if (tempPath.startsWith(downloadsRoot + path.sep)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  });
});

describe('Playwright — automation script static checks', () => {
  const fs = require('fs');
  const scriptPath = path.join(__dirname, '../../../automation/playwright/run-all-reports.js');

  test('run-all-reports.js exists in automation/playwright/', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  test('run-all-reports.js supports scheduled auth mode and structured results', () => {
    const src = fs.readFileSync(scriptPath, 'utf-8');
    expect(src).toContain('scheduled');
    expect(src).toContain('automation-login');
    expect(src).toContain('DMS_AUTOMATION_RESULT=');
  });

  test('run-all-reports.js supports the four seeded report IDs', () => {
    const src = fs.readFileSync(scriptPath, 'utf-8');
    for (const id of ['vehicle-sales-purchases', 'service-transactions', 'spare-parts-sales-purchases', 'insurance-renewals']) {
      expect(src).toContain(id);
    }
  });
});


