#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const softMode = argv.includes('--soft');

function readArg(name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return '';
  return argv[idx + 1] || '';
}

function parseEnvFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return {};
  const raw = fs.readFileSync(resolved, 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileArg = readArg('--file');
const envFromFile = fileArg ? parseEnvFile(fileArg) : {};

function getEnv(key) {
  const fromProcess = process.env[key];
  if (typeof fromProcess === 'string' && fromProcess.trim()) return fromProcess.trim();
  const fromFile = envFromFile[key];
  if (typeof fromFile === 'string' && fromFile.trim()) return fromFile.trim();
  return '';
}

const groups = [
  {
    name: 'Core Required (production baseline)',
    required: true,
    keys: [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'IMC_WEBHOOK_SECRET',
      'STAFFING_WEBHOOK_SECRET',
      'TIME_CLOCK_QR_SECRET',
    ],
  },
  {
    name: 'Channels + Distribution',
    required: false,
    keys: [
      'EVENTBRITE_TOKEN',
      'EVENTBRITE_ORG_ID',
      'EVENTBRITE_VENUE_ID',
      'META_APP_ID',
      'META_APP_SECRET',
      'FB_PAGE_ID',
      'LINKEDIN_CLIENT_ID',
      'LINKEDIN_CLIENT_SECRET',
      'LINKEDIN_ORG_ID',
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_TOKEN_SECRET',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
    ],
  },
  {
    name: 'Google + YouTube + Drive',
    required: false,
    keys: [
      'GOOGLE_MAPS_API_KEY',
      'GOOGLE_PLACES_API_KEY',
      'GOOGLE_SERVICE_ACCOUNT_KEY',
      'YOUTUBE_CLIENT_ID',
      'YOUTUBE_CLIENT_SECRET',
      'YOUTUBE_REFRESH_TOKEN',
      'ZOOM_WEBHOOK_SECRET',
    ],
  },
  {
    name: 'Platform Ops Tooling',
    required: false,
    keys: [
      'VERCEL_TOKEN',
      'VERCEL_PROJECT_ID',
      'PUBLIC_APP_URL',
      'IMC_PUBLIC_APP_URL',
      'BASE_URL',
      'ADMIN_EMAIL',
    ],
  },
  {
    name: 'Reserved Next Integrations (recommended to provision)',
    required: false,
    keys: [
      'TICKETMASTER_API_KEY',
      'TICKETMASTER_API_SECRET',
      'TICKETMASTER_ACCESS_TOKEN',
      'TICKETMASTER_ACCOUNT_ID',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_CONNECT_CLIENT_ID',
      'HUBSPOT_PRIVATE_APP_TOKEN',
      'HUBSPOT_CLIENT_ID',
      'HUBSPOT_CLIENT_SECRET',
      'SALESFORCE_CLIENT_ID',
      'SALESFORCE_CLIENT_SECRET',
      'SALESFORCE_LOGIN_URL',
    ],
  },
];

function mask(value) {
  if (!value) return '(missing)';
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

let missingRequired = 0;

console.log('\nIMC Environment Audit');
console.log('=====================');
if (fileArg) {
  console.log(`Source file fallback: ${path.resolve(process.cwd(), fileArg)}`);
}
console.log('');

for (const group of groups) {
  console.log(`${group.name}${group.required ? ' [required]' : ''}`);
  for (const key of group.keys) {
    const value = getEnv(key);
    const ok = !!value;
    if (group.required && !ok) missingRequired += 1;
    console.log(`  ${ok ? 'OK  ' : 'MISS'} ${key}${ok ? ` = ${mask(value)}` : ''}`);
  }
  console.log('');
}

if (missingRequired > 0) {
  console.log(`Result: ${missingRequired} required key(s) missing.`);
  if (!softMode) process.exitCode = 1;
} else {
  console.log('Result: required baseline passed.');
}
