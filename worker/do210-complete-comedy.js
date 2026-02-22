#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const IMAGE_PATH = path.resolve(__dirname, '../screenshots/comedy-poster.png');
const EVENT_URL = 'https://do210.com/events/2026/2/22/comedy-open-mic-find-your-funny-tickets';
const EDIT_URL = 'https://do210.com/events/16994196/edit';

const DESC = `Weekly stand-up comedy open mic hosted by Javier "Javi" Bazaldua and presented by Heavy City Productions at Midtown Meetup.

Sign-up begins at 7:30 PM, show starts at 8:00 PM. Open to comics of all levels — whether you're a seasoned performer or trying stand-up for the first time, this is your stage.

Free admission. Find Your Funny!

Presented by Heavy City Productions and Good Creative Media.`;

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
  console.log('1. Logged in');

  // Step 1: Upload image via edit page
  await page.goto(EDIT_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const heroInput = await page.$('#cloudinary_hero_image_picture');
  if (heroInput) {
    await heroInput.uploadFile(IMAGE_PATH);
    console.log('2. Hero image set');
  }
  const posterInput = await page.$('#cloudinary_poster_image_picture');
  if (posterInput) {
    await posterInput.uploadFile(IMAGE_PATH);
    console.log('3. Poster image set');
  }

  // Also mark as free
  const freeChecked = await page.evaluate(() => document.querySelector('#event_event_setting_attributes_free_event')?.checked);
  if (!freeChecked) {
    await page.evaluate(() => {
      const cb = document.querySelector('#event_event_setting_attributes_free_event');
      if (cb) cb.checked = true;
    });
    console.log('4. Marked as free');
  }

  // Submit edit
  const btn = await page.$('button[type="submit"].ds-btn');
  if (btn) await btn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  console.log('5. Edit submitted:', page.url());

  // Step 2: Add description via Medium Editor on event page
  await page.goto(EVENT_URL, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const descDiv = await page.$('.ds-event-description');
  if (descDiv) {
    await descDiv.click();
    await new Promise(r => setTimeout(r, 1000));
    await descDiv.click({ clickCount: 3 }); // Select all
    await page.keyboard.type(DESC);
    await new Promise(r => setTimeout(r, 1000));
    await page.click('body'); // Trigger autosave
    await new Promise(r => setTimeout(r, 3000));
    console.log('6. Description added');
  }

  await page.screenshot({ path: 'screenshots/do210-comedy-complete.png', fullPage: true });
  
  const hasDesc = await page.evaluate(() => document.body.innerText.includes('Heavy City Productions'));
  console.log(hasDesc ? '✅ Comedy Open Mic complete with image + description!' : '⚠️ Description may not have saved');

  await browser.close();
}

run().catch(console.error);
