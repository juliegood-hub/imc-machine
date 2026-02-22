#!/usr/bin/env node
// Send press releases for all 3 events this week via the live API
const API = 'https://imc.goodcreativemedia.com/api/distribute';

const events = [
  {
    id: 'ee9f3386-2cda-4ea8-bdc8-d8443182f8ce',
    title: 'Comedy Open Mic — Find Your Funny',
    date: '2026-02-22',
    time: '19:30',
    venue_name: 'Midtown Meetup',
    venue_address: '801 West Russell Place, San Antonio, TX 78212',
    description: 'Weekly stand-up comedy open mic hosted by Javier "Javi" Bazaldua and presented by Heavy City Productions at Midtown Meetup. Sign-up begins at 7:30 PM, show starts at 8:00 PM. Open to comics of all levels.'
  },
  {
    id: 'f3b42a46-4eba-4532-8aad-dc1a5a3668b8',
    title: "Karavan Studio's Belly Dance Tuesdays",
    date: '2026-02-24',
    time: '19:00',
    venue_name: 'The Dakota East Side Ice House',
    venue_address: '433 S Hackberry St, San Antonio, TX 78203',
    description: 'Experience the magic of live music and improvisational belly dance every Tuesday at The Dakota East Side Ice House! Led by San Antonio belly dance pioneer Karen Barbee with live music by Isaac & Co.'
  },
  {
    id: '383fe751-be28-4056-b209-8112167fc087',
    title: 'Jazz Jam Thursdays at The Dakota',
    date: '2026-02-26',
    time: '20:00',
    venue_name: 'The Dakota East Side Ice House',
    venue_address: '433 S Hackberry St, San Antonio, TX 78203',
    description: 'Join guitarist Toro Flores for Jazz Jam Thursdays at The Dakota East Side Ice House. Weekly open jam with house band Brandon Rivas (bass) and Andres Montez (drums). 8 PM to 11 PM. Free admission.'
  }
];

async function sendPress(event) {
  console.log(`\n📰 Sending press: ${event.title}`);
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send-press-release',
      event,
      venue: { name: event.venue_name, address: event.venue_address },
      content: event.description
    })
  });
  const data = await res.json();
  if (data.success) {
    console.log(`✅ Sent to ${data.sent}/${data.total} contacts`);
    if (data.results) {
      data.results.forEach(r => {
        console.log(`  ${r.success ? '✅' : '❌'} ${r.outlet || r.email}: ${r.success ? r.id : r.error}`);
      });
    }
  } else {
    console.error(`❌ Failed: ${data.error}`);
  }
}

async function main() {
  for (const event of events) {
    await sendPress(event);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n🎉 All press releases sent!');
}

main().catch(console.error);
