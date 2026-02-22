#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

const TOKEN = 'UJHDOM675PGO4EVHZE6O';
const EVENT_ID = '1983715128349';
const ORG_ID = '276674179461';
const BANNER_PATH = '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots/comedy-eventbrite-banner.png';
const BANNER_URL = 'https://qavrufepvcihklypxbvm.supabase.co/storage/v1/object/public/media/distribution/comedy-eventbrite-banner.png';

const FULL_DESCRIPTION = `<h2>Comedy Open Mic — Find Your Funny</h2>

<p><strong>Weekly stand-up comedy open mic</strong> hosted by <strong>Javier "Javi" Bazaldua</strong> and presented by <strong>Heavy City Productions</strong> at <strong>Mia's Midtown Meetup</strong> in San Antonio.</p>

<p><strong>Sign-up begins at 7:30 PM. Show starts at 8:00 PM.</strong></p>

<p>Open to comics of all levels — whether you're a seasoned performer or trying stand-up for the very first time, this is your stage. Come find your funny in a supportive, high-energy room where every voice gets heard.</p>

<h3>What to Expect</h3>
<ul>
<li>Open mic format — first come, first served sign-up</li>
<li>5-minute sets for each comic</li>
<li>Supportive audience and fellow comics</li>
<li>Full bar and food available</li>
<li>Free admission — all ages welcome</li>
</ul>

<h3>Venue</h3>
<p><strong>Mia's Midtown Meetup</strong><br>
801 West Russell Place<br>
San Antonio, TX 78212</p>

<p>Every Sunday night. Free. No cover. Just laughs.</p>

<p><em>Presented by Heavy City Productions and Good Creative Media.</em></p>

<p><strong>Find Your Funny.</strong></p>`;

function ebRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'www.eventbriteapi.com',
      path: '/v3' + path,
      method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function ebUpload(path, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const disposition = `Content-Disposition: form-data; name="file"; filename="banner.png"`;
    const header = `--${boundary}\r\n${disposition}\r\nContent-Type: ${contentType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(header), buffer, Buffer.from(footer)]);

    const opts = {
      hostname: 'www.eventbriteapi.com',
      path: '/v3' + path,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': body.length,
      },
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  // Step 1: Update event title + description
  console.log('1. Updating title and description...');
  const updateRes = await ebRequest('POST', `/events/${EVENT_ID}/`, {
    event: {
      name: { html: 'Comedy Open Mic — Find Your Funny' },
      description: { html: FULL_DESCRIPTION },
    },
  });
  console.log('   Status:', updateRes.status);
  if (updateRes.status === 200) {
    console.log('   ✅ Title & description updated');
    console.log('   New title:', updateRes.data.name?.text);
  } else {
    console.log('   ❌ Error:', JSON.stringify(updateRes.data).substring(0, 200));
  }

  // Step 2: Upload banner image
  console.log('\n2. Uploading banner image...');
  
  // First, get an upload token from Eventbrite
  const uploadRes = await ebRequest('GET', `/media/upload/?type=image-event-logo&token=${TOKEN}`, null);
  console.log('   Upload token status:', uploadRes.status);
  
  if (uploadRes.status === 200 && uploadRes.data.upload_url) {
    console.log('   Upload URL:', uploadRes.data.upload_url);
    console.log('   Upload token:', uploadRes.data.upload_token);
    
    // Upload the image to Eventbrite's S3
    const imgBuffer = fs.readFileSync(BANNER_PATH);
    
    // Eventbrite uses a specific upload flow — POST to their upload URL
    const uploadData = uploadRes.data;
    const formFields = uploadData.upload_data || {};
    
    // Build multipart form
    const boundary = '----EB' + Date.now();
    let parts = [];
    for (const [key, val] of Object.entries(formFields)) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}`);
    }
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="banner.png"\r\nContent-Type: image/png\r\n\r\n`);
    const preFile = Buffer.from(parts.join('\r\n') + '\r\n');
    const postFile = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([preFile, imgBuffer, postFile]);
    
    const s3Url = new URL(uploadData.upload_url);
    const s3Res = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: s3Url.hostname,
        path: s3Url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': fullBody.length,
        },
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, data: d }));
      });
      req.on('error', reject);
      req.write(fullBody);
      req.end();
    });
    console.log('   S3 upload status:', s3Res.status);
    
    if (s3Res.status >= 200 && s3Res.status < 400) {
      // Notify Eventbrite the upload is complete
      const notifyRes = await ebRequest('POST', `/media/upload/`, {
        upload_token: uploadData.upload_token,
        crop_mask: { top_left: { x: 0, y: 0 }, width: 2160, height: 1080 },
      });
      console.log('   Notify status:', notifyRes.status);
      
      if (notifyRes.data?.id) {
        // Set the logo on the event
        const logoRes = await ebRequest('POST', `/events/${EVENT_ID}/`, {
          event: { logo_id: notifyRes.data.id },
        });
        console.log('   Logo set status:', logoRes.status);
        console.log('   ✅ Banner uploaded and set!');
      }
    }
  } else {
    // Alternative: try setting logo from URL directly
    console.log('   Trying alternative image upload...');
    const altRes = await ebRequest('POST', `/events/${EVENT_ID}/`, {
      event: { logo: { url: BANNER_URL } },
    });
    console.log('   Alt status:', altRes.status, JSON.stringify(altRes.data).substring(0, 200));
  }

  // Step 3: Verify
  console.log('\n3. Verifying...');
  const verifyRes = await ebRequest('GET', `/events/${EVENT_ID}/`, null);
  if (verifyRes.status === 200) {
    console.log('   Title:', verifyRes.data.name?.text);
    console.log('   Description length:', verifyRes.data.description?.text?.length);
    console.log('   Logo:', verifyRes.data.logo?.url || 'none');
    console.log('   URL:', verifyRes.data.url);
  }
}

run().catch(console.error);
