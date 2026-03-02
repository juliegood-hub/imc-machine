const baseUrlInput = process.argv[2] || process.env.SMOKE_BASE_URL || 'https://imc.goodcreativemedia.com';
const baseUrl = baseUrlInput.replace(/\/$/, '');

const checks = [
  {
    name: 'homepage',
    url: `${baseUrl}/`,
    expectedStatus: 200,
    assert: async (response) => {
      const html = await response.text();
      if (!/IMC|THE IMC MACHINE|GOOD CREATIVE MEDIA/i.test(html)) {
        throw new Error('Homepage loaded but expected IMC branding text was not found.');
      }
    },
  },
  {
    name: 'search-endpoint',
    url: `${baseUrl}/api/search?q=timeline&scope=all`,
    expectedStatus: 200,
    assert: async (response) => {
      const payload = await response.json();
      if (!payload || typeof payload !== 'object') {
        throw new Error('Search endpoint did not return JSON object.');
      }
      if (!('success' in payload)) {
        throw new Error('Search payload missing success field.');
      }
    },
  },
  {
    name: 'send-email-method-guard',
    url: `${baseUrl}/api/send-email`,
    expectedStatus: 405,
    assert: async (response) => {
      const payload = await response.json();
      if (!payload || typeof payload !== 'object') {
        throw new Error('send-email guard did not return JSON payload.');
      }
      if (!String(payload.error || '').toLowerCase().includes('post')) {
        throw new Error('send-email guard did not return expected method guidance.');
      }
    },
  },
];

async function runCheck(check) {
  const startedAt = Date.now();
  const response = await fetch(check.url, {
    method: 'GET',
    headers: {
      'user-agent': 'imc-smoke-check/1.0',
      accept: 'application/json,text/html,*/*',
    },
  });

  if (response.status !== check.expectedStatus) {
    const bodyPreview = await response.text();
    throw new Error(
      `${check.name} expected ${check.expectedStatus}, got ${response.status}. Body: ${bodyPreview.slice(0, 240)}`,
    );
  }

  await check.assert(response);
  return Date.now() - startedAt;
}

(async () => {
  const failures = [];

  for (const check of checks) {
    try {
      const durationMs = await runCheck(check);
      console.log(`PASS ${check.name} (${durationMs}ms) -> ${check.url}`);
    } catch (error) {
      failures.push({ name: check.name, message: error.message, url: check.url });
      console.error(`FAIL ${check.name} -> ${check.url}`);
      console.error(error.message);
    }
  }

  if (failures.length > 0) {
    console.error(`Smoke check failed: ${failures.length} check(s) failed.`);
    process.exit(1);
  }

  console.log('Smoke check passed: all checks healthy.');
})();
