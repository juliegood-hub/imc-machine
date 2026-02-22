#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const DESC = `Experience the magic of live music and improvisational belly dance every Tuesday at The Dakota East Side Ice House! Led by San Antonio belly dance pioneer Karen Barbee, members of Karavan Studio's Project Band perform dynamic, freestyle belly dance to the soulful, funky sounds of Isaac & Co and other live musicians. This weekly event is part performance and part jam session — dancers and musicians feed off each other's energy to create one-of-a-kind grooves. Come relax on the dog-friendly patio, enjoy drinks and delicious eats, and immerse yourself in East Side vibes. All ages welcome. No cover charge — bring your friends and support local artists!`;

async function run(eventUrl) {
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

  await page.goto(eventUrl, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Log all contenteditable elements and any elements with "description" in class/data
  const info = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('[contenteditable], [data-editable], [class*="desc"], [class*="about"], [class*="body"], [class*="content"]').forEach(el => {
      results.push({
        tag: el.tagName, class: el.className?.substring(0, 100), id: el.id,
        contentEditable: el.contentEditable,
        text: el.textContent?.substring(0, 100),
        rect: { top: el.getBoundingClientRect().top, height: el.offsetHeight },
      });
    });
    return results;
  });
  console.log('Found elements:');
  info.forEach(i => console.log(`  ${i.tag} .${i.class} editable=${i.contentEditable} h=${i.rect.height} "${i.text?.substring(0, 50)}"`));

  // Try clicking the contenteditable div and see what happens
  const editableHandle = await page.$('[contenteditable="true"]');
  if (editableHandle) {
    console.log('\nClicking contenteditable...');
    await editableHandle.click();
    await new Promise(r => setTimeout(r, 2000));
    
    // Check what changed
    const afterClick = await page.evaluate(() => {
      const editables = document.querySelectorAll('[contenteditable="true"], textarea, .medium-editor-element, .ql-editor, [data-medium-editor-element]');
      return Array.from(editables).map(e => ({
        tag: e.tagName, class: e.className?.substring(0, 100),
        editable: e.contentEditable, html: e.innerHTML?.substring(0, 200),
        visible: e.offsetHeight > 0,
      }));
    });
    console.log('After click:', JSON.stringify(afterClick, null, 2));
    
    await page.screenshot({ path: 'screenshots/do210-after-click.png', fullPage: true });
    
    // Try triple-click to select all, then type
    await editableHandle.click({ clickCount: 3 });
    await page.keyboard.type(DESC);
    await new Promise(r => setTimeout(r, 1000));
    
    // Click elsewhere to trigger save
    await page.click('body');
    await new Promise(r => setTimeout(r, 3000));
    
    await page.screenshot({ path: 'screenshots/do210-desc-typed.png', fullPage: true });
    
    // Check if there's an autosave or XHR
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 5000));
    if (pageText.includes('belly dance pioneer')) {
      console.log('✅ Description appears to be on the page!');
    } else {
      console.log('⚠️ Description text not found on page');
    }
  } else {
    console.log('No contenteditable found');
  }

  await browser.close();
}

run('https://do210.com/events/2026/2/24/karavan-studio-s-belly-dance-tuesdays-tickets').catch(console.error);
