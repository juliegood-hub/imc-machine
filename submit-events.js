#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// IMC Machine — Automated Event Submission
// Submits events to Do210, SA Current, and Evvnt via browser automation
// 
// Usage: 
//   node submit-events.js do210 --event '{"title":"...", ...}'
//   node submit-events.js sacurrent --event '{"title":"...", ...}'
//   node submit-events.js evvnt --event '{"title":"...", ...}'
//   node submit-events.js all --event '{"title":"...", ...}'
// ═══════════════════════════════════════════════════════════════

const puppeteer = require('puppeteer-core');

const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

const CREDENTIALS = {
  do210: { email: 'thisisthegoodlife@juliegood.com', password: '$up3rG00d' },
  sacurrent: { email: 'thisisthegoodlife@juliegood.com', password: '$up3rG00d' },
  evvnt: { email: 'juliegood@goodcreativemedia.com', password: '$up3rG00d' },
};

const SCREENSHOT_DIR = '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots';

async function launchBrowser(headless = true) {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
}

// Helper: find a clickable element by text content (replacement for Playwright's :has-text)
async function findByText(page, tag, text) {
  return page.evaluateHandle((t, txt) => {
    const els = document.querySelectorAll(t);
    for (const el of els) {
      if (el.textContent.trim().toLowerCase().includes(txt.toLowerCase())) return el;
    }
    return null;
  }, tag, text);
}

// Helper: wait and type into a field safely
async function safeType(page, selector, text, delay = 30) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.click(selector, { clickCount: 3 }); // select all existing text
  await page.type(selector, text, { delay });
}

// Helper: select dropdown value
async function safeSelect(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.select(selector, value);
}

// ═══════════════════════════════════════════════════════════════
// DO210 — Full Automated Submission
// Form fields mapped from live inspection on 2026-02-18
// ═══════════════════════════════════════════════════════════════

// Do210 category IDs (from live inspection 2026-02-22)
const DO210_CATEGORIES = {
  'Music': '557',
  'Live Music': '557',
  'Comedy': '2030',
  'Dance': '2061',
  'Art': '527',
  'Arts & Culture': '5542',
  'Theatre': '3095',
  'Theater': '3095',
  'Film & Theatre': '2029',
  'Festival': '2366',
  'Food & Drink': '2051',
  'Education': '3854',
  'Dj/Parties': '2805',
  'Special Event': '2367',
  'Books/Poetry/Writing': '2368',
  'Fashion': '2078',
  'Sports': '5057',
  'Tech': '2424',
  'Social': '2079',
  'Variety': '5118',
};

async function submitDo210(event) {
  console.log('📅 Submitting to Do210...');
  const browser = await launchBrowser();
  const page = await browser.newPage();
  
  try {
    // Step 1: Login
    console.log('  🔑 Logging in...');
    await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#user_email', { timeout: 10000 });
    await safeType(page, '#user_email', CREDENTIALS.do210.email);
    await safeType(page, '#user_password', CREDENTIALS.do210.password);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('  ✅ Logged in');

    // Step 2: Navigate to event creation form
    await page.goto('https://do210.com/events/new', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Fill the form (field names from live inspection 2026-02-22)
    console.log('  📝 Filling event form...');

    // Title
    await safeType(page, '#event_title', event.title);

    // Venue (jQuery UI autocomplete field)
    try {
      await page.evaluate(() => {
        const v = document.querySelector('#venue_title_es');
        if (v) { v.value = ''; v.focus(); }
      });
      await page.type('#venue_title_es', event.venue || 'Venue TBD', { delay: 100 });
      await new Promise(r => setTimeout(r, 3000));
      // Select from autocomplete dropdown (skip "See All Results For" row)
      const suggestions = await page.$$('.ui-menu-item');
      if (suggestions.length > 1) {
        await suggestions[1].click(); // First real result (index 1, index 0 is "See All Results For")
        console.log('  ✅ Venue selected from autocomplete');
      } else if (suggestions.length === 1) {
        await suggestions[0].click();
        console.log('  ✅ Venue selected (single result)');
      } else {
        console.log('  ⚠️ No venue autocomplete match — typed manually');
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log('  ⚠️ Venue field error:', e.message);
    }

    // Begin date (Pika datepicker — set value directly)
    try {
      await page.evaluate((dateStr) => {
        const el = document.querySelector('#event_begin_date');
        if (el) { el.value = dateStr; el.dispatchEvent(new Event('change', { bubbles: true })); }
      }, event.date);
      console.log('  ✅ Date set:', event.date);
    } catch (e) {}

    // Begin time (hour/minute dropdowns)
    try {
      const timeParts = parseTime(event.time || '7:00 PM');
      await page.select('#event_begin_time_4i', timeParts.hour24.toString());
      await page.select('#event_begin_time_5i', timeParts.minute);
      console.log('  ✅ Start time set:', event.time);
    } catch (e) {
      console.log('  ⚠️ Start time error:', e.message);
    }

    // End time
    try {
      const endParts = parseTime(event.endTime || '10:00 PM');
      await page.select('#event_end_time_4i', endParts.hour24.toString());
      await page.select('#event_end_time_5i', endParts.minute);
      console.log('  ✅ End time set:', event.endTime);
    } catch (e) {}

    // Category dropdown — match genre to Do210 categories
    try {
      const genre = (event.genre || 'Music').split('|')[0].trim(); // Take first genre if pipe-separated
      const catValue = DO210_CATEGORIES[genre] 
        || Object.entries(DO210_CATEGORIES).find(([k]) => genre.toLowerCase().includes(k.toLowerCase()))?.[1]
        || DO210_CATEGORIES['Music'];
      await page.select('#event_category_id', catValue);
      console.log('  ✅ Category set:', genre, '→', catValue);
    } catch (e) {
      console.log('  ⚠️ Category error:', e.message);
    }

    // Free event checkbox
    if (event.free) {
      try { await page.click('#event_event_setting_attributes_free_event'); } catch (e) {}
    }

    // Ticket URL
    if (event.ticketLink) {
      try { await safeType(page, '#event_buy_tickets', event.ticketLink); } catch (e) {}
    }

    // Ticket info (price/age)
    if (event.ticketInfo) {
      try { await safeType(page, '#event_ticket_info', event.ticketInfo); } catch (e) {}
    }

    // Photo from URL
    if (event.imageUrl) {
      try { await safeType(page, '#cloudinary_hero_image_from_url', event.imageUrl); } catch (e) {}
    }

    // Screenshot before submit
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-filled.png`, fullPage: true });
    console.log('  📸 Screenshot: do210-filled.png');

    // Step 4: Submit — button.ds-btn[type="submit"] "Add It"
    console.log('  🚀 Submitting...');
    const submitBtn = await page.$('button[type="submit"].ds-btn');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    } else {
      // Fallback: submit the form directly
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });
      await new Promise(r => setTimeout(r, 5000));
    }

    // Screenshot after submit
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-submitted.png`, fullPage: true });
    console.log('  📸 Screenshot: do210-submitted.png');

    // Check for success
    const url = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const success = (url.includes('/events/') && !url.includes('/new')) || pageText.toLowerCase().includes('success') || pageText.toLowerCase().includes('submitted') || pageText.toLowerCase().includes('pending');

    console.log(`  ${success ? '✅' : '⚠️'} Do210 ${success ? 'submitted!' : 'may need review'} — ${url}`);
    return { success, platform: 'Do210', url, message: success ? 'Event submitted to Do210' : 'Submission may need manual review' };

  } catch (err) {
    console.error('  ❌ Do210 error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-error.png` }).catch(() => {});
    return { success: false, platform: 'Do210', error: err.message };
  } finally {
    await browser.close();
  }
}

// Parse "7:00 PM" or "19:30" into { hour24: "19", minute: "00" }
function parseTime(timeStr) {
  if (!timeStr) return { hour24: '19', minute: '00' };
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return { hour24: '19', minute: '00' };
  let hour = parseInt(match[1]);
  const minute = match[2];
  const ampm = match[3];
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  }
  return { hour24: hour.toString(), minute };
}

// ═══════════════════════════════════════════════════════════════
// SA CURRENT — Full Automated Submission
// Via Evvnt-powered community.sacurrent.com/sanantonio/Events/AddEvent
// ═══════════════════════════════════════════════════════════════

async function submitSACurrent(event) {
  console.log('📅 Submitting to SA Current...');
  const browser = await launchBrowser(false);
  const page = await browser.newPage();

  try {
    // Navigate to event submission page
    await page.goto('https://community.sacurrent.com/sanantonio/Events/AddEvent', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // Check if login is needed
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('sign_in') || currentUrl.includes('Login')) {
      console.log('  🔑 Logging in...');
      
      // Try to find and fill login form
      const emailInputs = ['input[name="email"]', 'input[type="email"]', 'input#email', 'input[name="Username"]', 'input#Username'];
      const passInputs = ['input[name="password"]', 'input[type="password"]', 'input#password', 'input[name="Password"]', 'input#Password'];
      
      for (const sel of emailInputs) {
        try { await safeType(page, sel, CREDENTIALS.sacurrent.email); break; } catch (e) {}
      }
      for (const sel of passInputs) {
        try { await safeType(page, sel, CREDENTIALS.sacurrent.password); break; } catch (e) {}
      }
      
      // Submit login
      const loginBtn = await page.$('button[type="submit"], input[type="submit"], .login-btn');
      if (loginBtn) await loginBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      
      // Re-navigate to event form
      await page.goto('https://community.sacurrent.com/sanantonio/Events/AddEvent', { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3000));
    }

    // Screenshot the form to see what we're working with
    await page.screenshot({ path: `${SCREENSHOT_DIR}/sacurrent-form-loaded.png`, fullPage: true });

    // Map and fill the SA Current / Evvnt-powered form
    console.log('  📝 Filling event form...');

    // Common Evvnt-powered form selectors
    const formFields = [
      { sel: 'input[name="Title"], input#Title, input[name="EventTitle"], input[placeholder*="title" i]', val: event.title },
      { sel: 'input[name="VenueName"], input#VenueName, input[name="Venue"], input[placeholder*="venue" i]', val: event.venue || 'Venue TBD' },
      { sel: 'input[name="Address"], input#Address, input[name="VenueAddress"], input[placeholder*="address" i]', val: event.address || '' },
      { sel: 'input[name="StartDate"], input#StartDate, input[name="startDate"]', val: event.date },
      { sel: 'input[name="StartTime"], input#StartTime, input[name="startTime"]', val: event.time || '7:00 PM' },
      { sel: 'input[name="EndDate"], input#EndDate, input[name="endDate"]', val: event.endDate || event.date },
      { sel: 'input[name="EndTime"], input#EndTime, input[name="endTime"]', val: event.endTime || '10:00 PM' },
      { sel: 'input[name="TicketUrl"], input#TicketUrl, input[name="ticketUrl"], input[placeholder*="ticket" i]', val: event.ticketLink || '' },
      { sel: 'input[name="Website"], input#Website, input[name="EventUrl"]', val: event.ticketLink || 'https://goodcreativemedia.com' },
    ];

    for (const field of formFields) {
      if (!field.val) continue;
      const selectors = field.sel.split(', ');
      for (const sel of selectors) {
        try { await safeType(page, sel.trim(), field.val); break; } catch (e) {}
      }
    }

    // Description textarea
    const descSelectors = ['textarea[name="Description"]', 'textarea#Description', 'textarea[name="EventDescription"]', 'textarea[placeholder*="description" i]'];
    for (const sel of descSelectors) {
      try { await safeType(page, sel, event.description || event.title, 10); break; } catch (e) {}
    }

    // Category dropdown
    try {
      const catSelectors = ['select[name="Category"]', 'select#Category', 'select[name="EventCategory"]'];
      for (const sel of catSelectors) {
        try {
          const options = await page.$$eval(`${sel} option`, opts => opts.map(o => ({ value: o.value, text: o.textContent.trim() })));
          const match = options.find(o => o.text.toLowerCase().includes(event.genre?.toLowerCase() || 'music'));
          if (match) { await safeSelect(page, sel, match.value); break; }
        } catch (e) {}
      }
    } catch (e) {}

    // Image URL
    if (event.imageUrl) {
      try {
        const imgSels = ['input[name="ImageUrl"]', 'input#ImageUrl', 'input[name="image"]', 'input[placeholder*="image" i]'];
        for (const sel of imgSels) {
          try { await safeType(page, sel, event.imageUrl); break; } catch (e) {}
        }
      } catch (e) {}
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/sacurrent-filled.png`, fullPage: true });
    console.log('  📸 Screenshot: sacurrent-filled.png');

    // Submit
    console.log('  🚀 Submitting...');
    const submitBtns = ['button[type="submit"]', 'input[type="submit"]', '.submit-btn'];
    for (const sel of submitBtns) {
      if (!sel) continue;
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    await page.screenshot({ path: `${SCREENSHOT_DIR}/sacurrent-submitted.png`, fullPage: true });
    
    const url = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const success = pageText.toLowerCase().includes('success') || pageText.toLowerCase().includes('submitted') || pageText.toLowerCase().includes('pending') || pageText.toLowerCase().includes('thank');

    console.log(`  ${success ? '✅' : '⚠️'} SA Current ${success ? 'submitted!' : 'may need review'}`);
    return { success, platform: 'SA Current', url, message: success ? 'Event submitted to SA Current' : 'Submission may need manual review' };

  } catch (err) {
    console.error('  ❌ SA Current error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/sacurrent-error.png` }).catch(() => {});
    return { success: false, platform: 'SA Current', error: err.message };
  } finally {
    await browser.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// EVVNT — Full Automated Submission
// app.evvnt.com — creates events that syndicate to Express-News, MySA, 100+ sites
// ═══════════════════════════════════════════════════════════════

async function submitEvvnt(event) {
  console.log('📅 Submitting to Evvnt...');
  const browser = await launchBrowser(false);
  const page = await browser.newPage();

  try {
    // Step 1: Login
    console.log('  🔑 Logging in...');
    await page.goto('https://app.evvnt.com/users/sign_in', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const emailSels = ['input#user_email', 'input[name="user[email]"]', 'input[type="email"]'];
    const passSels = ['input#user_password', 'input[name="user[password]"]', 'input[type="password"]'];
    
    for (const sel of emailSels) {
      try { await safeType(page, sel, CREDENTIALS.evvnt.email); break; } catch (e) {}
    }
    for (const sel of passSels) {
      try { await safeType(page, sel, CREDENTIALS.evvnt.password); break; } catch (e) {}
    }
    
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    console.log('  ✅ Logged in');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/evvnt-dashboard.png`, fullPage: true });

    // Step 2: Find and click "Add Event" / "Create Event"
    const addBtns = ['a[href*="event"][href*="new"]', 'a[href*="event"][href*="create"]', '.add-event', '.new-event', '.btn-create'];
    for (const sel of addBtns) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }

    // Try finding button by text content
    if (page.url().includes('dashboard') || !page.url().includes('event')) {
      const addBtn = await findByText(page, 'a, button', 'Add Event');
      if (addBtn && addBtn.asElement()) {
        await addBtn.asElement().click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // If still no luck, try direct URL
    if (page.url().includes('dashboard') || !page.url().includes('event')) {
      await page.goto('https://app.evvnt.com/events/new', { waitUntil: 'networkidle2' }).catch(async () => {
        await page.goto('https://app.evvnt.com/create', { waitUntil: 'networkidle2' }).catch(() => {});
      });
      await new Promise(r => setTimeout(r, 2000));
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/evvnt-form.png`, fullPage: true });

    // Step 3: Fill form (Evvnt form fields)
    console.log('  📝 Filling event form...');

    const evvntFields = [
      { sels: ['input[name*="title" i]', 'input#event_title', 'input[placeholder*="title" i]', 'input[name="event[title]"]'], val: event.title },
      { sels: ['input[name*="venue" i]', 'input#venue_name', 'input[placeholder*="venue" i]', 'input[name="event[venue_name]"]'], val: event.venue || 'Venue TBD' },
      { sels: ['input[name*="address" i]', 'input#address', 'input[placeholder*="address" i]'], val: event.address || '' },
      { sels: ['input[name*="start_date" i]', 'input#start_date', 'input[type="date"]'], val: event.date },
      { sels: ['input[name*="start_time" i]', 'input#start_time'], val: event.time || '7:00 PM' },
      { sels: ['input[name*="ticket" i]', 'input[placeholder*="ticket" i]', 'input[name*="url" i]'], val: event.ticketLink || '' },
    ];

    for (const field of evvntFields) {
      if (!field.val) continue;
      for (const sel of field.sels) {
        try { await safeType(page, sel, field.val); break; } catch (e) {}
      }
    }

    // Description
    const descSels = ['textarea[name*="description" i]', 'textarea#event_description', 'textarea[placeholder*="description" i]', '.ql-editor', '[contenteditable="true"]'];
    for (const sel of descSels) {
      try {
        if (sel === '.ql-editor' || sel === '[contenteditable="true"]') {
          await page.click(sel);
          await page.keyboard.type(event.description || event.title);
        } else {
          await safeType(page, sel, event.description || event.title, 10);
        }
        break;
      } catch (e) {}
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/evvnt-filled.png`, fullPage: true });
    console.log('  📸 Screenshot: evvnt-filled.png');

    // Submit
    console.log('  🚀 Submitting...');
    const submitBtns = ['button[type="submit"]', 'input[type="submit"]', '.submit-event'];
    for (const sel of submitBtns) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    await page.screenshot({ path: `${SCREENSHOT_DIR}/evvnt-submitted.png`, fullPage: true });

    const url = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const success = pageText.toLowerCase().includes('success') || pageText.toLowerCase().includes('submitted') || pageText.toLowerCase().includes('published') || pageText.toLowerCase().includes('pending');

    console.log(`  ${success ? '✅' : '⚠️'} Evvnt ${success ? 'submitted!' : 'may need review'}`);
    return { success, platform: 'Evvnt', url, message: success ? 'Event submitted to Evvnt (syndicates to Express-News, MySA, 100+ sites)' : 'Submission may need manual review' };

  } catch (err) {
    console.error('  ❌ Evvnt error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/evvnt-error.png` }).catch(() => {});
    return { success: false, platform: 'Evvnt', error: err.message };
  } finally {
    await browser.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// TPR (Texas Public Radio) — Community Calendar Form Submission
// Form: https://www.tpr.org/community-calendar-event-submission
// Posts to: https://www.tpr.org/form/submit
// Note: TPR only accepts FREE events from nonprofits, colleges, fundraisers
// ═══════════════════════════════════════════════════════════════

async function submitTPR(event) {
  console.log('📅 Submitting to TPR Community Calendar...');
  const browser = await launchBrowser(false);
  const page = await browser.newPage();

  try {
    await page.goto('https://www.tpr.org/community-calendar-event-submission', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    console.log('  📝 Filling TPR event form...');

    // Event basics
    const fields = [
      { sel: 'input[name="event-title"]', val: event.title },
      { sel: 'input[name="event-date"], input[name="start-date"]', val: event.date },
      { sel: 'input[name="start-time"]', val: event.time || '7:00 PM' },
      { sel: 'input[name="end-date"]', val: event.endDate || event.date },
      { sel: 'input[name="end-time"]', val: event.endTime || '10:00 PM' },
      { sel: 'input[name="ticketing-website"]', val: event.ticketLink || '' },
      { sel: 'input[name="artist-name"]', val: event.performers || '' },
      { sel: 'input[name="artist-email"]', val: '' },
      { sel: 'input[name="artist-website"]', val: '' },
      // Venue
      { sel: 'input[name="venue-name"]', val: event.venue || 'Venue TBD' },
      { sel: 'input[name="venue-street-address"]', val: event.address || '' },
      { sel: 'input[name="venue-city"]', val: event.city || 'San Antonio' },
      { sel: 'input[name="venue-state"]', val: event.state || 'TX' },
      { sel: 'input[name="venue-zip"]', val: event.zip || '' },
      { sel: 'input[name="venue-phone"]', val: event.venuePhone || '' },
      { sel: 'input[name="venue-website"]', val: event.venueWebsite || '' },
      { sel: 'input[name="venue-email"]', val: '' },
      // Submitter info
      { sel: 'input[name="your-information-name"]', val: 'Julie Good' },
      { sel: 'input[name="your-information-email"]', val: 'juliegood@goodcreativemedia.com' },
    ];

    for (const field of fields) {
      if (!field.val) continue;
      const sels = field.sel.split(', ');
      for (const sel of sels) {
        try { await safeType(page, sel.trim(), field.val); break; } catch (e) {}
      }
    }

    // Description textarea
    try {
      const descSels = ['textarea[name="event-description"]', 'textarea[name="description"]'];
      for (const sel of descSels) {
        try { await safeType(page, sel, event.description || event.title, 10); break; } catch (e) {}
      }
    } catch (e) {}

    // Event category dropdown
    try {
      const catSel = 'select[name="event-category"]';
      const options = await page.$$eval(`${catSel} option`, opts => opts.map(o => ({ value: o.value, text: o.textContent.trim().toLowerCase() })));
      const genre = (event.genre || 'music').toLowerCase();
      const match = options.find(o => o.text.includes(genre)) || options.find(o => o.text.includes('music')) || options[1];
      if (match) await safeSelect(page, catSel, match.value);
    } catch (e) {}

    // Free event checkbox
    try {
      const freeCheck = await page.$('input[name="this-is-a-free-event"]');
      if (freeCheck && event.free) await freeCheck.click();
    } catch (e) {}

    // Submitting as dropdown
    try {
      await safeSelect(page, 'select[name="your-information-submitting-as"]', 'Promoter');
    } catch (e) {
      try { await safeSelect(page, 'select[name="your-information-submitting-as"]', 'Other'); } catch (e2) {}
    }

    // Image upload
    if (event.imagePath) {
      try {
        const fileInput = await page.$('input[name="event-image"]');
        if (fileInput) await fileInput.uploadFile(event.imagePath);
      } catch (e) { console.log('  ⚠️ Image upload failed'); }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/tpr-filled.png`, fullPage: true });
    console.log('  📸 Screenshot: tpr-filled.png');

    // Submit
    console.log('  🚀 Submitting...');
    const submitBtns = ['button[type="submit"]', 'input[type="submit"]', '.EventForm-form button'];
    for (const sel of submitBtns) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); break; }
    }
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    await page.screenshot({ path: `${SCREENSHOT_DIR}/tpr-submitted.png`, fullPage: true });

    const url = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const success = pageText.toLowerCase().includes('thank') || pageText.toLowerCase().includes('success') || pageText.toLowerCase().includes('submitted');

    console.log(`  ${success ? '✅' : '⚠️'} TPR ${success ? 'submitted!' : 'may need review'}`);
    return { success, platform: 'TPR', url, message: success ? 'Event submitted to TPR Community Calendar' : 'Submission may need manual review' };

  } catch (err) {
    console.error('  ❌ TPR error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/tpr-error.png` }).catch(() => {});
    return { success: false, platform: 'TPR', error: err.message };
  } finally {
    await browser.close();
  }
}


// ═══════════════════════════════════════════════════════════════
// SUBMIT ALL — Run all platforms and return combined results
// ═══════════════════════════════════════════════════════════════

async function submitAll(event) {
  const results = {};
  
  results.do210 = await submitDo210(event);
  results.tpr = await submitTPR(event);
  // Evvnt: Cloudflare-protected — requires manual or ChatGPT Agent
  results.evvnt = { success: false, platform: 'Evvnt', error: 'Cloudflare-protected. Submit manually at app.evvnt.com or use ChatGPT Agent.' };
  // SA Current: Cloudflare-protected — requires manual or ChatGPT Agent
  results.sacurrent = { success: false, platform: 'SA Current', error: 'Cloudflare-protected. Use the SA Current Wizard in the app.' };
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 SUBMISSION RESULTS');
  console.log('═══════════════════════════════════════════════════════');
  for (const [platform, result] of Object.entries(results)) {
    console.log(`  ${result.success ? '✅' : '❌'} ${result.platform}: ${result.message || result.error}`);
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  const fs = require('fs');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const eventArgIdx = process.argv.indexOf('--event');
  const event = eventArgIdx > -1 ? JSON.parse(process.argv[eventArgIdx + 1]) : {
    title: 'Test Event — IMC Machine',
    date: '2026-03-15',
    time: '7:00 PM',
    endTime: '10:00 PM',
    genre: 'Live Music',
    description: 'A test event submission from the IMC Machine by Good Creative Media.',
    venue: 'Venue TBD',
    address: '',
    ticketLink: 'https://goodcreativemedia.com',
    free: false,
  };

  const platform = process.argv[2] || 'all';

  if (platform === 'do210') return submitDo210(event);
  if (platform === 'sacurrent') return submitSACurrent(event);
  if (platform === 'evvnt') return submitEvvnt(event);
  if (platform === 'tpr') return submitTPR(event);
  return submitAll(event);
}

main().catch(console.error);

module.exports = { submitDo210, submitSACurrent, submitEvvnt, submitTPR, submitAll };
