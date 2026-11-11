const { chromium } = require('playwright');

async function main() {
    const browser = await chromium.launch({
        headless: false
    });
    const page = await browser.newPage();
    await page.goto('https://www.saucedemo.com/');
    await page.locator('#user-name').fill('standard_user');
    await page.locator('#password').fill('secret_sauce');
    await page.locator('#login-button').click();
    await page.waitForURL('**/inventory.html');
    const heading = await page.locator('.title').textContent();

console.log('Page heading:', heading);
    console.log('Login automation completed!');
    await browser.close();
}
main();