#!/usr/bin/env node
const https = require('https');
const http = require('http');
const fs = require('fs');

const TOKEN = 'UJHDOM675PGO4EVHZE6O';
const EVENT_ID = '1983715128349';
const BANNER_PATH = '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots/comedy-eventbrite-banner.png';

function ebRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'www.eventbriteapi.com', path: '/v3' + path, method,
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch(e) { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  // Step 1: Get upload instructions
  console.log('1. Getting upload token...');
  const uploadInfo = await new Promise((resolve, reject) => {
    https.get({
      hostname: 'www.eventbriteapi.com',
      path: '/v3/media/upload/?type=image-event-logo',
      headers: { 'Authorization': 'Bearer ' + TOKEN },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    }).on('error', reject);
  });
  const { upload_url, upload_token, upload_data } = uploadInfo.data;
  if (!upload_token) { console.log('Upload info:', JSON.stringify(uploadInfo.data).substring(0, 300)); return; }
  console.log('   Token:', upload_token.substring(0, 30) + '...');
  console.log('   S3 URL:', upload_url);

  // Step 2: Upload to S3
  console.log('2. Uploading to S3...');
  const imgBuffer = fs.readFileSync(BANNER_PATH);
  const boundary = '----EB' + Date.now();
  
  let bodyParts = [];
  // Add form fields from upload_data
  for (const [key, val] of Object.entries(upload_data)) {
    bodyParts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${val}\r\n`
    );
  }
  // Add the file
  bodyParts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="banner.png"\r\n` +
    `Content-Type: image/png\r\n\r\n`
  );
  
  const preFile = Buffer.from(bodyParts.join(''));
  const postFile = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fullBody = Buffer.concat([preFile, imgBuffer, postFile]);
  
  const s3Result = await new Promise((resolve, reject) => {
    const u = new URL(upload_url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: d.substring(0, 500) }));
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
  console.log('   S3 status:', s3Result.status);
  if (s3Result.status >= 300 && s3Result.status < 400) {
    console.log('   S3 redirect (expected for success):', s3Result.headers.location?.substring(0, 100));
  }
  
  // Step 3: Notify Eventbrite the upload is done
  console.log('3. Notifying Eventbrite...');
  const notifyRes = await ebRequest('POST', '/media/upload/', {
    upload_token: upload_token,
    crop_mask: {
      top_left: { x: 0, y: 0 },
      width: 2160,
      height: 1080,
    },
  });
  console.log('   Notify status:', notifyRes.status);
  console.log('   Response:', JSON.stringify(notifyRes.data).substring(0, 300));
  
  if (notifyRes.data?.id) {
    const mediaId = notifyRes.data.id;
    console.log('   Media ID:', mediaId);
    
    // Step 4: Set the logo on the event
    console.log('4. Setting event logo...');
    const logoRes = await ebRequest('POST', `/events/${EVENT_ID}/`, {
      event: { logo_id: mediaId },
    });
    console.log('   Logo status:', logoRes.status);
    if (logoRes.status === 200) {
      console.log('   ✅ Banner set!');
      console.log('   Logo URL:', logoRes.data.logo?.url);
    } else {
      console.log('   ❌', JSON.stringify(logoRes.data).substring(0, 200));
    }
  } else {
    console.log('   ❌ No media ID returned');
  }
}

run().catch(console.error);
