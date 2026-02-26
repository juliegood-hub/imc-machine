// Vercel Serverless Function — Send email via Resend API

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Send this endpoint a POST request and I can send it.' });

  const { to, toName, from, fromName, subject, html, replyTo } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'I need `to`, `subject`, and `html` before I can send this email.' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return res.status(500).json({ error: 'I need RESEND_API_KEY before I can send email from here.' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <onboarding@resend.dev>` : 'IMC Machine <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        reply_to: replyTo || 'thisisthegoodlife@juliegood.com',
      }),
    });

    const data = await response.json();

    if (data.id) {
      return res.status(200).json({ success: true, id: data.id, message: `Perfect. I sent that email to ${to}.` });
    } else {
      return res.status(400).json({ success: false, error: data.message || 'I could not send that email yet.' });
    }
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
