#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';
const path = require('path');

const EVENT = {
  title: 'Jazz Jam Thursdays at The Dakota',
  venue: 'The Dakota East Side Ice House',
  date: '2026-02-26',
  beginHour: '20', beginMin: '00',
  endHour: '23', endMin: '00',
  category: '557', // Music
  free: true,
  posterPath: '/tmp/jazz-jam-poster.png',
  desc: `Every Thursday night, guitarist Toro Flores hosts an open jazz jam at The Dakota East Side Ice House. The house band — Brandon Rivas on bass and Andres Montez on drums — lays down the groove while musicians from across San Antonio bring their instruments and sit in. Whether you play or just listen, it's a night of raw, improvised jazz in the heart of the East Side. Free admission, 8 PM to 11 PM. Bring your instrument.`
};

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'new',
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
  await page.evaluate(t => { document.querySelector('#event_title').value = t; }, EVENT.title);
  
  // Venue autocomplete
  const venueInput = await page.$('#venue_title_es');
  await venueInput.click({ clickCount: 3 });
  await venueInput.type(EVENT.venue, { delay: 50 });
  await new Promise(r => setTimeout(r, 2000));
  // Select first autocomplete result
  const picked = await page.evaluate(() => {
    const items = document.querySelectorAll('.ui-autocomplete .ui-menu-item, .ui-autocomplete li');
    if (items.length) { items[0].click(); return items[0].textContent; }
    return null;
  });
  console.log('Venue picked:', picked);
  await new Promise(r => setTimeout(r, 500));

  // Date
  await page.evaluate(d => { document.querySelector('#event_begin_date').value = d; }, EVENT.date);

  // Time
  await page.select('#event_begin_time_4i', EVENT.beginHour);
  await page.select('#event_begin_time_5i', EVENT.beginMin);
  await page.select('#event_end_time_4i', EVENT.endHour);
  await page.select('#event_end_time_5i', EVENT.endMin);

  // Free event checkbox
  if (EVENT.free) {
    await page.evaluate(() => {
      const cb = document.querySelector('#event_event_setting_attributes_free_event');
      if (cb && !cb.checked) cb.click();
    });
  }

  // Category
  await page.select('#event_category_id', EVENT.category);

  // Upload hero image
  const fileInput = await page.$('#cloudinary_hero_image_picture');
  if (fileInput && EVENT.posterPath) {
    await fileInput.uploadFile(EVENT.posterPath);
    console.log('Hero image uploaded');
  }

  // Submit
  const submitBtn = await page.$('input[type="submit"][value*="Create"], input[type="submit"][value*="Save"], input[name="commit"]');
  if (submitBtn) {
    await submitBtn.click();
    console.log('Form submitted');
    await new Promise(r => setTimeout(r, 5000));
    console.log('Current URL:', page.url());
  } else {
    // Try form submit
    await page.evaluate(() => document.querySelector('form').submit());
    console.log('Form submitted via JS');
    await new Promise(r => setTimeout(r, 5000));
    console.log('Current URL:', page.url());
  }

  // Now add description on the event page
  const eventUrl = page.url();
  if (eventUrl.includes('/events/')) {
    console.log('\nAdding description...');
    await new Promise(r => setTimeout(r, 3000));
    
    const descAdded = await page.evaluate((desc) => {
      const el = document.querySelector('#ds-custom-page-content, .ds-event-description, [contenteditable="true"]');
      if (el) {
        el.click();
        el.focus();
        el.innerHTML = '<p>' + desc + '</p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }
      return false;
    }, EVENT.desc);
    
    if (descAdded) {
      console.log('Description typed');
      await new Promise(r => setTimeout(r, 2000));
      // Click save
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('a, button')].find(b => (b.textContent || '').toLowerCase().trim() === 'save');
        if (btn) btn.click();
      });
      console.log('Save clicked');
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log('Could not find description field');
    }
  }

  console.log('Final URL:', page.url());
  await browser.close();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
