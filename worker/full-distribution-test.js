#!/usr/bin/env node
/**
 * Full IMC Machine Distribution Test
 * Simulates the Composer flow: Generate → Graphics → Distribute All
 * Calls the deployed Vercel API at imc.goodcreativemedia.com
 */
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const API_BASE = 'https://imc.goodcreativemedia.com';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NANO_BANANA_MODELS = ['nano-banana-pro-preview', 'gemini-3-pro-image-preview'];

function apiCall(path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, API_BASE);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d.substring(0, 500) }); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function geminiPost(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function generateNanoBanana(prompt) {
  for (const model of NANO_BANANA_MODELS) {
    try {
      const data = await geminiPost(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { contents: [{ parts: [{ text: 'Generate an image: ' + prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }
      );
      const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imgPart) {
        const buf = Buffer.from(imgPart.inlineData.data, 'base64');
        // Upload to Supabase for public URL
        const path = `distribution/${Date.now()}-banner.png`;
        await sb.storage.from('media').upload(path, buf, { contentType: 'image/png', upsert: true });
        const publicUrl = `https://qavrufepvcihklypxbvm.supabase.co/storage/v1/object/public/media/${path}`;
        return { url: publicUrl, dataUrl: `data:image/png;base64,${imgPart.inlineData.data}`, model, bytes: buf.length };
      }
    } catch (err) { console.log(`  ${model} failed:`, err.message); }
  }
  return null;
}

async function distributeEvent(event, venue, imagePrompt) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎪 ${event.title}`);
  console.log(`📅 ${event.date} at ${event.time} | 📍 ${venue.name}`);
  console.log('═'.repeat(60));

  // Step 1: Generate content via app API
  console.log('\n📝 Step 1: Generating content...');
  const genResult = await apiCall('/api/generate', {
    action: 'generate-all',
    event, venue,
    channels: ['press', 'social', 'calendar', 'email'],
  });
  if (genResult.error) {
    console.log('  ❌ Generate error:', genResult.error);
    // Use fallback content
  }
  const content = genResult.results || genResult;
  console.log('  Press:', content.press ? `✅ ${content.press.length} chars` : '❌');
  console.log('  Social:', content.social ? `✅ ${content.social.length} chars` : '❌');

  // Step 2: Generate Nano Banana poster
  console.log('\n🎨 Step 2: Generating Nano Banana poster...');
  const image = await generateNanoBanana(imagePrompt);
  if (image) {
    console.log(`  ✅ ${image.model} — ${image.bytes} bytes`);
    console.log(`  🌐 ${image.url}`);
  } else {
    console.log('  ❌ Image generation failed');
  }

  // Step 3: Create Eventbrite with full description + banner
  console.log('\n📅 Step 3: Creating Eventbrite listing...');
  const ebResult = await apiCall('/api/distribute', {
    action: 'create-eventbrite',
    event, venue,
    options: {
      description: content.press || event.description,
      bannerImage: image?.url || null,
    },
  });
  console.log('  Eventbrite:', ebResult.success ? `✅ ${ebResult.eventUrl}` : `❌ ${ebResult.error}`);
  if (ebResult.logoUrl) console.log('  Banner:', '✅ uploaded');

  // Step 4: Post to Facebook
  console.log('\n📱 Step 4: Facebook post...');
  const fbResult = await apiCall('/api/distribute', {
    action: 'post-facebook',
    event, venue,
    content: { socialFacebook: content.social || event.description },
    images: image ? { fb_post_landscape: image.url, fb_event_banner: image.url } : undefined,
  });
  console.log('  Facebook:', fbResult.success ? '✅ Posted' : `⚠️ ${fbResult.error || 'Not connected'}`);

  // Step 5: Post to Instagram (with public URL)
  console.log('\n📸 Step 5: Instagram post...');
  if (image?.url) {
    const igResult = await apiCall('/api/distribute', {
      action: 'post-instagram',
      event, venue,
      content: { instagramCaption: '' },
      images: { ig_post_square: image.url },
    });
    console.log('  Instagram:', igResult.success ? '✅ Posted' : `⚠️ ${igResult.error || 'Not connected'}`);
  } else {
    console.log('  Instagram: ⚠️ No image available');
  }

  // Step 6: Post to LinkedIn
  console.log('\n💼 Step 6: LinkedIn post...');
  const liResult = await apiCall('/api/distribute', {
    action: 'post-linkedin',
    event, venue,
    content: { linkedinPost: content.social || event.description },
    images: image ? { linkedin_post: image.url } : undefined,
  });
  console.log('  LinkedIn:', liResult.success ? '✅ Posted' : `⚠️ ${liResult.error || 'Not connected'}`);

  // Step 7: Queue calendar submissions (Do210 + TPR)
  console.log('\n📅 Step 7: Calendar queue (Do210 + TPR)...');
  const calResult = await apiCall('/api/distribute', {
    action: 'submit-calendars',
    event, venue,
  });
  console.log('  Calendars:', calResult.success ? `✅ ${calResult.message}` : `⚠️ ${calResult.error}`);

  // Step 8: Send press release
  console.log('\n📰 Step 8: Press release...');
  const pressResult = await apiCall('/api/distribute', {
    action: 'send-press-release',
    event, venue,
    content: content.press || event.description,
  });
  console.log('  Press:', pressResult.success ? `✅ Sent to ${pressResult.sent} contacts` : `⚠️ ${pressResult.error}`);

  console.log('\n' + '─'.repeat(60));
  return { ebResult, fbResult, liResult, calResult, pressResult };
}

async function main() {
  // Get events from Supabase
  const { data: events } = await sb.from('events').select('*').order('date');

  for (const e of events) {
    const venue = {
      name: e.venue_name || e.venue || '',
      address: [e.venue_street_number, e.venue_street_name, e.venue_suite].filter(Boolean).join(' '),
      city: e.venue_city || 'San Antonio',
      state: e.venue_state || 'TX',
      zip: e.venue_zip || '',
      phone: e.venue_phone || '',
      website: e.venue_website || '',
    };

    // Build appropriate image prompt per event
    let imagePrompt;
    if (e.title.includes('Comedy')) {
      imagePrompt = 'Wide cinematic banner for comedy open mic night. Dark atmospheric bar with warm amber spotlight on empty wooden stool and vintage microphone center stage. Exposed brick wall. String lights creating bokeh. Intimate dive bar. No text, no people, no faces. 2:1 aspect ratio.';
    } else if (e.title.includes('Belly Dance') || e.title.includes('Karavan')) {
      imagePrompt = 'Wide cinematic banner for belly dance night at a rustic Texas icehouse. Warm golden lighting, silhouettes of belly dancers with flowing fabric, rustic patio with string lights. East Side San Antonio vibe. Rich amber and crimson tones. No text, no faces. 2:1 aspect ratio.';
    } else {
      imagePrompt = `Wide cinematic event banner for ${e.title} at ${venue.name}. Atmospheric, moody, warm lighting. No text, no people, no faces. 2:1 aspect ratio.`;
    }

    await distributeEvent(e, venue, imagePrompt);
  }

  console.log('\n\n✅ FULL DISTRIBUTION TEST COMPLETE');
}

main().catch(console.error);
