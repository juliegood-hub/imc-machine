#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// IMC Machine — Automated Event Submission v2
// Field-verified against live forms on 2026-02-18
//
// Usage:
//   node submit-events-v2.js do210 --event '{"title":"...", ...}'
//   node submit-events-v2.js all --event '{"title":"...", ...}'
//   node submit-events-v2.js do210 --dry-run --event '{"title":"...", ...}'
// ═══════════════════════════════════════════════════════════════

const puppeteer = require('puppeteer-core');

const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_DIR = '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots';

const CREDENTIALS = {
  do210: { email: 'thisisthegoodlife@juliegood.com', password: '$up3rG00d' },
};

// ═══════════════════════════════════════════════════════════════
// DO210 — Field-verified selectors (2026-02-18)
// Form: #new_event (action: https://do210.com/events, method: POST)
// ═══════════════════════════════════════════════════════════════

// Real category IDs from live dropdown
const DO210_CATEGORIES = {
  'Music':            '557',
  'Comedy':           '2030',
  'Dance':            '2061',
  'Film & Theatre':   '2029',
  'Theatre':          '3095',  // "Theatre & Performing Arts"
  'Festival':         '2366',
  'Food & Drink':     '2051',
  'Art':              '2027',
  'Education':        '3854',
  'Special Event':    '2367',
  'Dj/Parties':       '2805',
  'Health/Wellness':  '2843',
  'Social':           '2079',
  'Variety':          '5118',
};

// Map our 5 genres to Do210 categories
const GENRE_TO_DO210 = {
  'Theater | Plays | Musicals':                          '3095',
  'Live Music | Contemporary | Jazz | Electronic | Indie': '557',
  'Orchestral | Classical | Choral':                      '557',
  'Comedy | Speaking | Lectures | Workshops':             '2030',
  'Dance | Performance Art | Experimental':               '2061',
};

async function launchBrowser(headless = true) {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 },
  });
}

async function submitDo210(event, options = {}) {
  const { dryRun = false, headless = true } = options;
  console.log(`📅 ${dryRun ? '[DRY RUN] ' : ''}Submitting to Do210...`);
  const browser = await launchBrowser(headless);
  const page = await browser.newPage();
  
  try {
    // Step 1: Login
    console.log('  🔑 Logging in...');
    await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.type('#user_email', CREDENTIALS.do210.email, { delay: 20 });
    await page.type('#user_password', CREDENTIALS.do210.password, { delay: 20 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    
    const afterLogin = page.url();
    if (afterLogin.includes('sign_in')) {
      throw new Error('Login failed — still on sign_in page');
    }
    console.log('  ✅ Logged in:', afterLogin);

    // Step 2: Navigate to event creation form
    await page.goto('https://do210.com/events/new', { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    console.log('  📝 Filling event form...');

    // Title (verified: #event_title, input text)
    await page.waitForSelector('#event_title', { timeout: 10000 });
    await page.click('#event_title', { clickCount: 3 });
    await page.type('#event_title', event.title, { delay: 15 });
    console.log('    ✓ Title:', event.title);

    // Presented By (verified: #event_presented_by)
    if (event.presentedBy) {
      await page.click('#event_presented_by', { clickCount: 3 });
      await page.type('#event_presented_by', event.presentedBy, { delay: 15 });
      console.log('    ✓ Presented by:', event.presentedBy);
    }

    // Venue (verified: #bands_venue_id with jQuery UI autocomplete)
    const venueName = event.venue || 'The Dakota East Side Ice House';
    await page.click('#bands_venue_id', { clickCount: 3 });
    await page.type('#bands_venue_id', venueName, { delay: 30 });
    await new Promise(r => setTimeout(r, 2000)); // wait for autocomplete
    // Try to click first autocomplete suggestion
    try {
      await page.waitForSelector('.ui-autocomplete .ui-menu-item, .ui-autocomplete li', { timeout: 3000 });
      await page.click('.ui-autocomplete .ui-menu-item:first-child, .ui-autocomplete li:first-child');
      console.log('    ✓ Venue (autocomplete):', venueName);
    } catch {
      console.log('    ⚠️ Venue typed manually (no autocomplete match):', venueName);
    }

    // Start Date (verified: #event_begin_date, text input — likely datepicker)
    await page.evaluate((date) => {
      const el = document.querySelector('#event_begin_date');
      if (el) {
        el.value = date;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, event.date);
    console.log('    ✓ Date:', event.date);

    // Start Time (verified: #event_begin_time_4i = hours, #event_begin_time_5i = minutes — select dropdowns)
    if (event.time) {
      const [hours, minutes] = event.time.split(':');
      const hour24 = parseInt(hours);
      const hourStr = hour24.toString().padStart(2, '0');
      const minStr = (parseInt(minutes) < 30 ? '00' : '30');
      
      await page.select('#event_begin_time_4i', hourStr);
      await page.select('#event_begin_time_5i', minStr);
      console.log(`    ✓ Time: ${hourStr}:${minStr}`);
    }

    // End Time
    if (event.endTime) {
      const [hours, minutes] = event.endTime.split(':');
      await page.select('#event_end_time_4i', hours.padStart(2, '0'));
      await page.select('#event_end_time_5i', parseInt(minutes) < 30 ? '00' : '30');
      console.log(`    ✓ End time: ${event.endTime}`);
    }

    // Category (verified: #event_category_id — select dropdown)
    const categoryId = GENRE_TO_DO210[event.genre] || DO210_CATEGORIES['Music'] || '557';
    try {
      await page.select('#event_category_id', categoryId);
      console.log('    ✓ Category:', categoryId);
    } catch {
      console.log('    ⚠️ Category select failed, trying evaluate...');
      await page.evaluate((id) => {
        const sel = document.querySelector('#event_category_id');
        if (sel) { sel.value = id; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      }, categoryId);
    }

    // Free Event checkbox (verified: #event_event_setting_attributes_free_event)
    if (event.free) {
      await page.click('#event_event_setting_attributes_free_event');
      console.log('    ✓ Free event: checked');
    }

    // Ticket URL (verified: #event_buy_tickets)
    if (event.ticketLink) {
      await page.click('#event_buy_tickets', { clickCount: 3 });
      await page.type('#event_buy_tickets', event.ticketLink, { delay: 10 });
      console.log('    ✓ Ticket link:', event.ticketLink);
    }

    // Ticket Info (verified: #event_ticket_info)
    if (event.ticketPrice) {
      await page.click('#event_ticket_info', { clickCount: 3 });
      await page.type('#event_ticket_info', event.ticketPrice, { delay: 10 });
      console.log('    ✓ Ticket info:', event.ticketPrice);
    }

    // Hero Image via URL (verified: #cloudinary_hero_image_from_url)
    if (event.imageUrl) {
      await page.click('#cloudinary_hero_image_from_url', { clickCount: 3 });
      await page.type('#cloudinary_hero_image_from_url', event.imageUrl, { delay: 10 });
      console.log('    ✓ Hero image URL:', event.imageUrl);
    }

    // Poster Image via URL (verified: #cloudinary_poster_image_from_url)
    if (event.posterUrl) {
      await page.click('#cloudinary_poster_image_from_url', { clickCount: 3 });
      await page.type('#cloudinary_poster_image_from_url', event.posterUrl, { delay: 10 });
      console.log('    ✓ Poster image URL:', event.posterUrl);
    }

    // Screenshot before submit
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-filled-v2.png`, fullPage: true });
    console.log('  📸 Screenshot: do210-filled-v2.png');

    if (dryRun) {
      console.log('  🏁 DRY RUN — not submitting. Form filled successfully.');
      return { success: true, platform: 'Do210', dryRun: true, message: 'Form filled successfully (dry run)' };
    }

    // Step 3: Submit
    console.log('  🚀 Submitting...');
    const submitBtn = await page.$('#new_event input[type="submit"], #new_event button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.evaluate(() => {
        const form = document.querySelector('#new_event');
        if (form) form.submit();
      });
    }
    
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-submitted-v2.png`, fullPage: true });

    const finalUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const success = (finalUrl.includes('/events/') && !finalUrl.includes('/new')) 
      || pageText.toLowerCase().includes('success') 
      || pageText.toLowerCase().includes('submitted')
      || pageText.toLowerCase().includes('pending');

    console.log(`  ${success ? '✅' : '⚠️'} Do210 ${success ? 'submitted!' : 'needs review'} — ${finalUrl}`);
    return { success, platform: 'Do210', url: finalUrl, message: success ? 'Event submitted' : 'May need manual review' };

  } catch (err) {
    console.error('  ❌ Do210 error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/do210-error-v2.png` }).catch(() => {});
    return { success: false, platform: 'Do210', error: err.message };
  } finally {
    await browser.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// EVENTBRITE — API-based (no browser needed!)
// Verified working 2026-02-18: org 276674179461, venue 296501198
// ═══════════════════════════════════════════════════════════════

async function submitEventbrite(event, options = {}) {
  const { dryRun = false } = options;
  const TOKEN = process.env.VITE_EVENTBRITE_TOKEN || 'UJHDOM675PGO4EVHZE6O';
  const ORG_ID = '276674179461';
  const VENUE_ID = '296501198'; // The Dakota East Side Ice House
  
  console.log(`🎟️ ${dryRun ? '[DRY RUN] ' : ''}Creating Eventbrite event...`);

  // Convert date/time to UTC
  const startLocal = `${event.date}T${event.time || '19:00'}:00`;
  const endLocal = `${event.date}T${event.endTime || '22:00'}:00`;
  // Rough CST→UTC (+6h)
  const startUTC = new Date(new Date(startLocal).getTime() + 6 * 3600000).toISOString().replace(/\.\d+Z/, 'Z');
  const endUTC = new Date(new Date(endLocal).getTime() + 6 * 3600000).toISOString().replace(/\.\d+Z/, 'Z');

  const payload = {
    event: {
      name: { html: event.title },
      description: { html: `<p>${event.description || event.title}</p>` },
      start: { timezone: 'America/Chicago', utc: startUTC },
      end: { timezone: 'America/Chicago', utc: endUTC },
      currency: 'USD',
      venue_id: event.venueId || VENUE_ID,
      online_event: false,
      listed: !dryRun, // only list if not dry run
      shareable: true,
    }
  };

  if (dryRun) {
    console.log('  🏁 DRY RUN payload:', JSON.stringify(payload, null, 2));
    return { success: true, platform: 'Eventbrite', dryRun: true, message: 'Would create event (dry run)' };
  }

  try {
    const res = await fetch(`https://www.eventbriteapi.com/v3/organizations/${ORG_ID}/events/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    console.log(`  ✅ Eventbrite event created: ${data.url}`);
    console.log(`  📋 ID: ${data.id}, Status: ${data.status}`);

    // If we have a ticket price, create a ticket class
    if (event.ticketPrice && event.ticketPrice !== 'Free') {
      const priceMatch = event.ticketPrice.match(/\d+/);
      if (priceMatch) {
        const priceCents = parseInt(priceMatch[0]) * 100;
        await fetch(`https://www.eventbriteapi.com/v3/events/${data.id}/ticket_classes/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_class: {
              name: 'General Admission',
              quantity_total: event.capacity || 100,
              cost: `USD,${priceCents}`,
              free: false,
            }
          }),
        });
        console.log(`  🎫 Ticket class created: $${priceMatch[0]}`);
      }
    } else {
      // Free ticket
      await fetch(`https://www.eventbriteapi.com/v3/events/${data.id}/ticket_classes/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_class: {
            name: 'General Admission',
            quantity_total: event.capacity || 100,
            free: true,
          }
        }),
      });
      console.log('  🎫 Free ticket class created');
    }

    // Publish the event
    if (!dryRun) {
      const pubRes = await fetch(`https://www.eventbriteapi.com/v3/events/${data.id}/publish/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      });
      const pubData = await pubRes.json();
      if (pubData.published) {
        console.log('  🌐 Event PUBLISHED and live!');
      } else {
        console.log('  ⚠️ Publish response:', JSON.stringify(pubData));
      }
    }

    return { 
      success: true, 
      platform: 'Eventbrite', 
      url: data.url, 
      eventId: data.id,
      message: `Event created: ${data.url}` 
    };

  } catch (err) {
    console.error('  ❌ Eventbrite error:', err.message);
    return { success: false, platform: 'Eventbrite', error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// TPR (Texas Public Radio) Community Calendar
// Form: https://www.tpr.org/community-calendar-event-submission
// No login required — public form submission via POST to /form/submit
// Powered by Brightspot CMS (ps-form-ajax)
//
// TPR CRITERIA (note in event selection):
//   - Free events
//   - Nonprofit organizations
//   - College/university events
//   - Fundraisers where 100% goes to nonprofit
//   - Events in TPR listener area (San Antonio + surrounding)
//
// NOT ACCEPTED: political rallies, gambling, merchandise sales,
//   commercial promotion, religious services, raffles/bingo
// ═══════════════════════════════════════════════════════════════

// TPR category IDs from live form (Brightspot UUIDs)
const TPR_CATEGORIES = {
  'Art & Museum Exhibits':  '00000174-bb76-d29e-a77f-bf7fe8190000',
  'Book Readings':          '00000174-bb77-d29e-a77f-bf7f34530000',
  'Charity & Outreach':     '00000174-bb77-d29e-a77f-bf7f082b0000',
  'Classes/Workshops':      '00000174-bb76-d29e-a77f-bf7fe0a70000',
  'Classical Music':        '00000174-bb76-d29e-a77f-bf7fe8000000',
  'Club Listings':          '00000174-bb76-d29e-a77f-bf7ff3100000',
  'Community Events':       '00000174-bb76-d29e-a77f-bf7fe1d50000',
  'Dance':                  '00000174-bb77-d29e-a77f-bf7f61750000',
  'Fairs & Festivals':      '00000174-bb76-d29e-a77f-bf7fed380000',
  'Film':                   '00000174-bb77-d29e-a77f-bf7fb1140000',
  'International Music':    '00000174-bb76-d29e-a77f-bf7ff9680000',
  'Lectures/Literary':      '00000174-bb77-d29e-a77f-bf7f361b0000',
  'Live Music: Other':      '00000174-bb76-d29e-a77f-bf7ff2430000',
  'Musicals':               '00000174-bb77-d29e-a77f-bf7f0e210000',
  'Play':                   '00000174-bb77-d29e-a77f-bf7f692e0000',
  'Stand-Up Comedy':        '00000174-bb77-d29e-a77f-bf7f02070000',
  'Theater':                '00000174-bb77-d29e-a77f-bf7f01ee0000',
  'Misc.':                  '00000174-bb76-d29e-a77f-bf7fe8320000',
};

// Map our 5 genres to TPR categories
const GENRE_TO_TPR = {
  'Theater | Plays | Musicals':                          'Theater',
  'Live Music | Contemporary | Jazz | Electronic | Indie': 'Live Music: Other',
  'Orchestral | Classical | Choral':                      'Classical Music',
  'Comedy | Speaking | Lectures | Workshops':             'Stand-Up Comedy',
  'Dance | Performance Art | Experimental':               'Dance',
};

async function submitTPR(event, options = {}) {
  const { dryRun = false, headless = true } = options;
  console.log(`📻 ${dryRun ? '[DRY RUN] ' : ''}Submitting to TPR Community Calendar...`);
  const browser = await launchBrowser(headless);
  const page = await browser.newPage();

  try {
    // Navigate to the submission page
    console.log('  📝 Loading TPR submission form...');
    await page.goto('https://www.tpr.org/community-calendar-event-submission', {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });
    await new Promise(r => setTimeout(r, 2000));

    // Event Title (name="event-title")
    await page.waitForSelector('input[name="event-title"]', { timeout: 10000 });
    await page.type('input[name="event-title"]', event.title, { delay: 15 });
    console.log('    ✓ Title:', event.title);

    // Event Description (name="event-description")
    const description = event.description || event.title;
    await page.type('textarea[name="event-description"], input[name="event-description"]', description, { delay: 10 });
    console.log('    ✓ Description:', description.substring(0, 60) + '...');

    // Event Type: one-time-event (default, already checked)
    console.log('    ✓ Event type: one-time');

    // Event Date (name="event-date", type="date" → YYYY-MM-DD)
    await page.evaluate((date) => {
      const el = document.querySelector('input[name="event-date"]');
      if (el) {
        // Set nativeInputValueSetter to trigger React/framework change detection
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(el, date);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, event.date);
    console.log('    ✓ Date:', event.date);

    // Start Time (name="start-time", type="time" → HH:MM)
    if (event.time) {
      await page.evaluate((time) => {
        const el = document.querySelector('input[name="start-time"]');
        if (el) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(el, time);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, event.time);
      console.log('    ✓ Start time:', event.time);
    }

    // End Time (name="end-time", type="time")
    if (event.endTime) {
      await page.evaluate((time) => {
        const el = document.querySelector('input[name="end-time"]');
        if (el) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(el, time);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, event.endTime);
      console.log('    ✓ End time:', event.endTime);
    }

    // Event Category (name="event-category", multi-select)
    const tprCatName = GENRE_TO_TPR[event.genre] || 'Community Events';
    const tprCatId = TPR_CATEGORIES[tprCatName] || TPR_CATEGORIES['Community Events'];
    await page.select('select[name="event-category"]', tprCatId);
    console.log('    ✓ Category:', tprCatName);

    // Free Event checkbox (name="this-is-a-free-event")
    if (event.free) {
      const freeCheckbox = await page.$('input[name="this-is-a-free-event"]');
      if (freeCheckbox) {
        await freeCheckbox.click();
        console.log('    ✓ Free event: checked');
      }
    }

    // Ticket URL (name="ticketing-website")
    if (event.ticketLink) {
      await page.type('input[name="ticketing-website"]', event.ticketLink, { delay: 10 });
      console.log('    ✓ Ticket URL:', event.ticketLink);
    }

    // Price info (name="additional-pricing-information")
    if (event.ticketPrice) {
      await page.type('input[name="additional-pricing-information"], textarea[name="additional-pricing-information"]', event.ticketPrice, { delay: 10 });
      console.log('    ✓ Price info:', event.ticketPrice);
    }

    // Venue fields
    const venueName = event.venue || 'The Dakota East Side Ice House';
    await page.type('input[name="venue-name"]', venueName, { delay: 15 });
    console.log('    ✓ Venue name:', venueName);

    if (event.venueAddress) {
      await page.type('input[name="venue-street-address"]', event.venueAddress, { delay: 10 });
    }
    // City defaults to San Antonio
    await page.type('input[name="venue-city"]', event.venueCity || 'San Antonio', { delay: 10 });
    await page.type('input[name="venue-state"]', event.venueState || 'TX', { delay: 10 });
    if (event.venueZip) {
      await page.type('input[name="venue-zip"]', event.venueZip, { delay: 10 });
    }
    console.log('    ✓ Venue location filled');

    // Presenting Organization
    if (event.presentedBy) {
      await page.type('input[name="presenting-organization-name"]', event.presentedBy, { delay: 10 });
      console.log('    ✓ Presenting org:', event.presentedBy);
    }

    // Presenting org designation — default to "not-for-profit" for TPR eligibility
    try {
      await page.click('input[name="presenting-organization-designation"][value="not-for-profit"]');
      console.log('    ✓ Org designation: Not For Profit');
    } catch {
      console.log('    ⚠️ Could not set org designation');
    }

    // Contact / submitter info
    const contactName = event.contactName || 'Julie Good';
    const contactEmail = event.contactEmail || 'thisisthegoodlife@juliegood.com';
    await page.type('input[name="your-information-name"]', contactName, { delay: 10 });
    await page.type('input[name="your-information-email"]', contactEmail, { delay: 10 });
    console.log('    ✓ Contact info:', contactName, contactEmail);

    // Image upload (name="event-image") — skip for now, file upload requires local path
    if (event.imageUrl) {
      console.log('    ⚠️ Image URL provided but TPR requires file upload — skipping');
    }

    // Screenshot before submit
    await page.screenshot({ path: `${SCREENSHOT_DIR}/tpr-filled.png`, fullPage: true });
    console.log('  📸 Screenshot: tpr-filled.png');

    if (dryRun) {
      console.log('  🏁 DRY RUN — not submitting. Form filled successfully.');
      return { success: true, platform: 'TPR', dryRun: true, message: 'Form filled successfully (dry run)' };
    }

    // Submit the form
    console.log('  🚀 Submitting...');
    await page.evaluate(() => {
      const form = document.querySelector('.EventForm-form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) submitBtn.click();
        else form.submit();
      }
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    await page.screenshot({ path: `${SCREENSHOT_DIR}/tpr-submitted.png`, fullPage: true });

    const finalUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    const success = pageText.toLowerCase().includes('thank') ||
                    pageText.toLowerCase().includes('success') ||
                    pageText.toLowerCase().includes('submitted') ||
                    pageText.toLowerCase().includes('received');

    console.log(`  ${success ? '✅' : '⚠️'} TPR ${success ? 'submitted!' : 'needs review'} — ${finalUrl}`);
    return { success, platform: 'TPR', url: finalUrl, message: success ? 'Event submitted to TPR' : 'May need manual review' };

  } catch (err) {
    console.error('  ❌ TPR error:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/tpr-error.png` }).catch(() => {});
    return { success: false, platform: 'TPR', error: err.message };
  } finally {
    await browser.close();
  }
}

// ═══════════════════════════════════════════════════════════════
// SUBMIT ALL
// ═══════════════════════════════════════════════════════════════

async function submitAll(event, options = {}) {
  console.log('═══════════════════════════════════════════════════');
  console.log('  IMC Machine — Multi-Platform Event Submission');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Event:', event.title);
  console.log('  Venue:', event.venue);
  console.log('  Date:', event.date, event.time);
  if (options.dryRun) console.log('  ⚠️  DRY RUN MODE');
  console.log('═══════════════════════════════════════════════════\n');

  const results = [];

  // Do210 (browser)
  results.push(await submitDo210(event, options));
  
  // Eventbrite (API)
  results.push(await submitEventbrite(event, options));

  // TPR Community Calendar (browser — free/nonprofit events only)
  results.push(await submitTPR(event, options));

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════');
  results.forEach(r => {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.platform}: ${r.message || r.error}`);
    if (r.url) console.log(`     → ${r.url}`);
  });
  console.log('═══════════════════════════════════════════════════');

  return results;
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const platform = args[0];
const dryRun = args.includes('--dry-run');
const headless = !args.includes('--show');
const eventIdx = args.indexOf('--event');
let event;

if (eventIdx >= 0 && args[eventIdx + 1]) {
  try { event = JSON.parse(args[eventIdx + 1]); } catch (e) {
    console.error('Invalid JSON for --event');
    process.exit(1);
  }
} else {
  // Demo event for testing
  event = {
    title: 'Friday Night Jazz at The Dakota',
    venue: 'The Dakota East Side Ice House',
    date: '2026-03-15',
    time: '19:00',
    endTime: '22:00',
    genre: 'Live Music | Contemporary | Jazz | Electronic | Indie',
    description: 'An evening of live jazz featuring San Antonio\'s finest musicians. $10 cover, doors at 6:30 PM.',
    ticketPrice: '$10',
    free: false,
    presentedBy: 'Good Creative Media',
  };
  console.log('Using demo event. Pass --event \'{"title":"..."}\' for custom.');
}

(async () => {
  const options = { dryRun, headless };
  
  switch (platform) {
    case 'do210':
      await submitDo210(event, options);
      break;
    case 'eventbrite':
      await submitEventbrite(event, options);
      break;
    case 'tpr':
      await submitTPR(event, options);
      break;
    case 'all':
      await submitAll(event, options);
      break;
    default:
      console.log('Usage: node submit-events-v2.js [do210|eventbrite|tpr|all] [--dry-run] [--show] [--event \'{"title":"..."}\']');
      process.exit(1);
  }
})();

module.exports = { submitDo210, submitEventbrite, submitTPR, submitAll };
