#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH, headless: 'new',
    args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();
  
  await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
  await page.type('#user_email', 'thisisthegoodlife@juliegood.com');
  await page.type('#user_password', '$up3rG00d');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
  
  await page.goto('https://do210.com/events/new', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Get category options
  const cats = await page.evaluate(() => {
    const sel = document.querySelector('#event_category_id');
    if (!sel) return [];
    return Array.from(sel.options).map(o => ({ value: o.value, text: o.textContent.trim() }));
  });
  console.log('Categories:', JSON.stringify(cats, null, 2));
  
  // Check venue field - is it hidden behind Chosen.js?
  const venueInfo = await page.evaluate(() => {
    const v = document.querySelector('#venue_title_es');
    if (!v) return { found: false };
    const rect = v.getBoundingClientRect();
    const style = window.getComputedStyle(v);
    return {
      found: true,
      visible: style.display !== 'none' && style.visibility !== 'hidden',
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      type: v.type,
      autocomplete: v.classList.contains('ui-autocomplete-input'),
    };
  });
  console.log('Venue field:', JSON.stringify(venueInfo, null, 2));
  
  // Type venue and check autocomplete
  await page.evaluate(() => {
    const v = document.querySelector('#venue_title_es');
    if (v) { v.value = ''; v.focus(); }
  });
  await page.type('#venue_title_es', 'The Dakota', { delay: 100 });
  await new Promise(r => setTimeout(r, 3000));
  
  const suggestions = await page.evaluate(() => {
    const items = document.querySelectorAll('.ui-autocomplete li, .ui-menu-item');
    return Array.from(items).map(i => i.textContent.trim());
  });
  console.log('Venue suggestions:', suggestions);
  
  await page.screenshot({ path: 'screenshots/do210-venue-autocomplete.png' });
  
  await browser.close();
})().catch(console.error);
