#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const DESCRIPTION = `Experience the magic of live music and improvisational belly dance every Tuesday at The Dakota East Side Ice House!

Led by San Antonio belly dance pioneer Karen Barbee, members of Karavan Studio's Project Band perform dynamic, freestyle belly dance to the soulful, funky sounds of Isaac & Co and other live musicians.

This weekly event is part performance and part jam session — dancers and musicians feed off each other's energy to create one-of-a-kind grooves.

Come relax on the dog-friendly patio, enjoy drinks and delicious eats, and immerse yourself in East Side vibes.

All ages welcome. No cover charge — bring your friends and support local artists!

Presented by Karavan Studio and Good Creative Media.`;

async function addDescription(eventUrl) {
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

    // Go to event page
    await page.goto(eventUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Find the inline description editor area
    // Look for contenteditable, or clickable description area
    const descArea = await page.evaluate(() => {
      // Check for "Click in here to start editing" text
      const allEls = document.querySelectorAll('p, div, span, section');
      for (const el of allEls) {
        if (el.textContent.includes('needs a description') || el.textContent.includes('Click in here')) {
          return { found: true, tag: el.tagName, class: el.className, id: el.id, editable: el.contentEditable };
        }
      }
      // Check for contenteditable areas
      const editables = document.querySelectorAll('[contenteditable="true"]');
      if (editables.length) return { found: true, editableCount: editables.length };
      return { found: false };
    });
    console.log('Description area:', JSON.stringify(descArea));

    // Try clicking the description area to activate editing
    const clicked = await page.evaluate(() => {
      const allEls = document.querySelectorAll('p, div, span, section, [data-editable]');
      for (const el of allEls) {
        if (el.textContent.includes('needs a description') || el.textContent.includes('Click in here')) {
          el.click();
          return true;
        }
      }
      return false;
    });
    
    if (clicked) {
      console.log('Clicked description area');
      await new Promise(r => setTimeout(r, 2000));
      
      // Now check for contenteditable or textarea that appeared
      const editorInfo = await page.evaluate(() => {
        const editables = document.querySelectorAll('[contenteditable="true"], textarea');
        return Array.from(editables).map(e => ({
          tag: e.tagName, class: e.className?.substring(0, 60), id: e.id,
          editable: e.contentEditable, visible: e.offsetHeight > 0,
        }));
      });
      console.log('Editors after click:', JSON.stringify(editorInfo, null, 2));
      
      await page.screenshot({ path: 'screenshots/do210-desc-editing.png', fullPage: true });
      
      // Try typing into the first contenteditable or textarea
      const typed = await page.evaluate((desc) => {
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const el of editables) {
          if (el.offsetHeight > 0 && !el.closest('nav') && !el.closest('header')) {
            el.innerHTML = desc.replace(/\n/g, '<br>');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return 'contenteditable';
          }
        }
        const ta = document.querySelector('textarea');
        if (ta && ta.offsetHeight > 0) {
          ta.value = desc;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          return 'textarea';
        }
        return null;
      }, DESCRIPTION);
      
      if (typed) {
        console.log('Description entered via:', typed);
        await new Promise(r => setTimeout(r, 1000));
        
        // Look for save/update button
        const saved = await page.evaluate(() => {
          const btns = document.querySelectorAll('button, input[type="submit"], a');
          for (const b of btns) {
            const txt = b.textContent.trim().toLowerCase();
            if (txt.includes('save') || txt.includes('update') || txt.includes('done')) {
              b.click();
              return txt;
            }
          }
          return null;
        });
        console.log('Save button clicked:', saved);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log('Could not find editor to type into');
      }
    }

    await page.screenshot({ path: 'screenshots/do210-desc-result.png', fullPage: true });
    console.log('Done');
  } finally {
    await browser.close();
  }
}

addDescription('https://do210.com/events/2026/2/24/karavan-studio-s-belly-dance-tuesdays-tickets').catch(console.error);
