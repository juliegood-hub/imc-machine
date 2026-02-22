#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { submitDo210, submitSACurrent, submitEvvnt } = require('../submit-events.js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POLL_INTERVAL = 30000;

async function processPending() {
  const { data: pending } = await supabase
    .from('calendar_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);
  if (!pending?.length) return;

  for (const submission of pending) {
    console.log(`Processing ${submission.id}...`);
    const event = submission.event_data;
    const results = {};
    await supabase.from('calendar_submissions').update({ status: 'processing' }).eq('id', submission.id);

    for (const platform of submission.platforms) {
      try {
        if (platform === 'do210') results.do210 = await submitDo210(event);
        else if (platform === 'sacurrent') results.sacurrent = await submitSACurrent(event);
        else if (platform === 'evvnt') results.evvnt = await submitEvvnt(event);
      } catch (err) {
        results[platform] = { success: false, error: err.message };
      }
    }

    await supabase.from('calendar_submissions').update({
      status: 'completed', results, processed_at: new Date().toISOString()
    }).eq('id', submission.id);
    console.log(`Done ${submission.id}`);
  }
}

async function main() {
  console.log('Calendar worker started');
  while (true) {
    try { await processPending(); } catch (err) { console.error(err.message); }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}
main();
