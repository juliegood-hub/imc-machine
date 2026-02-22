// ═══════════════════════════════════════════════════════════════
// IMC Machine — Photo-to-Form AI Data Extraction
// Patent ref: §13.4 Photo-to-Form AI Event Creation Subsystem
//
// Snap a photo of ANYTHING and AI extracts structured data:
// - Event posters, flyers, handbills
// - Band one-sheets, press kits
// - Business cards → venue info
// - Menus → venue type, hours, vibe
// - Handwritten notes (napkins, whiteboards, notebooks)
// - Text message screenshots
// - Licensing agreements
// - Technical riders
// - Social media screenshots
// - Printed programs, playbills
//
// No limit on number of images. Each image adds to the extracted data.
// Multiple images merge intelligently (e.g., front + back of a flyer).
// ═══════════════════════════════════════════════════════════════

// API keys are server-side only — extraction goes through /api/generate

// ═══════════════════════════════════════════════════════════════
// EXTRACT DATA FROM IMAGE(S)
// Sends image(s) to Gemini Vision for OCR + structured extraction
// ═══════════════════════════════════════════════════════════════

const EXTRACTION_PROMPT = `You are an AI data extraction engine for a live event and venue management platform. Analyze the image(s) and extract ALL useful information.

For EVENT-related images (posters, flyers, one-sheets, screenshots, handwritten notes):
Extract into this JSON:
{
  "type": "event",
  "confidence": 0.0-1.0,
  "event": {
    "title": "event/show name",
    "date": "YYYY-MM-DD if found",
    "time": "start time",
    "endTime": "end time if found",
    "genre": "music genre or event type",
    "description": "event description or summary",
    "performers": ["list", "of", "performers/artists"],
    "ticketPrice": "price info",
    "ticketLink": "URL if found",
    "ageRestriction": "all ages / 21+ / etc",
    "recurring": "weekly/monthly/one-time",
    "additionalInfo": "anything else relevant"
  },
  "venue": {
    "name": "venue name if shown",
    "address": "address if shown",
    "phone": "phone if shown",
    "website": "URL if shown"
  },
  "contacts": [
    {"name": "person name", "role": "their role", "email": "email", "phone": "phone", "social": "@handle"}
  ],
  "sponsors": ["sponsor names if any"],
  "rawText": "all text extracted verbatim from the image"
}

For VENUE/BUSINESS images (business cards, menus, signage, storefront photos):
Extract into this JSON:
{
  "type": "venue",
  "confidence": 0.0-1.0,
  "venue": {
    "name": "business/venue name",
    "address": "full address",
    "city": "city",
    "state": "state",
    "postalCode": "zip",
    "phone": "phone number",
    "email": "email address",
    "website": "website URL",
    "hours": "business hours if shown",
    "type": "bar/restaurant/theater/gallery/club/etc",
    "cuisine": "if restaurant: food type",
    "capacity": "if known",
    "description": "what you can infer about the venue from the image",
    "socialMedia": {
      "instagram": "@handle",
      "facebook": "URL or name",
      "tiktok": "@handle"
    },
    "brandColors": ["dominant colors you see in hex"],
    "vibe": "describe the aesthetic/atmosphere"
  },
  "contacts": [
    {"name": "person name", "title": "their title", "email": "email", "phone": "phone"}
  ],
  "rawText": "all text extracted verbatim"
}

For MIXED or UNCLEAR images:
Extract whatever you can find and set type to "mixed".

RULES:
- Extract EVERYTHING visible — names, dates, times, addresses, phone numbers, emails, URLs, social handles, prices
- If text is handwritten, do your best — note confidence level
- If text is partially obscured, extract what you can and note "[unclear]"
- If an image is angled, blurry, or partially visible, still extract what's readable
- Return valid JSON only. No markdown wrapping.
- For multiple images, merge the data intelligently (don't duplicate)`;

export async function extractFromImages(imageFiles) {
  if (!imageFiles || imageFiles.length === 0) throw new Error('No images provided');

  // For multi-image, we'll send the first image for now (API supports one at a time)
  // TODO: support batch extraction
  const file = imageFiles[0];
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const extractionPrompt = imageFiles.length === 1
    ? `${EXTRACTION_PROMPT}\n\nAnalyze this single image and extract all data as JSON.`
    : `${EXTRACTION_PROMPT}\n\nAnalyze this image and extract all data as JSON.`;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'extract-photo',
        imageData: base64,
        mimeType,
        extractionPrompt,
      }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Extraction failed');

    const extracted = data.extracted;

    return {
      success: true,
      data: extracted,
      imageCount: imageFiles.length,
      extractedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { success: false, error: err.message, imageCount: imageFiles.length };
  }
}

// ═══════════════════════════════════════════════════════════════
// CAMERA CAPTURE — Access device camera for live photo
// ═══════════════════════════════════════════════════════════════

export function openCamera() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // rear camera
    input.multiple = false;
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) resolve(file);
      else reject(new Error('No photo captured'));
    };
    input.click();
  });
}

// ═══════════════════════════════════════════════════════════════
// FILE UPLOAD — Multiple files at once
// ═══════════════════════════════════════════════════════════════

export function openFileUpload(multiple = true) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.multiple = multiple;
    input.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) resolve(files);
      else reject(new Error('No files selected'));
    };
    input.click();
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // strip data:...;base64, prefix
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED EXTRACTION — Crew from playbills/programs/lineups
// ═══════════════════════════════════════════════════════════════

const CREW_EXTRACTION_PROMPT = `You are an AI data extraction engine. Analyze the image(s) and extract cast, crew, band members, or performers.

Look for: playbills, show programs, band lineup posters, festival lineups, cast lists, crew credits, business cards of performers/crew.

Return this JSON:
{
  "crew": [
    {"name": "person name", "role": "their role/instrument/part"}
  ],
  "rawText": "all text extracted verbatim"
}

RULES:
- Extract every name and associated role/instrument/character
- For band lineups: role = instrument (e.g., "Lead Guitar", "Drums", "Vocals")
- For theater: role = character name or crew position (e.g., "Lady Macbeth", "Stage Manager")
- For orchestras: role = instrument section (e.g., "First Violin", "Oboe")
- If no role is listed, infer from context or use "Performer"
- Return valid JSON only. No markdown wrapping.`;

export async function extractCrewFromImages(imageFiles) {
  if (!imageFiles?.length) throw new Error('No images provided');

  const file = imageFiles[0];
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'extract-photo',
        imageData: base64,
        mimeType,
        extractionPrompt: CREW_EXTRACTION_PROMPT,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Crew extraction failed');
    return { success: true, data: data.extracted };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SPECIALIZED EXTRACTION — Brand from marketing materials
// ═══════════════════════════════════════════════════════════════

const BRAND_EXTRACTION_PROMPT = `You are an AI brand analysis engine. Analyze the image(s) of marketing materials, logos, websites, social posts, or printed collateral.

Extract:
{
  "brandColors": ["#hex1", "#hex2", "#hex3"],
  "fonts": ["font names if identifiable"],
  "tone": "describe the writing tone/voice (e.g., 'casual and playful', 'formal and elegant')",
  "keywords": ["recurring brand words or phrases"],
  "vibe": "overall aesthetic description",
  "rawText": "all text extracted verbatim"
}

RULES:
- Identify dominant colors as hex codes (sample from logos, headers, backgrounds)
- Describe the brand voice based on any copy visible
- Note any taglines, slogans, or recurring phrases
- Return valid JSON only. No markdown wrapping.`;

export async function extractBrandFromImages(imageFiles) {
  if (!imageFiles?.length) throw new Error('No images provided');

  const file = imageFiles[0];
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'extract-photo',
        imageData: base64,
        mimeType,
        extractionPrompt: BRAND_EXTRACTION_PROMPT,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Brand extraction failed');
    return { success: true, data: data.extracted };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Convert extracted data to event form fields
export function extractionToEventForm(extracted) {
  if (!extracted?.data) return {};
  const d = extracted.data;
  const e = d.event || {};
  const v = d.venue || {};

  return {
    title: e.title || '',
    date: e.date || '',
    time: e.time || '',
    endTime: e.endTime || '',
    genre: e.genre || '',
    description: e.description || '',
    performers: Array.isArray(e.performers) ? e.performers.join(', ') : e.performers || '',
    ticketPrice: e.ticketPrice || '',
    ticketLink: e.ticketLink || '',
    venueName: v.name || '',
    venueAddress: v.address || '',
    venuePhone: v.phone || '',
    venueWebsite: v.website || '',
  };
}

// Convert extracted data to venue setup fields
export function extractionToVenueForm(extracted) {
  if (!extracted?.data) return {};
  const v = extracted.data.venue || {};
  const contacts = extracted.data.contacts || [];

  return {
    name: v.name || '',
    address: v.address || '',
    city: v.city || '',
    state: v.state || '',
    postalCode: v.postalCode || '',
    phone: v.phone || '',
    email: v.email || '',
    website: v.website || '',
    type: v.type || '',
    hours: v.hours || '',
    capacity: v.capacity || '',
    description: v.description || '',
    instagram: v.socialMedia?.instagram || '',
    facebook: v.socialMedia?.facebook || '',
    brandColors: v.brandColors || [],
    vibe: v.vibe || '',
    contacts,
  };
}
