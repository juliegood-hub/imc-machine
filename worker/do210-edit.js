#!/usr/bin/env node
/**
 * Do210 Post-Submit Editor
 * After creating an event, navigates to it and adds:
 * - Description/body text
 * - Photo/poster image URL
 * Then submits the edit
 */
const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const CREDENTIALS = {
  email: 'thisisthegoodlife@juliegood.com',
  password: '$up3rG00d',
};

const SCREENSHOT_DIR = '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots';

async function editDo210Event(eventUrl, { description, imageUrl, posterUrl }) {
  console.log('📝 Editing Do210 event:', eventUrl);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  });
  const page = await browser.newPage();

  try {
    // Login
    console.log('  🔑 Logging in...');
    await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
    await page.type('#user_email', CREDENTIALS.email);
    await page.type('#user_password', CREDENTIALS.password);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('  ✅ Logged in');

    // Navigate to event page
    await page.goto(eventUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-event-page.png`, fullPage: true });

    // Find and click Edit button/link
    const editLink = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.textContent.trim().toLowerCase().includes('edit')) return a.href;
      }
      return null;
    });

    if (editLink) {
      console.log('  📝 Found edit link:', editLink);
      await page.goto(editLink, { waitUntil: 'networkidle2' });
    } else {
      // Try appending /edit to the URL
      const editUrl = eventUrl.replace(/\/?$/, '') + '/edit';
      console.log('  📝 Trying edit URL:', editUrl);
      await page.goto(editUrl, { waitUntil: 'networkidle2' });
    }
    await new Promise(r => setTimeout(r, 2000));
    
    // Dump all form fields on the edit page
    const fields = await page.evaluate(() => {
      const els = document.querySelectorAll('input, select, textarea, button[type="submit"]');
      return Array.from(els).map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder || '',
        className: (el.className || '').substring(0, 60),
        value: (el.value || '').substring(0, 80),
      }));
    });
    console.log('\n  Edit page fields:');
    fields.forEach(f => {
      if (f.name || f.id || f.tag === 'TEXTAREA' || f.tag === 'BUTTON') {
        console.log(`    ${f.tag} type=${f.type} name="${f.name}" id="${f.id}" val="${f.value}"`);
      }
    });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-edit-page.png`, fullPage: true });

    // Fill description if textarea exists
    if (description) {
      const descFilled = await page.evaluate((desc) => {
        const textareas = document.querySelectorAll('textarea');
        for (const ta of textareas) {
          if (ta.name.includes('description') || ta.name.includes('body') || ta.name.includes('content') || ta.id.includes('description') || ta.id.includes('body')) {
            ta.value = desc;
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            return ta.name || ta.id;
          }
        }
        // If only one textarea, use it
        if (textareas.length === 1) {
          textareas[0].value = desc;
          textareas[0].dispatchEvent(new Event('change', { bubbles: true }));
          return textareas[0].name || 'single-textarea';
        }
        return null;
      }, description);
      if (descFilled) {
        console.log('  ✅ Description filled in:', descFilled);
      } else {
        // Try rich text editor (contenteditable)
        const richEditor = await page.$('[contenteditable="true"], .ql-editor, .trix-content, .ProseMirror');
        if (richEditor) {
          await richEditor.click();
          await page.keyboard.type(description);
          console.log('  ✅ Description filled in rich text editor');
        } else {
          console.log('  ⚠️ No description field found on edit page');
        }
      }
    }

    // Fill image URL
    if (imageUrl) {
      const imgFilled = await page.evaluate((url) => {
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
          if (inp.name.includes('image') && (inp.name.includes('url') || inp.type === 'url' || inp.type === 'text') && !inp.name.includes('file')) {
            inp.value = url;
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            return inp.name;
          }
        }
        // Try specific Do210 fields
        const heroUrl = document.querySelector('#cloudinary_hero_image_from_url');
        if (heroUrl) { heroUrl.value = url; return 'cloudinary_hero_image_from_url'; }
        return null;
      }, imageUrl);
      if (imgFilled) {
        console.log('  ✅ Image URL set:', imgFilled);
      }
    }

    // Fill poster URL
    if (posterUrl) {
      const posterFilled = await page.evaluate((url) => {
        const el = document.querySelector('#cloudinary_poster_image_from_url');
        if (el) { el.value = url; return true; }
        return false;
      }, posterUrl);
      if (posterFilled) {
        console.log('  ✅ Poster URL set');
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-edit-filled.png`, fullPage: true });

    // Submit edit
    console.log('  🚀 Saving edits...');
    const submitBtn = await page.$('button[type="submit"].ds-btn, button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-edit-submitted.png`, fullPage: true });
    const finalUrl = page.url();
    console.log('  ✅ Edit saved:', finalUrl);
    return { success: true, url: finalUrl };

  } catch (err) {
    console.error('  ❌ Edit error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-edit-error.png` }).catch(() => {});
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

// Run from CLI
const eventUrl = process.argv[2] || 'https://do210.com/events/2026/2/24/karavan-studio-s-belly-dance-tuesdays-tickets';
const description = process.argv[3] || "Experience the magic of live music and improvisational belly dance every Tuesday at The Dakota East Side Ice House! Led by San Antonio belly dance pioneer Karen Barbee, members of Karavan Studio's Project Band perform dynamic, freestyle belly dance to the soulful, funky sounds of Isaac & Co and other live musicians. This weekly event is part performance and part jam session — dancers and musicians feed off each other's energy to create one-of-a-kind grooves. Come relax on the dog-friendly patio, enjoy drinks and delicious eats, and immerse yourself in East Side vibes. All ages welcome. No cover charge — bring your friends and support local artists!";

editDo210Event(eventUrl, {
  description,
  imageUrl: null, // We'll add this once we have a public image URL
  posterUrl: null,
}).then(r => console.log('\nResult:', JSON.stringify(r, null, 2))).catch(console.error);
