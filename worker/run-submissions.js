#!/usr/bin/env node
const { submitDo210, submitTPR, submitEvvnt } = require('../submit-events.js');

const karavanEvent = {
  title: "Karavan Studio's Belly Dance Tuesdays",
  date: '2026-02-24',
  time: '7:00 PM',
  endTime: '10:00 PM',
  genre: 'Dance',
  venue: 'The Dakota East Side Ice House',
  address: '433 S Hackberry St, San Antonio, TX 78203',
  city: 'San Antonio',
  state: 'TX',
  zip: '78203',
  venuePhone: '210-375-6009',
  venueWebsite: 'https://thedakotasa.com',
  performers: 'Karavan Studio, Isaac & Co',
  description: "Experience the magic of live music and improvisational belly dance every Tuesday at The Dakota East Side Ice House! Led by San Antonio belly dance pioneer Karen Barbee, members of Karavan Studio's Project Band perform dynamic, freestyle belly dance to the soulful, funky sounds of Isaac & Co and other live musicians. This weekly event is part performance and part jam session—dancers and musicians feed off each other's energy to create one-of-a-kind grooves. Come relax on the dog-friendly patio, enjoy drinks and delicious eats, and immerse yourself in East Side vibes. All ages welcome. No cover charge.",
  ticketLink: '',
  free: true,
};

const comedyEvent = {
  title: 'Comedy Open Mic — Find Your Funny',
  date: '2026-02-22',
  time: '7:30 PM',
  endTime: '10:00 PM',
  genre: 'Comedy',
  venue: 'Midtown Meetup',
  address: '',
  city: 'San Antonio',
  state: 'TX',
  performers: 'Javier "Javi" Bazaldua (Host/MC)',
  description: 'Weekly stand-up comedy open mic hosted by Javier "Javi" Bazaldua and presented by Heavy City Productions at Midtown Meetup. Sign-up begins at 7:30 PM, show starts at 8:00 PM. Open to comics of all levels. Free admission. Find Your Funny!',
  ticketLink: '',
  free: true,
};

const platform = process.argv[2] || 'tpr';
const event = process.argv[3] === 'comedy' ? comedyEvent : karavanEvent;

console.log(`\n🚀 Submitting "${event.title}" to ${platform}...\n`);

async function run() {
  let result;
  switch (platform) {
    case 'do210': result = await submitDo210(event); break;
    case 'tpr': result = await submitTPR(event); break;
    case 'evvnt': result = await submitEvvnt(event); break;
    default: console.log('Usage: node run-submissions.js [do210|tpr|evvnt] [comedy|karavan]'); return;
  }
  console.log('\nResult:', JSON.stringify(result, null, 2));
}

run().catch(e => console.error('Fatal:', e.message));
