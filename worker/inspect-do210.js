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
  console.log('Logged in:', page.url());
  
  await page.goto('https://do210.com/events/new', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Dump all input/select/textarea/button names and ids
  const fields = await page.evaluate(() => {
    const els = document.querySelectorAll('input, select, textarea, button[type="submit"], input[type="submit"]');
    return Array.from(els).map(el => ({
      tag: el.tagName,
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      className: el.className?.substring(0, 80),
      value: el.value?.substring(0, 50),
    }));
  });
  
  fields.forEach(f => console.log(`${f.tag} type=${f.type} name="${f.name}" id="${f.id}" placeholder="${f.placeholder}" class="${f.className}" val="${f.value}"`));
  
  // Find submit button specifically
  const submitBtn = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, input[type="submit"]');
    return Array.from(btns).map(b => ({
      tag: b.tagName, type: b.type, text: b.textContent?.trim()?.substring(0, 50),
      id: b.id, className: b.className?.substring(0, 80),
    }));
  });
  console.log('\nButtons:', JSON.stringify(submitBtn, null, 2));
  
  await browser.close();
})().catch(console.error);
