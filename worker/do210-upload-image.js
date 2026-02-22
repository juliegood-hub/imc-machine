#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const IMAGE_PATH = path.resolve(__dirname, '../screenshots/karavan-poster.png');

async function uploadImage(editUrl) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'new',
    args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();

  try {
    // Login
    await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
    await page.type('#user_email', 'thisisthegoodlife@juliegood.com');
    await page.type('#user_password', '$up3rG00d');
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('Logged in');

    // Go to edit page
    await page.goto(editUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Upload hero image via file input
    const heroInput = await page.$('#cloudinary_hero_image_picture');
    if (heroInput) {
      await heroInput.uploadFile(IMAGE_PATH);
      console.log('Hero image file set');
    } else {
      console.log('No hero image input found');
    }

    // Upload poster image too
    const posterInput = await page.$('#cloudinary_poster_image_picture');
    if (posterInput) {
      await posterInput.uploadFile(IMAGE_PATH);
      console.log('Poster image file set');
    }

    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'screenshots/do210-upload-ready.png', fullPage: true });

    // Submit
    console.log('Submitting...');
    const btn = await page.$('button[type="submit"].ds-btn');
    if (btn) {
      await btn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    }

    await page.screenshot({ path: 'screenshots/do210-upload-result.png', fullPage: true });
    console.log('Result URL:', page.url());

    // Check if we're on the event page
    const success = page.url().includes('/events/') && !page.url().includes('/edit');
    console.log(success ? '✅ Image uploaded!' : '⚠️ May need review');
  } finally {
    await browser.close();
  }
}

const editUrl = process.argv[2] || 'https://do210.com/events/16994089/edit';
uploadImage(editUrl).catch(console.error);
