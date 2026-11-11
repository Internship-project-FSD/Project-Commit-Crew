
require('dotenv').config();
const { chromium } = require('playwright');

async function loginToMockDMS() {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 500
    });

    const page = await browser.newPage();

    await page.goto(process.env.DMS_URL);

    console.log('Mock DMS opened');

    await page.locator('#username').fill(process.env.DMS_USERNAME);
    await page.locator('#password').fill(process.env.DMS_PASSWORD);

    console.log('Login credentials entered');

    await page.getByTestId('auth-submit').click();

    await page.waitForTimeout(3000);

    console.log('Current page:', await page.title());
    console.log('Current URL:', page.url());
    console.log('Login automation completed!');

    await page.waitForTimeout(15000);

    await browser.close();
}

loginToMockDMS();
