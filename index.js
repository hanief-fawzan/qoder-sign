// ============================================================
//  Qoder Sign — Auto Login/Logout Qoder CLI via Google SSO
//  Configuration-driven via .env (mandatory)
// ============================================================

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

// ─── ENV (MANDATORY) ────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: .env file not found!');
  console.error('   Please copy .env.example to .env and configure it.');
  process.exit(1);
}
require('dotenv').config({ path: envPath });

// ─── STEALTH ────────────────────────────────────────────────────────
puppeteer.use(StealthPlugin());

// ─── CONFIG (all from .env with defaults) ───────────────────────────
const CONFIG = {
  // Files
  ACCOUNTS_FILE:    path.join(__dirname, 'accounts.txt'),
  DONE_FILE:        path.join(__dirname, 'done_accounts.txt'),
  RESULTS_DIR:      path.join(__dirname, 'results'),

  // Browser
  HEADLESS:         process.env.HEADLESS === 'true',
  SLOW_MO:          parseInt(process.env.SLOW_MO) || 50,
  CHROME_PATH:      process.env.CHROME_PATH || null,

  // Concurrency
  CONCURRENT:       parseInt(process.env.CONCURRENT) || 1,
  DELAY_BETWEEN:    parseInt(process.env.DELAY_BETWEEN) || 8000,

  // Timeouts
  GOOGLE_TIMEOUT:   parseInt(process.env.GOOGLE_TIMEOUT) || 120000,
  HP_PROMPT_WAIT:   parseInt(process.env.HP_PROMPT_WAIT) || 120000,
  NAV_TIMEOUT:      parseInt(process.env.NAV_TIMEOUT) || 30000,
  QODERCLI_TIMEOUT: parseInt(process.env.QODERCLI_TIMEOUT) || 180000,

  // Anti-banned: Randomization
  RANDOM_DELAY_MIN: parseInt(process.env.RANDOM_DELAY_MIN) || 1000,
  RANDOM_DELAY_MAX: parseInt(process.env.RANDOM_DELAY_MAX) || 3000,
  TYPING_DELAY_MIN: parseInt(process.env.TYPING_DELAY_MIN) || 30,
  TYPING_DELAY_MAX: parseInt(process.env.TYPING_DELAY_MAX) || 80,

  // Retry settings
  MAX_RETRIES:  parseInt(process.env.MAX_RETRIES) || 0,
  RETRY_DELAY:  parseInt(process.env.RETRY_DELAY) || 15000,
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
  // Check if CHROME_PATH is set in .env
  if (CONFIG.CHROME_PATH) {
    if (fs.existsSync(CONFIG.CHROME_PATH)) {
      log.ok(`Using Chrome from .env: ${CONFIG.CHROME_PATH}`);
      return CONFIG.CHROME_PATH;
    } else {
      log.warn(`CHROME_PATH set in .env but file not found: ${CONFIG.CHROME_PATH}`);
      log.info('Falling back to auto-detection...');
    }
  }

  // Auto-detect Chrome
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
  let skippedDone = 0;
  for (const line of lines) {
    const sep = line.indexOf(':');
    if (sep === -1) {
      log.warn(`Skip baris tidak valid (format email:password): ${line}`);
      continue;
    }
    const account = {
      raw:      line,
      email:    line.slice(0, sep).trim(),
      password: line.slice(sep + 1).trim(),
    };
    // Skip accounts already in done_accounts.txt (duplicate checker)
    if (isAlreadyDone(account)) {
      log.step(`Skip ${account.email} (already in done_accounts.txt)`);
      skippedDone++;
      continue;
    }
    accounts.push(account);
  }
  if (skippedDone > 0) {
    log.info(`Skipped ${skippedDone} account(s) already in done_accounts.txt`);
  }
  return accounts;
}

function moveToDone(account) {
  // Duplicate checker: don't add if already in done_accounts.txt
  if (fs.existsSync(CONFIG.DONE_FILE)) {
    const doneLines = fs.readFileSync(CONFIG.DONE_FILE, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
    if (doneLines.includes(account.raw)) {
      log.step(`Already in done_accounts.txt, skip add`);
      // Still remove from accounts.txt
      const lines = fs.readFileSync(CONFIG.ACCOUNTS_FILE, 'utf8')
        .split('\n')
        .filter(l => l.trim() !== account.raw);
      fs.writeFileSync(CONFIG.ACCOUNTS_FILE, lines.join('\n'), 'utf8');
      return;
    }
  }

  fs.appendFileSync(CONFIG.DONE_FILE, account.raw + '\n', 'utf8');

  const lines = fs.readFileSync(CONFIG.ACCOUNTS_FILE, 'utf8')
    .split('\n')
    .filter(l => l.trim() !== account.raw);
  fs.writeFileSync(CONFIG.ACCOUNTS_FILE, lines.join('\n'), 'utf8');

  log.ok(`Dipindahkan ke done_accounts.txt`);
}

// ─── DUPLICATE CHECKER (skip accounts already in done) ──────────────
function isAlreadyDone(account) {
  if (!fs.existsSync(CONFIG.DONE_FILE)) {
    // Auto-create done_accounts.txt if not exists
    fs.writeFileSync(CONFIG.DONE_FILE, '', 'utf8');
    log.step(`Created ${CONFIG.DONE_FILE} (auto)`);
    return false;
  }
  const doneLines = fs.readFileSync(CONFIG.DONE_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
  return doneLines.includes(account.raw);
}

// ─── FIND QODERCLI EXECUTABLE ────────────────────────────────────────
function findQoderCli() {
  const os = require('os');
  const pathMod = require('path');
  const fs = require('fs');
  
  // Common install locations (exact paths)
  const locations = [
    pathMod.join(os.homedir(), '.qoder', 'bin', 'qodercli', 'qodercli.exe'),
    pathMod.join(os.homedir(), '.qoder', 'bin', 'qodercli', 'qodercli'),
    pathMod.join(os.homedir(), '.qoder', 'qodercli.exe'),
    pathMod.join(os.homedir(), '.qoder', 'qodercli'),
    pathMod.join(os.homedir(), 'AppData', 'Local', 'qoder', 'bin', 'qodercli', 'qodercli.exe'),
    pathMod.join(os.homedir(), 'AppData', 'Local', 'qoder', 'qodercli.exe'),
  ];
  
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      log.step(`Found qodercli at: ${loc}`);
      return loc;
    }
  }
  
  // Recursive search in .qoder directory
  const qoderDir = pathMod.join(os.homedir(), '.qoder');
  if (fs.existsSync(qoderDir)) {
    const exeName = os.platform() === 'win32' ? 'qodercli.exe' : 'qodercli';
    const found = findFileRecursive(qoderDir, exeName, 3);
    if (found) {
      log.step(`Found qodercli via search: ${found}`);
      return found;
    }
  }
  
  // Fallback to PATH
  log.warn('qodercli not found in common locations, falling back to PATH');
  return 'qodercli';
}

function findFileRecursive(dir, filename, maxDepth) {
  const fs = require('fs');
  const pathMod = require('path');
  if (maxDepth <= 0) return null;
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = pathMod.join(dir, entry.name);
      if (entry.isFile() && entry.name === filename) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = findFileRecursive(fullPath, filename, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch (_) {}
  return null;
}

// ─── QODERCLI LOGIN (Direct login command) ──────────────────────────
async function startQoderCliLogin() {
  log.info('Starting qodercli login process...');
  
  return new Promise((resolve, reject) => {
    // Set NO_BROWSER=true to force URL output instead of opening browser
    const env = { ...process.env, NO_BROWSER: 'true' };
    
    // Find qodercli executable
    const qodercliPath = findQoderCli();
    log.step(`Using qodercli from: ${qodercliPath}`);
    
    // Run qodercli login command
    const proc = spawn(qodercliPath, ['login'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: env,
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

    // Process exit - only resolve when process completes
    proc.on('close', (code) => {
      clearTimeout(timeout);
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
      clearTimeout(timeout);
      log.error(`Failed to start qodercli: ${err.message}`);
      reject(err);
    });

    // Timeout: wait for process to complete or timeout
    const timeout = setTimeout(() => {
      log.warn('Timeout waiting for qodercli login to complete');
      proc.kill();
      resolve({ success: false, url: loginUrl, output, timeout: true });
    }, CONFIG.QODERCLI_TIMEOUT || 180000); // 3 minutes default

    // Resolve when we get URL (so browser can open), but keep process alive
    const checkUrl = setInterval(() => {
      if (loginUrl) {
        clearTimeout(timeout);
        clearInterval(checkUrl);
        resolve({ success: true, url: loginUrl, output, process: proc });
      }
    }, 500);
  });
}

// ─── QODERCLI LOGOUT (Send /logout to interactive session) ──────────
async function logoutFromQoderCLI(proc) {
  log.info('Logging out from Qoder CLI...');
  
  return new Promise((resolve) => {
    if (!proc || proc.killed) {
      log.warn('qodercli process not running, skipping logout');
      resolve(false);
      return;
    }

    // Send /logout command to the interactive session
    log.step('Sending /logout command to qodercli...');
    proc.stdin.write('/logout\n');

    // Wait for process to exit or timeout
    const timeout = setTimeout(() => {
      log.warn('Timeout waiting for logout, killing process');
      proc.kill();
      resolve(true);
    }, 10000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      log.ok(`qodercli exited with code ${code}`);
      resolve(code === 0);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      log.warn(`Logout error: ${err.message}`);
      resolve(false);
    });
  });
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
      headless: CONFIG.HEADLESS,
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
      ],
    });

    const context = await browser.createBrowserContext({ incognito: true });
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
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
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
      throw new Error('Google login failed or timed out');
    }

    // ── 6. Wait for qodercli to complete ──────────────────────────
    log.info('Waiting for qodercli to complete login...');
    
    if (qodercliProc && !qodercliProc.killed) {
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
    } else {
      // qodercli already exited, wait a bit for server to process
      log.step('qodercli already exited, waiting for server to process...');
      await randomDelay(3000, 5000);
    }

    await randomDelay(2000, 3000);

    log.ok(`✓ ${email} — LOGIN SUCCESS`);

    // ── 7. Logout from Qoder CLI ──────────────────────────────────
    await randomDelay(2000, 3000);
    const logoutOk = await logoutFromQoderCLI(qodercliProc);

    if (logoutOk) {
      log.ok(`✓ ${email} — LOGOUT SUCCESS (via /logout command)`);
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
  log.info(`Mode: ${CONFIG.HEADLESS ? 'HEADLESS' : 'VISIBLE'}`);
  log.info(`Concurrent: ${CONFIG.CONCURRENT}`);
  log.info(`Max Retries: ${CONFIG.MAX_RETRIES}`);
  log.info(`HP Prompt Wait: ${CONFIG.HP_PROMPT_WAIT / 1000} detik`);
  console.log('');

  const results = { success: [], failed: [] };
  let retryQueue = [...accounts];
  let retryCount = 0;

  while (retryQueue.length > 0) {
    const accountsToProcess = [...retryQueue];
    retryQueue = [];

    if (retryCount > 0) {
      log.header(`RETRY ROUND ${retryCount} — ${accountsToProcess.length} account(s)`);
    }

    // Process accounts (currently sequential, CONCURRENT > 1 would need Promise.all)
    for (let i = 0; i < accountsToProcess.length; i++) {
      const result = await processAccount(accountsToProcess[i], i + 1, accountsToProcess.length);

      if (result.success) {
        results.success.push(result.email);
      } else {
        results.failed.push({ email: result.email, error: result.error });
        retryQueue.push(accountsToProcess[i]);
      }

      if (i < accountsToProcess.length - 1) {
        const delay = CONFIG.DELAY_BETWEEN + Math.floor(Math.random() * 5000);
        log.info(`Waiting ${(delay / 1000).toFixed(1)}s before next account...`);
        await sleep(delay);
      }
    }

    // If there are failed accounts, decide what to do
    if (retryQueue.length > 0) {
      retryCount++;

      if (retryCount <= CONFIG.MAX_RETRIES) {
        log.warn(`${retryQueue.length} account(s) failed. Retry in ${CONFIG.RETRY_DELAY / 1000}s...`);
        await sleep(CONFIG.RETRY_DELAY);
        continue;
      }

      // MAX_RETRIES reached
      break;
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
