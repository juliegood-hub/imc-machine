#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const events = [
  {
    url: 'https://do210.com/events/2026/2/22/comedy-open-mic-find-your-funny-tickets',
    desc: `Ready to test your comedic chops? Comedy Open Mic: Find Your Funny is a weekly open mic night at Mia's Midtown Meetup, hosted by Javier "Javi" Bazaldua and presented by Heavy City Productions. Whether you're a seasoned stand-up or stepping on stage for the first time, this is your night. Sign up at the door, grab the mic, and find your funny. Free admission, all ages, every Saturday at 7:30 PM.`
  },
  {
    url: 'https://do210.com/events/2026/2/24/karavan-studio-s-belly-dance-tuesdays-tickets',
    desc: `Experience the magic of live music and improvisational belly dance every Tuesday at The Dakota East Side Ice House! Led by San Antonio belly dance pioneer Karen Barbee, members of Karavan Studio's Project Band perform dynamic, freestyle belly dance to the soulful, funky sounds of Isaac & Co and other live musicians. This weekly event is part performance and part jam session — dancers and musicians feed off each other's energy to create one-of-a-kind grooves. All ages welcome. No cover charge!`
  }
];

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

  for (const evt of events) {
    console.log('\n=== Processing:', evt.url);
    await page.goto(evt.url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // Debug: find all editable areas on the page
    const editables = await page.evaluate(() => {
      const results = [];
      // Medium editor elements
      document.querySelectorAll('.medium-editor-element, [data-medium-editor-element], [contenteditable="true"], .editable, [data-editable]').forEach(el => {
        results.push({
          tag: el.tagName,
          class: el.className?.substring(0, 120),
          id: el.id,
          placeholder: el.getAttribute('data-placeholder') || el.getAttribute('placeholder') || '',
          contentEditable: el.contentEditable,
          text: el.textContent?.substring(0, 80),
          rect: el.getBoundingClientRect()
        });
      });
      // Also look for any description-related divs
      document.querySelectorAll('[class*="desc"], [class*="about"], [class*="body"], [id*="desc"]').forEach(el => {
        results.push({
          tag: el.tagName,
          class: el.className?.substring(0, 120),
          id: el.id,
          contentEditable: el.contentEditable,
          text: el.textContent?.substring(0, 80)
        });
      });
      return results;
    });
    console.log('Editable elements:', JSON.stringify(editables, null, 2));

    // Try clicking on a potential description area to activate Medium Editor
    const clicked = await page.evaluate(() => {
      // Look for "Add a description", "Click to edit", or empty description areas
      const candidates = document.querySelectorAll('.editable, [data-editable], .medium-editor-element, [contenteditable], .event-description, .description');
      const results = [];
      for (const el of candidates) {
        results.push({ class: el.className?.substring(0, 80), text: el.textContent?.substring(0, 40) });
        el.click();
        el.focus();
      }
      return results;
    });
    console.log('Clicked on:', JSON.stringify(clicked));

    await new Promise(r => setTimeout(r, 2000));

    // Check again after clicking
    const afterClick = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        results.push({
          tag: el.tagName,
          class: el.className?.substring(0, 120),
          id: el.id,
          placeholder: el.getAttribute('data-placeholder') || '',
          text: el.textContent?.substring(0, 80)
        });
      });
      return results;
    });
    console.log('After click, contenteditable elements:', JSON.stringify(afterClick, null, 2));

    // Try to type into any contenteditable
    if (afterClick.length > 0) {
      const typed = await page.evaluate((desc) => {
        const el = document.querySelector('[contenteditable="true"]');
        if (el) {
          el.focus();
          el.innerHTML = '<p>' + desc + '</p>';
          // Trigger events for Medium Editor to pick up
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }
        return false;
      }, evt.desc);
      console.log('Typed description:', typed);
      
      // Wait for auto-save
      await new Promise(r => setTimeout(r, 5000));
      
      // Check if there's a save/update button
      const saved = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('a, button, input[type="submit"]')];
        for (const btn of btns) {
          const txt = (btn.value || btn.textContent || '').toLowerCase().trim();
          if (txt === 'save' || txt === 'update' || txt === 'done') {
            btn.click();
            return txt;
          }
        }
        return null;
      });
      console.log('Save button:', saved);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  await browser.close();
  console.log('\nDone!');
}

run().catch(e => { console.error(e); process.exit(1); });
