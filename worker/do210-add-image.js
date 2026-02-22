#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const IMAGE_URL = 'https://qavrufepvcihklypxbvm.supabase.co/storage/v1/object/public/media/distribution/karavan-belly-dance-tuesdays.png';

async function addImage(editUrl) {
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

    // Set hero image URL via evaluate (avoid click issues)
    await page.evaluate((url) => {
      const hero = document.querySelector('#cloudinary_hero_image_from_url');
      if (hero) {
        hero.value = url;
        hero.dispatchEvent(new Event('change', { bubbles: true }));
        hero.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const poster = document.querySelector('#cloudinary_poster_image_from_url');
      if (poster) {
        poster.value = url;
        poster.dispatchEvent(new Event('change', { bubbles: true }));
        poster.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, IMAGE_URL);
    console.log('Image URLs set');

    await page.screenshot({ path: 'screenshots/do210-image-edit.png', fullPage: true });

    // Submit via evaluate to avoid click issues
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.submit();
    });
    await new Promise(r => setTimeout(r, 5000));

    await page.screenshot({ path: 'screenshots/do210-image-saved.png', fullPage: true });
    console.log('Saved:', page.url());
  } finally {
    await browser.close();
  }
}

// Karavan event edit URL
addImage('https://do210.com/events/16994089/edit').catch(console.error);
