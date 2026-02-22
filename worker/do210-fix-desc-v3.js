#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const events = [
  {
    editUrl: 'https://do210.com/events/16994196/edit',
    desc: `Ready to test your comedic chops? Comedy Open Mic: Find Your Funny is a weekly open mic night at Mia's Midtown Meetup, hosted by Javier "Javi" Bazaldua and presented by Heavy City Productions. Whether you're a seasoned stand-up or stepping on stage for the first time, this is your night. Sign up at the door, grab the mic, and find your funny. Free admission, all ages, every Saturday at 7:30 PM.`
  },
  {
    editUrl: 'https://do210.com/events/16994089/edit',
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
    console.log('\nProcessing:', evt.editUrl);
    await page.goto(evt.editUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // Debug: dump all form fields
    const formInfo = await page.evaluate(() => {
      const fields = [];
      // All inputs and textareas
      document.querySelectorAll('input, textarea, select, [contenteditable="true"]').forEach(el => {
        fields.push({
          tag: el.tagName,
          type: el.type,
          name: el.name,
          id: el.id,
          class: el.className?.substring(0, 80),
          placeholder: el.placeholder,
          contentEditable: el.contentEditable,
          value: (el.value || el.textContent || '').substring(0, 50)
        });
      });
      // Also check for Medium Editor
      const me = document.querySelectorAll('.medium-editor-element');
      me.forEach(el => {
        fields.push({ tag: 'MEDIUM-EDITOR', class: el.className?.substring(0, 80), text: el.textContent?.substring(0, 50) });
      });
      return fields;
    });
    
    console.log('Form fields found:', JSON.stringify(formInfo, null, 2));

    // Try to find description field
    const result = await page.evaluate((desc) => {
      // Check for Medium Editor elements
      const mediumEls = document.querySelectorAll('.medium-editor-element');
      for (const el of mediumEls) {
        if (el.closest('.description') || el.dataset.placeholder?.toLowerCase().includes('desc') || 
            el.getAttribute('data-placeholder')?.toLowerCase().includes('about') ||
            el.getAttribute('data-placeholder')?.toLowerCase().includes('description')) {
          el.innerHTML = '<p>' + desc + '</p>';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return { method: 'medium-editor-desc', placeholder: el.getAttribute('data-placeholder') };
        }
      }
      
      // If only one Medium Editor, use it
      if (mediumEls.length === 1) {
        mediumEls[0].innerHTML = '<p>' + desc + '</p>';
        mediumEls[0].dispatchEvent(new Event('input', { bubbles: true }));
        return { method: 'medium-editor-only', placeholder: mediumEls[0].getAttribute('data-placeholder') };
      }
      
      // Try all contenteditable
      const editables = document.querySelectorAll('[contenteditable="true"]');
      for (const el of editables) {
        const ph = el.getAttribute('data-placeholder') || '';
        if (ph.toLowerCase().includes('desc') || ph.toLowerCase().includes('about') || ph.toLowerCase().includes('tell')) {
          el.innerHTML = '<p>' + desc + '</p>';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return { method: 'contenteditable', placeholder: ph };
        }
      }
      
      return { method: 'none', editableCount: editables.length, mediumCount: mediumEls.length };
    }, evt.desc);
    
    console.log('Result:', JSON.stringify(result));

    if (result.method !== 'none') {
      // Wait a bit then submit the form
      await new Promise(r => setTimeout(r, 1000));
      
      // Try clicking Update/Save button
      const submitted = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('input[type="submit"], button[type="submit"], .btn, .button')];
        for (const btn of btns) {
          const txt = (btn.value || btn.textContent || '').toLowerCase();
          if (txt.includes('update') || txt.includes('save') || txt.includes('submit')) {
            btn.click();
            return txt;
          }
        }
        // Try form submit directly
        const form = document.querySelector('form.edit_event, form[action*="event"]');
        if (form) { form.submit(); return 'form.submit()'; }
        return null;
      });
      console.log('Submitted:', submitted);
      await new Promise(r => setTimeout(r, 5000));
      console.log('Current URL:', page.url());
    }
  }

  await browser.close();
  console.log('\nDone!');
}

run().catch(e => { console.error(e); process.exit(1); });
