#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
// Not needed for this script

const TOKEN = process.env.EVENTBRITE_TOKEN;
// sb not needed
const GEMINI_KEY = process.env.GEMINI_API_KEY;

function ebRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const isGet = method === 'GET';
    const opts = {
      hostname: 'www.eventbriteapi.com', path: '/v3' + path, method,
      headers: { 'Authorization': 'Bearer ' + TOKEN, ...(isGet ? {} : { 'Content-Type': 'application/json' }) },
    };
    const req = (isGet ? https.get : https.request)(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(d) }); } catch(e) { resolve({ s: res.statusCode, d }); } });
    });
    if (!isGet) { req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end(); }
    else req.on('error', reject);
  });
}

function geminiImage(prompt) {
  return new Promise((resolve, reject) => {
    const u = new URL(`https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${GEMINI_KEY}`);
    const body = JSON.stringify({ contents: [{ parts: [{ text: 'Generate an image: ' + prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } });
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function uploadBanner(eventId, imageBuffer) {
  // Get upload token
  const { d: uploadInfo } = await ebRequest('GET', '/media/upload/?type=image-event-logo');
  const { upload_url, upload_token, upload_data } = uploadInfo;

  // Upload to S3
  const boundary = '----EB' + Date.now();
  let parts = [];
  for (const [k, v] of Object.entries(upload_data)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="banner.png"\r\nContent-Type: image/png\r\n\r\n`);
  const pre = Buffer.from(parts.join(''));
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const full = Buffer.concat([pre, imageBuffer, post]);

  await new Promise((resolve, reject) => {
    const u = new URL(upload_url);
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': full.length } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.write(full); req.end();
  });

  // Notify EB
  const { d: media } = await ebRequest('POST', '/media/upload/', { upload_token, crop_mask: { top_left: { x: 0, y: 0 }, width: 2160, height: 1080 } });
  if (!media.id) { console.log('  ❌ No media ID'); return; }

  // Set logo
  await ebRequest('POST', `/events/${eventId}/`, { event: { logo_id: media.id } });
  console.log('  ✅ Banner uploaded!');
}

async function updateAndBanner(eventId, title, desc, imgPrompt) {
  console.log(`\n🎪 ${title} (${eventId})`);

  // Update description
  console.log('  Updating description...');
  const { s } = await ebRequest('POST', `/events/${eventId}/`, { event: { description: { html: desc } } });
  console.log('  Description:', s === 200 ? '✅' : '❌');

  // Generate + upload banner
  console.log('  Generating Nano Banana banner...');
  const data = await geminiImage(imgPrompt);
  const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!imgPart) { console.log('  ❌ No image generated'); return; }
  const buf = Buffer.from(imgPart.inlineData.data, 'base64');
  console.log(`  ✅ Generated (${buf.length} bytes)`);

  console.log('  Uploading banner...');
  await uploadBanner(eventId, buf);
}

(async () => {
  // Comedy Open Mic
  await updateAndBanner('1983724928662', 'Comedy Open Mic — Find Your Funny',
    `<h2>Comedy Open Mic — Find Your Funny</h2>
<p><strong>Weekly stand-up comedy open mic</strong> hosted by <strong>Javier "Javi" Bazaldua</strong> and presented by <strong>Heavy City Productions</strong> at <strong>Midtown Meetup</strong> in San Antonio.</p>
<p><strong>Sign-up begins at 7:30 PM. Show starts at 8:00 PM.</strong></p>
<p>Open to comics of all levels — whether you're a seasoned performer or trying stand-up for the very first time, this is your stage. Come find your funny in a supportive, high-energy room where every voice gets heard.</p>
<h3>What to Expect</h3>
<ul><li>Open mic format — first come, first served sign-up</li><li>5-minute sets for each comic</li><li>Supportive audience and fellow comics</li><li>Full bar and food available</li><li>Free admission — all ages welcome</li></ul>
<h3>Venue</h3>
<p><strong>Midtown Meetup</strong><br>801 West Russell Place<br>San Antonio, TX 78212</p>
<p>Every Sunday night. Free. No cover. Just laughs.</p>
<p><em>Presented by Heavy City Productions and Good Creative Media.</em></p>`,
    'Wide cinematic banner for comedy open mic night. Dark atmospheric bar with warm amber spotlight on empty wooden stool and vintage microphone center stage. Exposed brick wall. String lights creating bokeh. Intimate dive bar. No text, no people, no faces. 2:1 aspect ratio.'
  );

  // Karavan Belly Dance
  await updateAndBanner('1983724960758', "Karavan Studio's Belly Dance Tuesdays",
    `<h2>Karavan Studio's Belly Dance Tuesdays</h2>
<p>Experience the magic of <strong>live music and improvisational belly dance</strong> every Tuesday at <strong>The Dakota East Side Ice House</strong>!</p>
<p>Led by San Antonio belly dance pioneer <strong>Karen Barbee</strong>, members of Karavan Studio's Project Band perform dynamic, freestyle belly dance to the soulful, funky sounds of <strong>Isaac &amp; Co</strong> and other live musicians.</p>
<p>This weekly event is part performance and part jam session — dancers and musicians feed off each other's energy to create one-of-a-kind grooves.</p>
<h3>Details</h3>
<ul><li>Every Tuesday, 7:00 PM – 10:00 PM</li><li>Dog-friendly patio</li><li>Full bar and food</li><li>All ages welcome</li><li>No cover charge</li></ul>
<h3>Venue</h3>
<p><strong>The Dakota East Side Ice House</strong><br>433 S Hackberry St<br>San Antonio, TX 78203<br>(210) 375-6009</p>
<p>Come relax, enjoy East Side vibes, and support local artists!</p>
<p><em>Presented by Karavan Studio and Good Creative Media.</em></p>`,
    'Wide cinematic banner for belly dance night at a rustic Texas icehouse. Warm golden lighting, silhouettes of belly dancers with flowing fabric, rustic patio with string lights. East Side San Antonio vibe. Rich amber and crimson. No text, no faces. 2:1 aspect ratio.'
  );

  // Also fix the original Comedy event (from earlier today)
  console.log('\n📝 Also updating original Comedy Eventbrite (1983715128349)...');
  await uploadBanner('1983715128349', fs.readFileSync('/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots/comedy-poster-gemini.png'));

  console.log('\n✅ All Eventbrite events updated with banners + descriptions!');
})().catch(console.error);
