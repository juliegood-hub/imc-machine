#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const events = [
  {
    url: 'https://do210.com/events/16994196/edit',
    desc: `Ready to test your comedic chops? Comedy Open Mic: Find Your Funny is a weekly open mic night at Mia's Midtown Meetup, hosted by Javier "Javi" Bazaldua and presented by Heavy City Productions. Whether you're a seasoned stand-up or stepping on stage for the first time, this is your night. Sign up at the door, grab the mic, and find your funny. Free admission, all ages, every Saturday at 7:30 PM. Midtown Meetup — 801 West Russell Place, San Antonio.`
  },
  {
    url: 'https://do210.com/events/16994089/edit',
    desc: `Experience the magic of live music and improvisational belly dance every Tuesday at The Dakota East Side Ice House! Led by San Antonio belly dance pioneer Karen Barbee, members of Karavan Studio's Project Band perform dynamic, freestyle belly dance to the soulful, funky sounds of Isaac & Co and other live musicians. This weekly event is part performance and part jam session — dancers and musicians feed off each other's energy to create one-of-a-kind grooves. Come relax on the dog-friendly patio, enjoy drinks and delicious eats, and immerse yourself in East Side vibes. All ages welcome. No cover charge — bring your friends and support local artists!`
  }
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
    console.log('Processing:', evt.url);
    await page.goto(evt.url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Find the description textarea or Medium Editor contenteditable
    const added = await page.evaluate((desc) => {
      // Try textarea first
      const ta = document.querySelector('textarea[name*="description"], textarea[name*="about"], textarea#event_description');
      if (ta) { ta.value = desc; ta.dispatchEvent(new Event('input', { bubbles: true })); return 'textarea'; }
      
      // Try Medium Editor contenteditable
      const ce = document.querySelector('.medium-editor-element, [data-medium-editor-element], [contenteditable="true"]');
      if (ce) { ce.innerHTML = '<p>' + desc + '</p>'; ce.dispatchEvent(new Event('input', { bubbles: true })); return 'contenteditable'; }
      
      return null;
    }, evt.desc);

    if (added) {
      console.log(`  Description added via ${added}`);
      // Try to save
      const saved = await page.evaluate(() => {
        const btn = document.querySelector('input[type="submit"], button[type="submit"], .btn-primary, [value="Update Event"], [value="Save"]');
        if (btn) { btn.click(); return btn.textContent || btn.value; }
        return null;
      });
      if (saved) {
        console.log(`  Clicked save: ${saved}`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log('  No save button found, trying form submit');
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.submit();
        });
        await new Promise(r => setTimeout(r, 3000));
      }
    } else {
      // Try the event view page with inline Medium Editor
      const viewUrl = evt.url.replace('/edit', '');
      console.log('  No form field found, trying inline edit at:', viewUrl);
      await page.goto(viewUrl, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));
      
      const inlineAdded = await page.evaluate((desc) => {
        const ce = document.querySelector('.medium-editor-element, [data-medium-editor-element], [contenteditable="true"], .editable');
        if (ce) {
          ce.focus();
          ce.innerHTML = '<p>' + desc + '</p>';
          ce.dispatchEvent(new Event('input', { bubbles: true }));
          ce.dispatchEvent(new Event('blur', { bubbles: true }));
          return 'inline-contenteditable';
        }
        return null;
      }, evt.desc);
      
      if (inlineAdded) {
        console.log(`  Description added via ${inlineAdded}`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log('  FAILED: Could not find any description field');
      }
    }
  }

  await browser.close();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
