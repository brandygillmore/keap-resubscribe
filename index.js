const express = require('express');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

// ---- Config -------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET_KEY;

// Fail closed: never run with a missing or weak secret
if (!SECRET || SECRET.length < 32) {
  console.error('SECRET_KEY is missing or too short (min 32 chars). Refusing to start.');
  process.exit(1);
}

const FORM_PAGE_URL = 'https://hld555.infusionsoft.app/app/form/web-form-submitted31';

// ---- Helpers ------------------------------------------------------------
// Constant-time comparison (hashing first makes lengths equal)
function secretMatches(provided) {
  if (typeof provided !== 'string' || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(SECRET).digest();
  return crypto.timingSafeEqual(a, b);
}

// Keep customer emails out of logs: jane.doe@gmail.com -> ja***@gmail.com
function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  return `${user.slice(0, 2)}***@${domain || ''}`;
}

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ---- App ----------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.get('/', (req, res) => {
  res.json({ status: 'Keap Resubscribe Service Running' });
});

app.post('/resubscribe', async (req, res) => {
  // Secret accepted from the x-secret header (preferred) or the POST body.
  // Never from the URL query string — URLs end up in logs.
  const provided = req.headers['x-secret'] || (req.body && req.body.secret);
  if (!secretMatches(provided)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const email = String(req.body.email || '').trim();
  const first_name = String(req.body.first_name || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  const masked = maskEmail(email);
  log(`Resubscribing: ${masked}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(FORM_PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#inf_field_Email', { timeout: 10000 });

    await page.type('#inf_field_FirstName', first_name || 'Customer');
    await page.type('#inf_field_Email', email);

    log(`Submitting form for ${masked}...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
      page.click('button[type="submit"]')
    ]);

    const finalUrl = page.url();
    log(`Done for ${masked}. Final URL: ${finalUrl}`);

    return res.json({ success: true, email, final_url: finalUrl });
  } catch (err) {
    // Full detail goes to the logs; the caller gets a generic message
    console.error(`[${new Date().toISOString()}] Error for ${masked}:`, err.message);
    return res.status(500).json({ success: false, error: 'Resubscribe failed' });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  log(`Keap Resubscribe Service listening on port ${PORT}`);
});
