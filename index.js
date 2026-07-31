// ============================================================
//  Qoder Sign — Auto Login/Logout Qoder CLI via Google SSO
//  Pendekatan A: Jalankan qodercli login → capture URL → buka browser
//  Anti-banned: Stealth + Random delays + Human behavior
// ============================================================

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

// ─── STEALTH ────────────────────────────────────────────────────────
puppeteer.use(StealthPlugin());

// ─── CONFIG ─────────────────────────────────────────────────────────
const CONFIG = {
  // Files
  ACCOUNTS_FILE:    path.join(__dirname, 'accounts.txt'),
  DONE_FILE:        path.join(__dirname, 'done_accounts.txt'),
  RESULTS_DIR:      path.join(__dirname, 'results'),

  // Browser - Anti-banned settings
  HEADLESS:         false,    // false = visible (WAJIB untuk handle captcha/HP prompt)
  SLOW_MO:          50,       // ms delay antar aksi (lebih natural)
  DELAY_BETWEEN:    8000,     // ms delay antar akun (8 detik)
  
  // Timeouts
  GOOGLE_TIMEOUT:   120000,   // ms max tunggu Google login flow (2 menit)
  HP_PROMPT_WAIT:   120000,   // ms max tunggu user klik OK di HP (2 menit)
  NAV_TIMEOUT:      30000,    // ms max tunggu navigasi
  QODERCLI_TIMEOUT: 180000,   // ms max tunggu qodercli login selesai (3 menit)
  
  // Anti-banned: Randomization
  RANDOM_DELAY_MIN: 1000,     // ms min random delay
  RANDOM_DELAY_MAX: 3000,     // ms max random delay
  TYPING_DELAY_MIN: 30,       // ms min typing delay
  TYPING_DELAY_MAX: 80,       // ms max typing delay
};

// ─── USER AGENTS (Rotation) ─────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
];

// ─── COLORS ─────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
};

const log = {
  info:   (m) => console.log(`${C.cyan}[INFO]${C.reset}  ${m}`),
  ok:     (m) => console.log(`${C.green}[ OK ]${C.reset}  ${m}`),
  warn:   (m) => console.log(`${C.yellow}[WARN]${C.reset}  ${m}`),
  error:  (m) => console.log(`${C.red}[ERR ]${C.reset}  ${m}`),
  step:   (m) => console.log(`${C.gray}  → ${m}${C.reset}`),
  header: (m) => console.log(`\n${C.bold}${C.cyan}${'═'.repeat(55)}\n  ${m}\n${'═'.repeat(55)}${C.reset}`),
};

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomDelay(min = CONFIG.RANDOM_DELAY_MIN, max = CONFIG.RANDOM_DELAY_MAX) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

function randomTypingDelay() {
  return Math.floor(Math.random() * (CONFIG.TYPING_DELAY_MAX - CONFIG.TYPING_DELAY_MIN + 1)) + CONFIG.TYPING_DELAY_MIN;
}

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function humanLikeScroll(page) {
  const scrollAmount = Math.floor(Math.random() * 300) + 100;
  await page.evaluate((amount) => {
    window.scrollBy(0, amount);
  }, scrollAmount);
  await randomDelay(500, 1500);
}

async function humanLikeMouseMovement(page) {
  const x = Math.floor(Math.random() * 800) + 100;
  const y = Math.floor(Math.random() * 600) + 100;
  await page.mouse.move(x, y);
  await randomDelay(300, 800);
}

// ─── SYSTEM CHROME DETECTION ────────────────────────────────────────
function findSystemChrome() {
  const platform = os.platform();
  const candidates = [];

  if (platform === 'win32') {
    const programFiles = [
      process.env['PROGRAMFILES']     || 'C:\\Program Files',
      process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)',
      process.env['LOCALAPPDATA']     || path.join(os.homedir(), 'AppData', 'Local'),
    ];
    candidates.push(
      path.join(programFiles[0], 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles[1], 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles[2], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    );
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      log.ok(`System Chrome found: ${p}`);
      return p;
    }
  }
  return null;
}

// ─── ACCOUNTS FILE MANAGEMENT ───────────────────────────────────────
function loadAccounts() {
  if (!fs.existsSync(CONFIG.ACCOUNTS_FILE)) {
    log.error(`accounts.txt tidak ditemukan: ${CONFIG.ACCOUNTS_FILE}`);
    log.info('Buat file accounts.txt dengan format: email@gmail.com:password');
    process.exit(1);
  }

  const lines = fs.readFileSync(CONFIG.ACCOUNTS_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim().replace(/\r$/, ''))
    .filter(l => l && !l.startsWith('#'));

  const accounts = [];
  for (const line of lines) {
    const sep = line.indexOf(':');
    if (sep === -1) {
      log.warn(`Skip baris tidak valid (format email:password): ${line}`);
      continue;
    }
    accounts.push({
      raw:      line,
      email:    line.slice(0, sep).trim(),
      password: line.slice(sep + 1).trim(),
    });
  }
  return accounts;
}

function moveToDone(account) {
  fs.appendFileSync(CONFIG.DONE_FILE, account.raw + '\n', 'utf8');

  const lines = fs.readFileSync(CONFIG.ACCOUNTS_FILE, 'utf8')
    .split('\n')
    .filter(l => l.trim() !== account.raw);
  fs.writeFileSync(CONFIG.ACCOUNTS_FILE, lines.join('\n'), 'utf8');

  log.ok(`Dipindahkan ke done_accounts.txt`);
}

// ─── QODERCLI LOGIN (Spawn Process) ─────────────────────────────────
async function startQoderCliLogin() {
  log.info('Starting qodercli login process...');
  
  return new Promise((resolve, reject) => {
    // Use npx to run locally installed qodercli (non-admin mode)
    const proc = spawn('npx', ['qodercli', 'login'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: os.platform() === 'win32',
    });

    let output = '';
    let loginUrl = null;

    // Capture stdout
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      log.step(`qodercli: ${text.trim()}`);

      // Look for URL in output
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch && !loginUrl) {
        loginUrl = urlMatch[0];
        log.ok(`Login URL captured: ${loginUrl.slice(0, 80)}...`);
      }
    });

    // Capture stderr
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      log.step(`qodercli (stderr): ${text.trim()}`);

      // Look for URL in stderr too
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch && !loginUrl) {
        loginUrl = urlMatch[0];
        log.ok(`Login URL captured: ${loginUrl.slice(0, 80)}...`);
      }
    });

    // Process exit
    proc.on('close', (code) => {
      if (code === 0) {
        log.ok('qodercli login completed successfully');
        resolve({ success: true, url: loginUrl, output });
      } else {
        log.error(`qodercli exited with code ${code}`);
        resolve({ success: false, url: loginUrl, output, code });
      }
    });

    // Process error
    proc.on('error', (err) => {
      log.error(`Failed to start qodercli: ${err.message}`);
      reject(err);
    });

    // Timeout: wait for URL or timeout
    const timeout = setTimeout(() => {
      if (!loginUrl) {
        log.warn('Timeout waiting for login URL from qodercli');
        proc.kill();
        reject(new Error('Timeout waiting for login URL'));
      }
    }, 10000);

    // Clear timeout if we got URL
    const checkUrl = setInterval(() => {
      if (loginUrl) {
        clearTimeout(timeout);
        clearInterval(checkUrl);
        resolve({ success: true, url: loginUrl, output, process: proc });
      }
    }, 500);
  });
}

// ─── QODERCLI LOGOUT ────────────────────────────────────────────────
function logoutFromQoderCLI() {
  log.info('Logging out from Qoder CLI...');
  
  try {
    // Use npx to run locally installed qodercli (non-admin mode)
    execSync('npx qodercli logout', { 
      stdio: 'pipe', 
      timeout: 10000,
      windowsHide: true 
    });
    log.ok('qodercli logout executed successfully');
    return true;
  } catch (err) {
    if (err.stderr && err.stderr.toString().includes('not logged in')) {
      log.step('qodercli was not logged in (already logged out)');
      return true;
    }
    log.warn(`qodercli logout failed: ${err.message}`);
    return false;
  }
}

// ─── GOOGLE SSO HANDLER ─────────────────────────────────────────────
async function handleGoogleLogin(page, email, password) {
  log.step('Waiting for Google login page...');

  try {
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: CONFIG.NAV_TIMEOUT });
  } catch (_) {}

  await randomDelay(1500, 2500);
  const url = page.url();
  log.step(`Current URL: ${url.slice(0, 80)}`);

  await humanLikeMouseMovement(page);

  // ── EMAIL STEP ──────────────────────────────────────────────────
  const emailInput = await page.waitForSelector(
    'input#identifierId, input[type="email"]',
    { visible: true, timeout: 15000 }
  ).catch(() => null);

  if (!emailInput) {
    log.warn('Email input not found — might be captcha or already logged in');
    log.warn(`Waiting ${CONFIG.HP_PROMPT_WAIT / 1000}s for manual resolution...`);
    await page.waitForSelector('input#identifierId', { visible: true, timeout: CONFIG.HP_PROMPT_WAIT }).catch(() => null);
  }

  if (await page.$('input#identifierId')) {
    log.step(`Filling email: ${email}`);
    
    await page.click('input#identifierId');
    await randomDelay(300, 600);
    await page.type('input#identifierId', email, { delay: randomTypingDelay() });
    await randomDelay(500, 1000);

    await humanLikeMouseMovement(page);
    
    await page.click('#identifierNext button').catch(() => {
      page.keyboard.press('Enter');
    });
    await randomDelay(2000, 3000);
  }

  // ── PASSWORD STEP ───────────────────────────────────────────────
  const pwdInput = await page.waitForSelector(
    'input[name="Passwd"], input[type="password"]',
    { visible: true, timeout: 15000 }
  ).catch(() => null);

  if (!pwdInput) {
    log.warn('Password input not found');
    log.warn(`Waiting ${CONFIG.HP_PROMPT_WAIT / 1000}s for manual resolution (captcha?)...`);

    await Promise.race([
      page.waitForSelector('input[name="Passwd"]', { visible: true, timeout: CONFIG.HP_PROMPT_WAIT }),
      page.waitForNavigation({ timeout: CONFIG.HP_PROMPT_WAIT }),
    ]).catch(() => null);
  }

  if (await page.$('input[name="Passwd"]')) {
    log.step('Filling password...');
    
    await page.click('input[name="Passwd"]');
    await randomDelay(300, 600);
    await page.type('input[name="Passwd"]', password, { delay: randomTypingDelay() });
    await randomDelay(500, 1000);

    await humanLikeScroll(page);
    await humanLikeMouseMovement(page);
    
    await page.click('#passwordNext button').catch(() => {
      page.keyboard.press('Enter');
    });
    await randomDelay(2500, 3500);
  }

  // ── HP VERIFICATION / CONSENT / CHALLENGE ───────────────────────
  log.step('Waiting for verification / consent / redirect...');
  log.warn('⚠️  Jika ada verifikasi di HP, klik OK di HP kamu sekarang!');
  log.warn(`⚠️  Waktu tunggu: ${CONFIG.HP_PROMPT_WAIT / 1000} detik`);

  const maxWait = CONFIG.GOOGLE_TIMEOUT;
  const pollInterval = 2000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    const currentUrl = page.url();

    // Check if we're back on Qoder (login success)
    if (currentUrl.includes('qoder.com') || currentUrl.includes('qoder.sh')) {
      log.ok('Redirected back to Qoder!');
      return true;
    }

    // Handle "I understand" / "Saya mengerti" speedbump
    const understandBtn = await page.$(
      'button:has-text("I understand"), button:has-text("Saya mengerti")'
    );
    if (understandBtn) {
      log.step('Clicking "I understand" speedbump...');
      await humanLikeMouseMovement(page);
      await understandBtn.click();
      await randomDelay(2000, 3000);
    }

    // Handle consent (Lanjutkan / Continue / Allow)
    const consentBtn = await page.$(
      'button:has-text("Lanjutkan"), button:has-text("Continue"), ' +
      'button:has-text("Allow"), button:has-text("Izinkan"), ' +
      '#submit_approve_access'
    );
    if (consentBtn) {
      log.step('Clicking consent button...');
      await humanLikeMouseMovement(page);
      await consentBtn.click();
      await randomDelay(3000, 4000);
    }

    // Handle "Advanced" → "Go to" (unverified app)
    const advancedBtn = await page.$(
      'a:has-text("Advanced"), a:has-text("Lanjutan")'
    );
    if (advancedBtn) {
      log.step('Clicking Advanced...');
      await humanLikeMouseMovement(page);
      await advancedBtn.click();
      await randomDelay(1500, 2500);
      const goToBtn = await page.$(
        'a:has-text("Go to"), a:has-text("unsafe"), a:has-text("proceed")'
      );
      if (goToBtn) {
        log.step('Clicking Go to...');
        await humanLikeMouseMovement(page);
        await goToBtn.click();
        await randomDelay(2000, 3000);
      }
    }

    // Handle security challenge / HP verification
    const heading = await page.$eval('h1, [role="heading"]', el => el.textContent?.trim()).catch(() => '');
    if (heading && (
      heading.includes('Verify') || heading.includes('verify') ||
      heading.includes('2-Step') || heading.includes('Verifikasi') ||
      heading.includes('Confirm') || heading.includes('Konfirmasi')
    )) {
      log.warn(`🔐 Security challenge / HP verification: "${heading}"`);
      log.warn(`⚠️  Klik OK di HP kamu sekarang! Waktu tunggu: ${CONFIG.HP_PROMPT_WAIT / 1000} detik...`);

      try {
        await page.waitForNavigation({ timeout: CONFIG.HP_PROMPT_WAIT });
        log.ok('Verification completed!');
      } catch (_) {
        log.error('Timeout waiting for HP verification');
      }
      continue;
    }

    await sleep(pollInterval);
    elapsed += pollInterval;
  }

  log.error('Timeout waiting for Google login to complete');
  return false;
}

// ─── PROCESS SINGLE ACCOUNT ─────────────────────────────────────────
async function processAccount(account, idx, total) {
  const { email, password } = account;
  log.header(`[${idx}/${total}] ${email}`);

  let browser = null;
  let qodercliProc = null;

  try {
    // ── 1. Start qodercli login ───────────────────────────────────
    const qoderResult = await startQoderCliLogin();
    
    if (!qoderResult.url) {
      throw new Error('Failed to get login URL from qodercli');
    }

    qodercliProc = qoderResult.process;
    const loginUrl = qoderResult.url;

    log.ok(`Login URL: ${loginUrl.slice(0, 80)}...`);

    // ── 2. Launch browser (incognito) ─────────────────────────────
    const chromePath = findSystemChrome();
    if (!chromePath) {
      throw new Error('Google Chrome not found');
    }

    browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
      slowMo: CONFIG.SLOW_MO,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--start-maximized',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--incognito',  // Force incognito mode
      ],
    });

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    
    const userAgent = randomUserAgent();
    await page.setUserAgent(userAgent);
    
    const viewportWidth = 1280 + Math.floor(Math.random() * 200) - 100;
    const viewportHeight = 800 + Math.floor(Math.random() * 100) - 50;
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1 + Math.random() * 0.5,
    });

    // ── 3. Navigate to login URL ──────────────────────────────────
    log.info('Opening login URL in browser...');
    await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.NAV_TIMEOUT,
    });
    await page.waitForLoadState('networkidle2').catch(() => {});
    await randomDelay(2000, 3000);

    await humanLikeScroll(page);
    await humanLikeMouseMovement(page);

    // ── 4. Click Google SSO button ────────────────────────────────
    log.step('Looking for Google SSO button...');

    const googleSelectors = [
      'button:has-text("Google")',
      'a:has-text("Google")',
      '[class*="google" i]',
      'button:has-text("Sign in with Google")',
      'span:has-text("Google")',
      '[data-provider="google"]',
    ];

    let googleBtn = null;
    for (const sel of googleSelectors) {
      googleBtn = await page.$(sel);
      if (googleBtn) {
        const isVisible = await googleBtn.isIntersectingViewport();
        if (isVisible) break;
        googleBtn = null;
      }
    }

    if (!googleBtn) {
      googleBtn = await page.evaluateHandle(() => {
        const els = document.querySelectorAll('button, a, div[role="button"], span');
        for (const el of els) {
          const txt = (el.textContent || '').toLowerCase();
          if (txt.includes('google')) return el;
        }
        return null;
      });
    }

    if (!googleBtn || !await googleBtn.asElement()) {
      await page.screenshot({ path: path.join(CONFIG.RESULTS_DIR, `${email.replace(/[@.]/g, '_')}_no_google_btn.png`) });
      throw new Error('Google SSO button not found');
    }

    log.step('Clicking Google SSO...');
    await humanLikeMouseMovement(page);
    await googleBtn.asElement().click();
    await randomDelay(2000, 3000);

    // ── 5. Handle Google login ────────────────────────────────────
    log.info('Handling Google login...');
    const loginOk = await handleGoogleLogin(page, email, password);

    if (!loginOk) {
      await page.screenshot({ path: path.join(CONFIG.RESULTS_DIR, `${email.replace(/[@.]/g, '_')}_login_fail.png`) });
      throw new Error('Google login failed or timed out');
    }

    // ── 6. Wait for qodercli to complete ──────────────────────────
    log.info('Waiting for qodercli to complete login...');
    
    if (qodercliProc) {
      // Wait for qodercli process to exit
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          log.warn('Timeout waiting for qodercli to complete');
          qodercliProc.kill();
          resolve();
        }, CONFIG.QODERCLI_TIMEOUT);

        qodercliProc.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0) {
            log.ok('qodercli login completed!');
          } else {
            log.warn(`qodercli exited with code ${code}`);
          }
          resolve();
        });
      });
    }

    await randomDelay(2000, 3000);

    log.ok(`✓ ${email} — LOGIN SUCCESS`);

    // ── 7. Logout from Qoder CLI ──────────────────────────────────
    await randomDelay(2000, 3000);
    const logoutOk = logoutFromQoderCLI();

    if (logoutOk) {
      log.ok(`✓ ${email} — LOGOUT SUCCESS (via qodercli)`);
    } else {
      log.warn(`⚠ ${email} — Logout failed, but login was successful`);
    }

    // ── 8. Save result ────────────────────────────────────────────
    const resultFile = path.join(CONFIG.RESULTS_DIR, `${email.replace(/[@.]/g, '_')}.json`);
    fs.writeFileSync(resultFile, JSON.stringify({
      email,
      status: 'SUCCESS',
      login: true,
      logout: logoutOk,
      timestamp: new Date().toISOString(),
    }, null, 2));

    // ── 9. Move to done ───────────────────────────────────────────
    moveToDone(account);

    return { success: true, email };

  } catch (err) {
    log.error(`${email} — FAILED: ${err.message}`);
    
    if (browser) {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({
          path: path.join(CONFIG.RESULTS_DIR, `${email.replace(/[@.]/g, '_')}_error.png`)
        }).catch(() => {});
      }
    }

    const resultFile = path.join(CONFIG.RESULTS_DIR, `${email.replace(/[@.]/g, '_')}.json`);
    fs.writeFileSync(resultFile, JSON.stringify({
      email,
      status: 'FAILED',
      error: err.message,
      timestamp: new Date().toISOString(),
    }, null, 2));

    return { success: false, email, error: err.message };

  } finally {
    if (browser) {
      await browser.close();
    }
    if (qodercliProc && !qodercliProc.killed) {
      qodercliProc.kill();
    }
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────
async function main() {
  log.header('Qoder Sign — Google SSO Auto Login/Logout');

  fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });

  const accounts = loadAccounts();
  if (accounts.length === 0) {
    log.error('accounts.txt is empty!');
    log.info('Add accounts in format: email@gmail.com:password');
    process.exit(1);
  }

  log.info(`Found ${accounts.length} account(s) to process`);
  log.info(`Mode: VISIBLE (browser terlihat untuk handle captcha/HP prompt)`);
  log.info(`HP Prompt Wait: ${CONFIG.HP_PROMPT_WAIT / 1000} detik`);
  log.info(`Anti-banned: Stealth + Random delays + Human behavior + UA rotation`);
  console.log('');

  const results = { success: [], failed: [] };

  for (let i = 0; i < accounts.length; i++) {
    const result = await processAccount(accounts[i], i + 1, accounts.length);

    if (result.success) {
      results.success.push(result.email);
    } else {
      results.failed.push({ email: result.email, error: result.error });
    }

    if (i < accounts.length - 1) {
      const delay = CONFIG.DELAY_BETWEEN + Math.floor(Math.random() * 5000);
      log.info(`Waiting ${(delay / 1000).toFixed(1)}s before next account...`);
      await sleep(delay);
    }
  }

  log.header('SUMMARY');
  log.ok(`Success: ${results.success.length}`);
  results.success.forEach(e => log.step(`✓ ${e}`));

  if (results.failed.length > 0) {
    log.error(`Failed: ${results.failed.length}`);
    results.failed.forEach(r => log.step(`✗ ${r.email} — ${r.error}`));
  }

  log.info(`Done accounts → ${CONFIG.DONE_FILE}`);
  log.info(`Results dir   → ${CONFIG.RESULTS_DIR}`);
}

main().catch(err => {
  log.error(`Fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});
