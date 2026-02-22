import { parseLocalDate } from '../lib/dateUtils.js';
// ═══════════════════════════════════════════════════════════════
// IMC Machine — Bilingual Content Service (Client-Side)
// All API calls routed through /api/generate and /api/distribute
// NO API keys in client code
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// TRANSLATE TO SPANISH — Cultural translation, not literal
// ═══════════════════════════════════════════════════════════════

export async function translateToSpanish(englishContent, contentType = 'press') {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'translate',
      text: englishContent,
      contentType,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Translation failed');
  return { text: data.translation, engine: data.engine };
}

// ═══════════════════════════════════════════════════════════════
// GENERATE BILINGUAL CONTENT SET
// ═══════════════════════════════════════════════════════════════

export async function generateBilingualSet(generatedContent) {
  const results = {};
  const translatable = ['press', 'calendar', 'social', 'email'];
  
  for (const key of translatable) {
    if (!generatedContent[key]) continue;
    try {
      const spanish = await translateToSpanish(generatedContent[key], key);
      results[key] = { english: generatedContent[key], spanish: spanish.text, engine: spanish.engine };
    } catch (err) {
      console.error(`[Bilingual] Failed to translate ${key}:`, err.message);
      results[key] = { english: generatedContent[key], spanish: null, error: err.message };
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// SEND BILINGUAL PRESS RELEASE TO LA PRENSA
// ═══════════════════════════════════════════════════════════════

export async function sendToLaPrensa(event, venue, spanishPressRelease) {
  if (!spanishPressRelease) return { status: 'skipped' };
  
  const subject = `Nota de Prensa: ${event.title} en ${venue?.name || 'San Antonio'} · ${parseLocalDate(event.date).toLocaleDateString('es-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  
  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.7; max-width: 680px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #c8a45e; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-family: 'Playfair Display', Georgia, serif; color: #0d1b2a; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
    .header p { color: #666; font-size: 12px; margin: 4px 0 0; }
    .press-release { white-space: pre-wrap; font-size: 15px; }
    .footer { border-top: 1px solid #ddd; padding-top: 16px; margin-top: 32px; font-size: 12px; color: #888; }
    .footer a { color: #c8a45e; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${venue?.name || 'Good Creative Media'}</h1>
    <p>Nota de Prensa: Para Distribución Inmediata</p>
  </div>
  <div class="press-release">${spanishPressRelease.replace(/\n/g, '<br>')}</div>
  <div class="footer">
    <p><strong>Contacto de Prensa:</strong> Good Creative Media<br>
    Email: thisisthegoodlife@juliegood.com<br>
    Web: <a href="https://goodcreativemedia.com">goodcreativemedia.com</a></p>
    <p style="font-size:11px;color:#999">Distribución por The IMC Machine · Good Creative Media, San Antonio TX</p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch('/api/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-email',
        to: 'editor@laprensatexas.com',
        subject,
        html: htmlBody,
        from: 'Good Creative Media <events@goodcreativemedia.com>',
        replyTo: 'thisisthegoodlife@juliegood.com',
      }),
    });
    const data = await res.json();
    return { to: 'editor@laprensatexas.com', status: data.success ? 'sent' : 'failed', id: data.emailId };
  } catch (err) {
    return { to: 'editor@laprensatexas.com', status: 'failed', error: err.message };
  }
}
