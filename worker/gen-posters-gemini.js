#!/usr/bin/env node
/**
 * Generate event posters using Gemini Nano Banana (same as IMC Machine app)
 * Tries nano-banana-pro-preview first, then gemini-3-pro-image-preview, then gemini-2.5-flash-image
 * Falls back to DALL-E only if all Gemini models fail
 */
const https = require('https');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const GEMINI_MODELS = [
  'nano-banana-pro-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
];

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(d.substring(0, 200))); } });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function generateWithGemini(prompt) {
  for (const model of GEMINI_MODELS) {
    console.log(`  Trying ${model}...`);
    try {
      const data = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          contents: [{ parts: [{ text: 'Generate an image: ' + prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }
      );
      
      if (data.error) {
        console.log(`  ❌ ${model}: ${data.error.message?.substring(0, 100)}`);
        continue;
      }
      
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData);
      if (imgPart) {
        console.log(`  ✅ ${model} generated image!`);
        return {
          buffer: Buffer.from(imgPart.inlineData.data, 'base64'),
          mimeType: imgPart.inlineData.mimeType || 'image/png',
          model,
        };
      } else {
        console.log(`  ⚠️ ${model}: no image in response`);
      }
    } catch (err) {
      console.log(`  ❌ ${model}: ${err.message?.substring(0, 100)}`);
    }
  }
  return null;
}

async function generatePoster(name, prompt, storagePath, localPath) {
  console.log(`\n🎨 Generating: ${name}`);
  
  const result = await generateWithGemini(prompt);
  if (!result) {
    console.log('  All Gemini models failed. Skipping (would use DALL-E in production).');
    return null;
  }

  // Save locally
  fs.writeFileSync(localPath, result.buffer);
  console.log(`  💾 Saved locally: ${localPath} (${result.buffer.length} bytes)`);

  // Upload to Supabase
  const { error } = await sb.storage.from('media').upload(storagePath, result.buffer, {
    contentType: result.mimeType,
    upsert: true,
  });
  if (error) {
    console.log(`  ❌ Upload error: ${error.message}`);
    return null;
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
  console.log(`  🌐 Public URL: ${publicUrl}`);
  console.log(`  🤖 Model: ${result.model}`);
  return publicUrl;
}

async function main() {
  const screenshotDir = '/Users/littlemacbook/.openclaw/workspace/imc-machine/screenshots';

  // Karavan Belly Dance poster
  const karavanUrl = await generatePoster(
    'Karavan Belly Dance Tuesdays',
    'Professional event poster for a weekly belly dance night at a rustic Texas dive bar called The Dakota East Side Ice House in San Antonio. Warm golden ambient lighting, silhouettes of belly dancers with flowing scarves and fabric, stage area with string lights overhead. Rustic patio with a live music vibe — East Side San Antonio grittiness meets elegance. Rich amber and deep crimson tones. Artistic, moody atmosphere. No text, no words, no faces.',
    'distribution/karavan-belly-dance-tuesdays-v2.png',
    `${screenshotDir}/karavan-poster-gemini.png`
  );

  // Comedy Open Mic poster
  const comedyUrl = await generatePoster(
    'Comedy Open Mic — Find Your Funny',
    'Professional event poster for a weekly comedy open mic night at a San Antonio bar. Dark moody atmosphere with a single warm spotlight illuminating an empty wooden stool and vintage microphone on a small stage. Exposed brick wall backdrop. Warm amber and golden tones. Intimate dive bar setting. A few empty chairs in foreground suggest anticipation. No text, no words, no people, no faces.',
    'distribution/comedy-open-mic-find-your-funny-v2.png',
    `${screenshotDir}/comedy-poster-gemini.png`
  );

  console.log('\n═══════════════════════════════════════');
  console.log('Results:');
  console.log('  Karavan:', karavanUrl || 'FAILED');
  console.log('  Comedy:', comedyUrl || 'FAILED');
}

main().catch(console.error);
