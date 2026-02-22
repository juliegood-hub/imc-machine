#!/usr/bin/env node
// Post this week's 3 events to Instagram and Facebook with Nano Banana posters
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qavrufepvcihklypxbvm.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const FB_PAGE_ID = '522058047815423';
const IG_ACCOUNT_ID = '17841448239949294';

const events = [
  {
    title: 'Comedy Open Mic — Find Your Funny',
    date: 'Sunday, February 22, 2026',
    time: '7:30 PM',
    venue: 'Midtown Meetup, 801 West Russell Place, San Antonio',
    poster: 'https://qavrufepvcihklypxbvm.supabase.co/storage/v1/object/public/media/distribution/comedy-open-mic-poster.png',
    ig: `🎤 Comedy Open Mic tonight at @midtownmeetup! Sign-up at 7:30, show at 8 PM. Hosted by Javi Bazaldua, presented by Heavy City Productions. All levels welcome — find your funny! Free admission.\n\n#SanAntonioComedy #OpenMic #StandUp #MidtownMeetup #LiveComedy #SATX #FindYourFunny #HeavyCityProductions`,
    fb: `🎤 Comedy Open Mic TONIGHT at Midtown Meetup!\n\nSign-up at 7:30 PM, show at 8 PM. Hosted by Javier "Javi" Bazaldua and presented by Heavy City Productions. All skill levels welcome — bring your best material or just come laugh.\n\n📍 Midtown Meetup, 801 West Russell Place, San Antonio\n🎟️ Free admission\n\n#SanAntonioComedy #OpenMic #MidtownMeetup`,
  },
  {
    title: "Karavan Studio's Belly Dance Tuesdays",
    date: 'Tuesday, February 24, 2026',
    time: '7:00 PM',
    venue: 'The Dakota East Side Ice House, 433 S Hackberry St, San Antonio',
    poster: 'https://qavrufepvcihklypxbvm.supabase.co/storage/v1/object/public/media/distribution/karavan-belly-dance-poster.png',
    ig: `💃 Belly Dance Tuesdays this week at @thedakotasa! Karavan Studio's dancers perform freestyle to live music by Isaac & Co. Led by San Antonio belly dance pioneer Karen Barbee.\n\nEvery Tuesday at 7 PM. Free, all ages, dog-friendly patio.\n\n#BellyDance #SanAntonio #TheDakota #LiveMusic #KaravanStudio #EastSide #SATX #FreeLiveMusic`,
    fb: `💃 Karavan Studio's Belly Dance Tuesdays — This Tuesday at The Dakota!\n\nExperience live, improvisational belly dance led by Karen Barbee with soulful grooves by Isaac & Co. Dancers and musicians feed off each other's energy for a one-of-a-kind night.\n\n📍 The Dakota East Side Ice House, 433 S Hackberry St\n🕖 7:00 PM | Free admission | All ages | Dog-friendly patio\n\n#BellyDance #TheDakota #SanAntonio #LiveMusic #KaravanStudio`,
  },
  {
    title: 'Jazz Jam Thursdays at The Dakota',
    date: 'Thursday, February 26, 2026',
    time: '8:00 PM',
    venue: 'The Dakota East Side Ice House, 433 S Hackberry St, San Antonio',
    poster: 'https://qavrufepvcihklypxbvm.supabase.co/storage/v1/object/public/media/distribution/jazz-jam-thursdays-poster.png',
    ig: `🎷 Jazz Jam Thursday at @thedakotasa! Guitarist Toro Flores leads the weekly open jam with Brandon Rivas on bass and Andres Montez on drums. Bring your instrument and sit in.\n\n8 PM to 11 PM. Free. All skill levels.\n\n#JazzJam #SanAntonioJazz #TheDakota #LiveJazz #OpenJam #SATX #EastSide #FreeJazz`,
    fb: `🎷 Jazz Jam Thursdays — This Thursday at The Dakota!\n\nGuitarist Toro Flores hosts the weekly open jam with house band Brandon Rivas (bass) and Andres Montez (drums). Musicians of all levels are welcome to bring instruments and sit in.\n\n📍 The Dakota East Side Ice House, 433 S Hackberry St\n🕗 8:00 PM – 11:00 PM | Free admission | All welcome\n\n#JazzJam #TheDakota #SanAntonioJazz #LiveMusic`,
  }
];

async function getToken(platform) {
  const { data } = await sb.from('app_settings').select('value').eq('key', `oauth_${platform}`).single();
  if (!data) throw new Error(`No ${platform} token found`);
  const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  return val.access_token;
}

async function postFacebook(event, token) {
  // Post photo with message to page
  const url = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: event.poster,
      message: event.fb,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`FB: ${JSON.stringify(data.error)}`);
  console.log(`✅ FB posted: ${event.title} → post_id: ${data.post_id || data.id}`);
  return data;
}

async function postInstagram(event, token) {
  // Step 1: Create container
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: event.poster,
      caption: event.ig,
      access_token: token,
    }),
  });
  const container = await containerRes.json();
  if (container.error) throw new Error(`IG container: ${JSON.stringify(container.error)}`);
  const containerId = container.id;
  console.log(`  IG container created: ${containerId}`);

  // Step 2: Poll until ready
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${token}`);
    const status = await statusRes.json();
    console.log(`  Poll ${i+1}: ${status.status_code}`);
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') throw new Error('IG container processing failed');
  }

  // Step 3: Publish
  const pubRes = await fetch(`https://graph.facebook.com/v19.0/${IG_ACCOUNT_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const pub = await pubRes.json();
  if (pub.error) throw new Error(`IG publish: ${JSON.stringify(pub.error)}`);
  console.log(`✅ IG posted: ${event.title} → media_id: ${pub.id}`);
  return pub;
}

async function main() {
  const fbToken = await getToken('facebook');
  const igToken = await getToken('instagram');
  
  for (const event of events) {
    console.log(`\n📢 ${event.title} (${event.date})`);
    try { await postFacebook(event, fbToken); } catch(e) { console.error(`❌ FB failed: ${e.message}`); }
    try { await postInstagram(event, igToken); } catch(e) { console.error(`❌ IG failed: ${e.message}`); }
  }
  
  console.log('\n🎉 Done! LinkedIn is disconnected — needs OAuth reconnect at imc.goodcreativemedia.com/settings');
}

main().catch(console.error);
