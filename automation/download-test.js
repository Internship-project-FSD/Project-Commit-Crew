const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
    const browser = await chromium.launch({
        headless: false
    });

    const context = await browser.newContext({
        acceptDownloads: true
    });

    const page = await context.newPage();
    const fileUrl = 'file://' + path.join(__dirname, 'download-page.html');
    await page.goto(fileUrl);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('a[download]').click();
    const download = await downloadPromise
    const folder = path.join(__dirname, 'downloads', 'incoming');
    fs.mkdirSync(folder, { recursive: true });
    const filePath = path.join(folder, download.suggestedFilename());
    await download.saveAs(filePath);
    console.log('Download completed!');
    console.log('File saved at:', filePath);
    await browser.close();
}

main();