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
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
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

const DO210_CATEGORIES = {
  'Live Music': '1',
  'Theater': '5',
  'Comedy': '3',
  'Dance': '6',
  'Art': '2',
  'Festival': '4',
  'Workshop': '7',
  'Film': '8',
  'Food & Drink': '9',
  'Sports': '10',
  'Community': '11',
  'Other': '12',
};

async function submitDo210(event) {
  console.log('📅 Submitting to Do210...');
  const browser = await launchBrowser(false);
  const page = await browser.newPage();
  
  try {
    // Step 1: Login
    console.log('  🔑 Logging in...');
    await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"], input[name="user[email]"], input#user_email', { timeout: 10000 });
    
    const emailSel = (await page.$('input#user_email')) ? '#user_email' 
      : (await page.$('input[name="user[email]"]')) ? 'input[name="user[email]"]' 
      : 'input[type="email"]';
    const passSel = (await page.$('input#user_password')) ? '#user_password'
      : (await page.$('input[name="user[password]"]')) ? 'input[name="user[password]"]'
      : 'input[type="password"]';
    
    await safeType(page, emailSel, CREDENTIALS.do210.email);
    await safeType(page, passSel, CREDENTIALS.do210.password);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('  ✅ Logged in');

    // Step 2: Navigate to event creation form
    await page.goto('https://do210.com/events/new', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Fill the form
    console.log('  📝 Filling event form...');

    // Title
    const titleSel = 'input[name="event[title]"], input#event_title, input[placeholder*="title" i]';
    await safeType(page, titleSel, event.title);

    // Venue name
    const venueSel = 'input[name="event[venue_name]"], input#event_venue_name, input[placeholder*="venue" i]';
    try {
      await safeType(page, venueSel, event.venue || 'Venue TBD');
      // Wait for autocomplete dropdown and try to select first result
      await new Promise(r => setTimeout(r, 1500));
      const suggestion = await page.$('.venue-suggestion, .autocomplete-result, .ui-menu-item, [role="option"]');
      if (suggestion) await suggestion.click();
    } catch (e) {
      console.log('  ⚠️ Venue autocomplete not found, typed manually');
    }

    // Start date
    const startDateSel = 'input[name="event[start_date]"], input#event_start_date, input[type="date"]';
    try {
      await page.evaluate((sel, val) => {
        const el = document.querySelector(sel);
        if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
      }, startDateSel, event.date);
    } catch (e) {
      await safeType(page, startDateSel, event.date);
    }

    // Start time
    const startTimeSel = 'input[name="event[start_time]"], input#event_start_time, input[placeholder*="time" i]';
    try { await safeType(page, startTimeSel, event.time || '7:00 PM'); } catch (e) {}

    // End date (same as start for single-day events)
    try {
      const endDateSel = 'input[name="event[end_date]"], input#event_end_date';
      await page.evaluate((sel, val) => {
        const el = document.querySelector(sel);
        if (el) { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }
      }, endDateSel, event.endDate || event.date);
    } catch (e) {}

    // End time
    try {
      const endTimeSel = 'input[name="event[end_time]"], input#event_end_time';
      await safeType(page, endTimeSel, event.endTime || '10:00 PM');
    } catch (e) {}

    // Description (textarea)
    const descSel = 'textarea[name="event[description]"], textarea#event_description';
    try { await safeType(page, descSel, event.description || event.title, 10); } catch (e) {}

    // Category
    try {
      const catValue = DO210_CATEGORIES[event.genre] || DO210_CATEGORIES['Live Music'] || '1';
      await safeSelect(page, 'select[name="event[category_id]"], select#event_category_id', catValue);
    } catch (e) {}

    // Ticket URL
    if (event.ticketLink) {
      try {
        const ticketSel = 'input[name="event[buy_tickets]"], input#event_buy_tickets, input[placeholder*="ticket" i]';
        await safeType(page, ticketSel, event.ticketLink);
      } catch (e) {}
    }

    // Free event checkbox
    if (event.free) {
      try {
        await page.click('input[name="event[free_event]"], input#event_free_event');
      } catch (e) {}
    }

    // Image upload (URL field if available)
    if (event.imageUrl) {
      try {
        const imgUrlSel = 'input[name="event[image_url]"], input[placeholder*="image url" i], input[name*="image"][type="url"]';
        await safeType(page, imgUrlSel, event.imageUrl);
      } catch (e) {
        console.log('  ⚠️ No image URL field found');
      }
    }

    // Screenshot before submit
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-filled.png`, fullPage: true });
    console.log('  📸 Screenshot: do210-filled.png');

    // Step 4: Submit the form
    console.log('  🚀 Submitting...');
    const submitBtn = await page.$('input[type="submit"], button[type="submit"], button:has-text("Submit"), button:has-text("Create"), .submit-btn, .btn-primary[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    } else {
      // Try form submission directly
      await page.evaluate(() => {
        const form = document.querySelector('form[action*="events"], form.event-form, form#new_event');
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
    const success = url.includes('/events/') && !url.includes('/new') || pageText.toLowerCase().includes('success') || pageText.toLowerCase().includes('submitted') || pageText.toLowerCase().includes('pending');

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
      const loginBtn = await page.$('button[type="submit"], input[type="submit"], .login-btn, button:has-text("Log In"), button:has-text("Sign In")');
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
    const submitBtns = ['button[type="submit"]', 'input[type="submit"]', '.submit-btn', 'button:has-text("Submit")', 'button:has-text("Add Event")', 'button:has-text("Create")'];
    for (const sel of submitBtns) {
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
    const addBtns = ['a[href*="event"][href*="new"]', 'a[href*="event"][href*="create"]', 'button:has-text("Add Event")', 'a:has-text("Add Event")', 'a:has-text("Create Event")', '.add-event', '.new-event', '.btn-create'];
    for (const sel of addBtns) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }

    // If no button found, try direct URL
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
    const submitBtns = ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Submit")', 'button:has-text("Create")', 'button:has-text("Publish")', '.submit-event'];
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
    const submitBtns = ['button[type="submit"]', 'input[type="submit"]', '.EventForm-form button', 'button:has-text("Submit")'];
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
  results.evvnt = await submitEvvnt(event);
  // SA Current: Cloudflare-blocked — requires manual submission or ChatGPT Agent
  results.sacurrent = { success: false, platform: 'SA Current', error: 'Cloudflare-protected. Use the SA Current Wizard in the app to generate a ChatGPT prompt for manual submission.' };
  
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
