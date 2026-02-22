#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

async function test() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();

  try {
    console.log('1. Testing Do210...');
    await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('   URL:', page.url());
    await page.screenshot({ path: 'screenshots/do210-test.png' });
    const do210Form = await page.$('input[type="email"], input#user_email');
    console.log('   Login form found:', !!do210Form, '✅');
  } catch (e) {
    console.log('   Do210 error:', e.message);
  }

  try {
    console.log('2. Testing TPR...');
    await page.goto('https://www.tpr.org/community-calendar-event-submission', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('   URL:', page.url());
    await page.screenshot({ path: 'screenshots/tpr-test.png' });
    const tprForm = await page.$('form.EventForm-form');
    console.log('   Event form found:', !!tprForm, '✅');
    // Check key fields exist
    const fields = ['event-title', 'venue-name', 'start-time', 'event-description', 'your-information-name'];
    for (const f of fields) {
      const el = await page.$(`[name="${f}"]`);
      console.log(`   Field "${f}":`, el ? '✅' : '❌');
    }
  } catch (e) {
    console.log('   TPR error:', e.message);
  }

  try {
    console.log('3. Testing Evvnt...');
    await page.goto('https://app.evvnt.com/users/sign_in', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('   URL:', page.url());
    await page.screenshot({ path: 'screenshots/evvnt-test.png' });
  } catch (e) {
    console.log('   Evvnt error:', e.message);
  }

  try {
    console.log('4. Testing SA Current (expect Cloudflare block)...');
    await page.goto('https://community.sacurrent.com/sanantonio/Events/AddEvent', { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('   URL:', page.url());
    const blocked = await page.evaluate(() => document.body.innerText.includes('blocked') || document.body.innerText.includes('Cloudflare'));
    console.log('   Cloudflare blocked:', blocked ? '🔒 YES (use wizard)' : '✅ Accessible');
    await page.screenshot({ path: 'screenshots/sacurrent-test.png' });
  } catch (e) {
    console.log('   SA Current error:', e.message);
  }

  await browser.close();
  console.log('\nDone. Screenshots in screenshots/');
}

test().catch(console.error);
