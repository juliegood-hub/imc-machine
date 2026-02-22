#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// IMC Machine — Do210 Event Submission
// Logs in and submits an event to do210.com/events/new
// ═══════════════════════════════════════════════════════════════

const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome 2.app/Contents/MacOS/Google Chrome';

async function submitToDo210(event) {
  console.log('📅 Submitting to Do210:', event.title);
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 900 },
  });
  
  const page = await browser.newPage();

  try {
    // 1. Login
    console.log('  🔑 Logging in...');
    await page.goto('https://do210.com/users/sign_in', { waitUntil: 'networkidle2' });
    await page.type('input[type="email"], input#user_email', 'thisisthegoodlife@juliegood.com', { delay: 30 });
    await page.type('input[type="password"], input#user_password', '$up3rG00d', { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('  ✅ Logged in. URL:', page.url());

    // 2. Navigate to new event form
    await page.goto('https://do210.com/events/new', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // 3. Fill the form using exact field names from form mapping
    console.log('  📝 Filling form...');
    
    // Title (name="event[title]")
    await page.evaluate(() => document.querySelector('input[name="event[title]"]').value = '');
    await page.type('input[name="event[title]"]', event.title, { delay: 20 });

    // Description — check for TinyMCE iframe first, then plain textarea
    const descFrame = await page.$('iframe#event_description_ifr');
    if (descFrame) {
      const frame = await descFrame.contentFrame();
      await frame.click('body');
      await frame.type('body', event.description || '', { delay: 5 });
    } else {
      const descArea = await page.$('textarea[name="event[description]"]');
      if (descArea) await descArea.type(event.description || '', { delay: 5 });
    }

    // Venue — autocomplete field (name="event[venue_name]")
    const venueInput = await page.$('input[name="event[venue_name]"]');
    if (venueInput) {
      await venueInput.click();
      await venueInput.type(event.venue || '', { delay: 50 });
      await new Promise(r => setTimeout(r, 2000)); // Wait for autocomplete dropdown
      // Click first autocomplete suggestion
      const suggestion = await page.$('.ui-autocomplete li:first-child a, .ui-menu-item:first-child, .autocomplete-items div:first-child');
      if (suggestion) {
        await suggestion.click();
        console.log('    ✅ Venue selected from autocomplete');
      } else {
        console.log('    ⚠️ No venue autocomplete match — may need to create venue');
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // Date (name="event[begin_date]") — clear and set via JS to avoid datepicker issues
    await page.evaluate((dateStr) => {
      const input = document.querySelector('input[name="event[begin_date]"]');
      if (input) {
        input.value = dateStr;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, formatDate(event.date));
    console.log('    📅 Date set to:', formatDate(event.date));

    // Start Time (name="event[start_time]" or separate hour/minute selects)
    const startTimeSelect = await page.$('select[name="event[start_time]"]');
    if (startTimeSelect) {
      const { hour, period } = parseTime(event.time);
      const timeValue = hour + ' ' + period;
      // Try to select matching option
      await page.evaluate((val) => {
        const sel = document.querySelector('select[name="event[start_time]"]');
        if (sel) {
          const opts = Array.from(sel.options);
          const match = opts.find(o => o.text.includes(val) || o.value.includes(val));
          if (match) sel.value = match.value;
        }
      }, timeValue);
      console.log('    🕐 Time set to:', timeValue);
    }

    // Category (name="event[category_id]") — select by visible text
    await page.evaluate((genre) => {
      const sel = document.querySelector('select[name="event[category_id]"]');
      if (!sel) return;
      const opts = Array.from(sel.options);
      const genreLower = (genre || '').toLowerCase();
      const match = opts.find(o => {
        const t = o.text.toLowerCase();
        return t.includes('music') && genreLower.includes('music') ||
               t.includes('theater') && (genreLower.includes('theater') || genreLower.includes('theatre')) ||
               t.includes('comedy') && genreLower.includes('comedy') ||
               t.includes('dance') && genreLower.includes('dance') ||
               t.includes('art') && genreLower.includes('art') ||
               t.includes('festival') && genreLower.includes('festival');
      });
      if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, event.genre);
    console.log('    🎭 Category set for genre:', event.genre);

    // Ticket URL (name="event[buy_tickets]")
    if (event.ticketLink) {
      await page.evaluate(() => {
        const input = document.querySelector('input[name="event[buy_tickets]"]');
        if (input) input.value = '';
      });
      await page.type('input[name="event[buy_tickets]"]', event.ticketLink, { delay: 10 });
    }

    // Ticket Info (name="event[ticket_info]")
    if (event.ticketPrice) {
      await page.type('input[name="event[ticket_info]"]', event.ticketPrice, { delay: 10 });
    }

    // Poster from URL
    if (event.posterUrl) {
      await page.type('input[name="cloudinary_poster_image_from_url"]', event.posterUrl, { delay: 10 });
    }

    // Free event checkbox
    if (event.isFree) {
      await page.click('#event_free_event');
    }

    // 4. Screenshot before submit
    await page.screenshot({ path: '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots/do210-filled.png', fullPage: true });
    console.log('  📸 Form filled. Screenshot saved.');

    // 5. Submit
    if (process.argv.includes('--submit')) {
      const submitBtn = await page.$('input[type="submit"], button[type="submit"], .btn-submit');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        console.log('  ✅ SUBMITTED! Final URL:', page.url());
        await page.screenshot({ path: '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots/do210-submitted.png', fullPage: true });
        return { success: true, platform: 'Do210', url: page.url() };
      }
    } else {
      console.log('  ⚠️  Dry run — use --submit flag to actually submit');
      return { success: true, platform: 'Do210', dryRun: true };
    }

  } catch (err) {
    console.error('  ❌ Error:', err.message);
    await page.screenshot({ path: '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots/do210-error.png' }).catch(() => {});
    return { success: false, platform: 'Do210', error: err.message };
  } finally {
    await browser.close();
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function parseTime(timeStr) {
  if (!timeStr) return { hour: '7', period: 'PM' };
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/);
  if (!match) return { hour: '7', period: 'PM' };
  return { hour: match[1], period: (match[3] || 'PM').toUpperCase() };
}

// Parse event from CLI args
const eventJson = process.argv.find((_, i) => process.argv[i - 1] === '--event');
const event = eventJson ? JSON.parse(eventJson) : {
  title: 'Test Event — Good Creative Media',
  date: '2026-03-15',
  time: '7:00 PM',
  genre: 'Live Music',
  description: 'A test event from the IMC Machine by Good Creative Media.',
  venue: 'The Dakota East Side Ice House',
  address: '433 S. Hackberry St, San Antonio, TX 78203',
  ticketLink: 'https://goodcreativemedia.com',
};

submitToDo210(event).then(r => console.log('\nResult:', JSON.stringify(r, null, 2)));
