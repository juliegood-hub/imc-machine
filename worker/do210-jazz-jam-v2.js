#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: false,
    args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 1200 },
  });
  const page = await browser.newPage();

  // Login
  await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
  await page.type('#user_email', 'thisisthegoodlife@juliegood.com');
  await page.type('#user_password', '$up3rG00d');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
  console.log('Logged in');

  // Create event
  await page.goto('https://do210.com/events/new', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Title
  await page.$eval('#event_title', (el, v) => el.value = v, 'Jazz Jam Thursdays at The Dakota');
  
  // Venue - type slowly and wait for autocomplete
  const venueInput = await page.$('#venue_title_es');
  await venueInput.click({ clickCount: 3 });
  await venueInput.type('Dakota East Side', { delay: 80 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Try picking autocomplete
  let picked = await page.evaluate(() => {
    const items = document.querySelectorAll('.ui-autocomplete .ui-menu-item a, .ui-autocomplete li a, .ui-menu-item');
    for (const item of items) {
      if (item.textContent && !item.textContent.includes('See All')) {
        item.click();
        return item.textContent.trim();
      }
    }
    return null;
  });
  console.log('Venue picked:', picked);
  
  if (!picked) {
    // Manually set venue ID for The Dakota (we know it from Karavan event: 480257 or similar)
    // Check what the Karavan event used
    console.log('Trying keyboard selection...');
    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));
    const venueId = await page.$eval('#event_venue_id', el => el.value);
    console.log('Venue ID after keyboard:', venueId);
  }

  await new Promise(r => setTimeout(r, 1000));
  const venueId = await page.$eval('#event_venue_id', el => el.value);
  console.log('Final venue ID:', venueId);

  // Date
  await page.$eval('#event_begin_date', (el, v) => el.value = v, '2026-02-26');

  // Time: 8 PM - 11 PM
  await page.select('#event_begin_time_4i', '20');
  await page.select('#event_begin_time_5i', '00');
  await page.select('#event_end_time_4i', '23');
  await page.select('#event_end_time_5i', '00');

  // Free
  await page.evaluate(() => {
    const cb = document.querySelector('#event_event_setting_attributes_free_event');
    if (cb && !cb.checked) cb.click();
  });

  // Category: Music = 557
  await page.select('#event_category_id', '557');

  // Hero image
  const fileInput = await page.$('#cloudinary_hero_image_picture');
  if (fileInput) {
    await fileInput.uploadFile('/tmp/jazz-jam-poster.png');
    console.log('Hero image uploaded');
  }

  // Submit form
  await page.evaluate(() => {
    const btn = document.querySelector('input[name="commit"]');
    if (btn) btn.click();
    else document.querySelector('form.new_event, form[action*="event"]').submit();
  });
  console.log('Submitted');
  await new Promise(r => setTimeout(r, 8000));
  console.log('URL after submit:', page.url());

  // If we landed on the event page, add description
  if (page.url().match(/\/events\/\d+/) || page.url().match(/\/events\/202/)) {
    console.log('On event page, adding description...');
    await new Promise(r => setTimeout(r, 3000));
    
    const desc = `Every Thursday night, guitarist Toro Flores hosts an open jazz jam at The Dakota East Side Ice House. The house band — Brandon Rivas on bass and Andres Montez on drums — lays down the groove while musicians from across San Antonio bring their instruments and sit in. Whether you play or just listen, it's a night of raw, improvised jazz in the heart of the East Side. Free admission, 8 PM to 11 PM. Bring your instrument.`;
    
    // Click the description area to activate it
    await page.evaluate(() => {
      const el = document.querySelector('#ds-custom-page-content, .ds-event-description');
      if (el) { el.click(); el.focus(); }
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate((d) => {
      const el = document.querySelector('[contenteditable="true"]');
      if (el) {
        el.innerHTML = '<p>' + d + '</p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, desc);
    console.log('Description added');
    
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('a, button')].find(b => (b.textContent || '').toLowerCase().trim() === 'save');
      if (btn) btn.click();
    });
    console.log('Saved');
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('Final URL:', page.url());
  await browser.close();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
