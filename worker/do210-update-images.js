#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';
const SS = '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots';

const events = [
  {
    name: 'Karavan Belly Dance',
    editUrl: 'https://do210.com/events/16994089/edit',
    imagePath: path.join(SS, 'karavan-poster-gemini.png'),
  },
  {
    name: 'Comedy Open Mic',
    editUrl: 'https://do210.com/events/16994196/edit',
    imagePath: path.join(SS, 'comedy-poster-gemini.png'),
  },
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'new',
    args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();

  // Login
  await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
  await page.type('#user_email', 'thisisthegoodlife@juliegood.com');
  await page.type('#user_password', '$up3rG00d');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
  console.log('Logged in');

  for (const evt of events) {
    console.log(`\nUpdating ${evt.name}...`);
    await page.goto(evt.editUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Upload hero image
    const heroInput = await page.$('#cloudinary_hero_image_picture');
    if (heroInput) await heroInput.uploadFile(evt.imagePath);

    // Upload poster image
    const posterInput = await page.$('#cloudinary_poster_image_picture');
    if (posterInput) await posterInput.uploadFile(evt.imagePath);

    console.log('  Images set, submitting...');
    const btn = await page.$('button[type="submit"].ds-btn');
    if (btn) await btn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    const success = page.url().includes('/events/') && !page.url().includes('/edit');
    console.log(`  ${success ? '✅' : '⚠️'} ${evt.name}: ${page.url()}`);
  }

  await browser.close();
}

run().catch(console.error);
