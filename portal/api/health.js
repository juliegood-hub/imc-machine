export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const checks = {
    node: process.version,
    timestamp: new Date().toISOString(),
    env: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
      resendKey: Boolean(process.env.RESEND_API_KEY),
      webhookSecrets: Boolean(process.env.IMC_WEBHOOK_SECRET && process.env.STAFFING_WEBHOOK_SECRET),
    },
  };

  const criticalReady = checks.env.supabaseUrl && checks.env.supabaseAnonKey;

  return res.status(criticalReady ? 200 : 503).json({
    ok: criticalReady,
    service: 'imc-portal',
    checks,
  });
}
