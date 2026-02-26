#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { runs: 5, graphVersion: process.env.FB_GRAPH_VERSION || 'v25.0', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--runs' && value) args.runs = Number(value);
    if (key === '--graph-version' && value) args.graphVersion = value;
    if (key === '--dry-run') args.dryRun = true;
  }
  if (!Number.isFinite(args.runs) || args.runs < 1) args.runs = 5;
  if (!/^v\d+\.\d+$/i.test(args.graphVersion)) args.graphVersion = 'v25.0';
  return args;
}

function loadEnvFile(filename) {
  const full = path.join(ROOT, filename);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, '').trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const idx = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[idx];
}

function summarizeRuns(runs) {
  const success = runs.filter((r) => r.success).length;
  const durations = runs.map((r) => r.elapsedMs).filter((n) => Number.isFinite(n));
  const failures = runs.filter((r) => !r.success).map((r) => `${r.errorCode || 'n/a'}:${r.errorMessage || 'unknown'}`);
  const failureModes = {};
  for (const key of failures) failureModes[key] = (failureModes[key] || 0) + 1;
  return {
    attempts: runs.length,
    success_count: success,
    success_rate: runs.length ? Number((success / runs.length).toFixed(4)) : 0,
    median_ms: percentile(durations, 50),
    p95_ms: percentile(durations, 95),
    failure_modes: failureModes,
  };
}

function extractGraphError(json) {
  const err = json?.error || {};
  return {
    errorCode: err.code || null,
    errorSubcode: err.error_subcode || null,
    errorType: err.type || null,
    errorMessage: err.message || null,
  };
}

async function graphCall({ graphVersion, token, pathName, params }) {
  const started = Date.now();
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  const elapsedMs = Date.now() - started;
  const ok = res.ok && !json?.error;
  return {
    success: ok,
    statusCode: res.status,
    elapsedMs,
    response: json,
    ...extractGraphError(json),
  };
}

function makeFutureDate(daysOut = 21) {
  const d = new Date();
  d.setDate(d.getDate() + daysOut);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnvFile('.env.production.local');
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'oauth_facebook')
    .single();
  if (error) throw new Error(`Could not load oauth_facebook from app_settings: ${error.message}`);

  const token = data?.value?.access_token;
  const pageId = data?.value?.page_id || process.env.FB_PAGE_ID;
  if (!token || !pageId) throw new Error('Missing Facebook access_token or page_id in oauth_facebook.');

  const now = new Date().toISOString();
  const eventRuns = [];
  const feedRuns = [];
  const createdEventIds = [];
  const createdPostIds = [];
  const futureDate = makeFutureDate(21);

  for (let i = 0; i < args.runs; i += 1) {
    const suffix = `${Date.now()}-${i + 1}`;
    if (!args.dryRun) {
      const eventAttempt = await graphCall({
        graphVersion: args.graphVersion,
        token,
        pathName: `${pageId}/events`,
        params: {
          name: `IMC Probe Event ${suffix}`,
          description: 'Automation probe for IMC Facebook pipeline.',
          start_time: `${futureDate}T20:00:00`,
          end_time: `${futureDate}T23:00:00`,
          timezone: 'America/Chicago',
          location: 'The Dakota East Side Ice House',
          street: '433 S. Hackberry St',
          city: 'San Antonio',
          state: 'TX',
          zip: '78203',
          is_online: 'false',
          privacy_type: 'OPEN',
        },
      });
      if (eventAttempt.success && eventAttempt.response?.id) {
        createdEventIds.push(eventAttempt.response.id);
      }
      eventRuns.push({
        run: i + 1,
        ...eventAttempt,
        id: eventAttempt.response?.id || null,
      });
    } else {
      eventRuns.push({ run: i + 1, success: false, elapsedMs: 0, statusCode: null, dryRun: true });
    }

    if (!args.dryRun) {
      const feedAttempt = await graphCall({
        graphVersion: args.graphVersion,
        token,
        pathName: `${pageId}/feed`,
        params: {
          message: `IMC Probe Post ${suffix} (unpublished)`,
          published: 'false',
        },
      });
      const postId = feedAttempt.response?.id || null;
      if (feedAttempt.success && postId) createdPostIds.push(postId);
      feedRuns.push({
        run: i + 1,
        ...feedAttempt,
        id: postId,
      });
    } else {
      feedRuns.push({ run: i + 1, success: false, elapsedMs: 0, statusCode: null, dryRun: true });
    }
  }

  // Best-effort cleanup for probe artifacts.
  const cleanup = { events_deleted: 0, posts_deleted: 0, failures: [] };
  if (!args.dryRun) {
    for (const eventId of createdEventIds) {
      try {
        const res = await fetch(`https://graph.facebook.com/${args.graphVersion}/${eventId}?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' });
        const json = await res.json().catch(() => ({}));
        if (json === true || json?.success === true) cleanup.events_deleted += 1;
        else cleanup.failures.push({ type: 'event', id: eventId, response: json });
      } catch (err) {
        cleanup.failures.push({ type: 'event', id: eventId, error: err.message });
      }
    }
    for (const postId of createdPostIds) {
      try {
        const res = await fetch(`https://graph.facebook.com/${args.graphVersion}/${postId}?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' });
        const json = await res.json().catch(() => ({}));
        if (json === true || json?.success === true) cleanup.posts_deleted += 1;
        else cleanup.failures.push({ type: 'post', id: postId, response: json });
      } catch (err) {
        cleanup.failures.push({ type: 'post', id: postId, error: err.message });
      }
    }
  }

  const output = {
    timestamp: now,
    graph_version: args.graphVersion,
    page_id: pageId,
    dry_run: args.dryRun,
    runs: args.runs,
    approaches: {
      page_event_create: {
        summary: summarizeRuns(eventRuns),
        attempts: eventRuns,
      },
      page_feed_fallback_post: {
        summary: summarizeRuns(feedRuns),
        attempts: feedRuns,
      },
    },
    cleanup,
  };

  const stamp = now.replace(/[:.]/g, '-');
  const outPath = path.join(ROOT, 'docs', `facebook-event-experiment-results-${stamp}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    output_file: outPath,
    page_event_create: output.approaches.page_event_create.summary,
    page_feed_fallback_post: output.approaches.page_feed_fallback_post.summary,
    cleanup,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
});
