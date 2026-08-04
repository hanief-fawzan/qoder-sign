// ============================================================
//  Qoder Sign — Auto Login/Logout Qoder CLI via Google SSO
//  Supports: Local Puppeteer + CamoFox REST API
//  Configuration-driven via .env (mandatory)
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');

// ─── ENV (MANDATORY) ────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ ERROR: .env file not found!');
  console.error('   Please copy .env.example to .env and configure it.');
  process.exit(1);
}
require('dotenv').config({ path: envPath });

// ─── TYPING SPEED PRESETS ───────────────────────────────────
const SPEED_PRESETS = {
  fast:   { type: [15, 40],   delay: [300, 800],   pause: [500, 1200] },
  normal: { type: [30, 80],   delay: [800, 2000],  pause: [1500, 3000] },
  slow:   { type: [50, 150],  delay: [1500, 4000], pause: [3000, 6000] },
};
const TYPING_SPEED = process.env.TYPING_SPEED || 'normal';
const speed = SPEED_PRESETS[TYPING_SPEED] || SPEED_PRESETS.normal;

// ─── CONFIG ─────────────────────────────────────────────────
const CONFIG = {
  // Files
  ACCOUNTS_FILE:    path.join(__dirname, 'accounts.txt'),
  DONE_FILE:        path.join(__dirname, 'done_accounts.txt'),
  RESULTS_DIR:      path.join(__dirname, 'results'),

  // Browser mode: local | camofox
  BROWSER_MODE:     (process.env.BROWSER_MODE || 'local').toLowerCase(),

  // Local Puppeteer
  HEADLESS:         process.env.HEADLESS !== 'false',
  SLOW_MO:          parseInt(process.env.SLOW_MO) || 50,
  CHROME_PATH:      process.env.CHROME_PATH || null,

  // CamoFox REST API
  CAMOFOX_HOST:     process.env.CAMOFOX_HOST || '127.0.0.1',
  CAMOFOX_PORT:     parseInt(process.env.CAMOFOX_PORT) || 9377,
  CAMOFOX_API_KEY:  process.env.CAMOFOX_API_KEY || '',
  CAMOFOX_USER_ID:  process.env.CAMOFOX_USER_ID || 'qoder-agent',
  CAMOFOX_HEADLESS: process.env.CAMOFOX_HEADLESS !== 'false',

  // Concurrency
  CONCURRENT:       parseInt(process.env.CONCURRENT) || 1,
  DELAY_BETWEEN:    parseInt(process.env.DELAY_BETWEEN) || 8000,

  // Timeouts
  GOOGLE_TIMEOUT:   parseInt(process.env.GOOGLE_TIMEOUT) || 120000,
  NAV_TIMEOUT:      parseInt(process.env.NAV_TIMEOUT) || 30000,
  QODERCLI_TIMEOUT: parseInt(process.env.QODERCLI_TIMEOUT) || 180000,
  QODERCLI_CALLBACK_TIMEOUT: parseInt(process.env.QODERCLI_CALLBACK_TIMEOUT) || 120000,
  FIRST_MESSAGE_TIMEOUT:     parseInt(process.env.FIRST_MESSAGE_TIMEOUT) || 60000,

  // 2FA / TOTP
  TWO_FA_WAIT:      parseInt(process.env.TWO_FA_WAIT) || 0,
  TOTP_CODE:        process.env.TOTP_CODE || '',

  // Randomization
  RANDOM_DELAY_MIN: parseInt(process.env.RANDOM_DELAY_MIN) || speed.delay[0],
  RANDOM_DELAY_MAX: parseInt(process.env.RANDOM_DELAY_MAX) || speed.delay[1],
  TYPING_DELAY_MIN: parseInt(process.env.TYPING_DELAY_MIN) || speed.type[0],
  TYPING_DELAY_MAX: parseInt(process.env.TYPING_DELAY_MAX) || speed.type[1],
  PAUSE_MIN:        parseInt(process.env.PAUSE_MIN) || speed.pause[0],
  PAUSE_MAX:        parseInt(process.env.PAUSE_MAX) || speed.pause[1],

  // Retry
  MAX_RETRIES:      parseInt(process.env.MAX_RETRIES) || 0,
  RETRY_DELAY:      parseInt(process.env.RETRY_DELAY) || 15000,

  // First message
  FIRST_MESSAGE:    process.env.FIRST_MESSAGE || 'hi',
};

// ─── COLORS / LOG ───────────────────────────────────────────
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

// ─── UTILS ──────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDelay(min = CONFIG.RANDOM_DELAY_MIN, max = CONFIG.RANDOM_DELAY_MAX) { return sleep(randomInt(min, max)); }
function randomTypingDelay() { return randomInt(CONFIG.TYPING_DELAY_MIN, CONFIG.TYPING_DELAY_MAX); }
function randomPause() { return sleep(randomInt(CONFIG.PAUSE_MIN, CONFIG.PAUSE_MAX)); }

// ─── FILE / ACCOUNTS ────────────────────────────────────────
function loadAccounts() {
  if (!fs.existsSync(CONFIG.ACCOUNTS_FILE)) {
    log.error(`accounts.txt not found: ${CONFIG.ACCOUNTS_FILE}`);
    log.info('Format: email@gmail.com:password');
    process.exit(1);
  }
  const lines = fs.readFileSync(CONFIG.ACCOUNTS_FILE, 'utf8')
    .split('\n').map(l => l.trim().replace(/\r$/, '')).filter(l => l && !l.startsWith('#'));
  const accounts = [];
  for (const line of lines) {
    const sep = line.indexOf(':');
    if (sep === -1) { log.warn(`Skip invalid line: ${line}`); continue; }
    const account = { raw: line, email: line.slice(0, sep).trim(), password: line.slice(sep + 1).trim() };
    if (isAlreadyDone(account)) { log.step(`Skip ${account.email} (already done)`); continue; }
    accounts.push(account);
  }
  return accounts;
}
function isAlreadyDone(account) {
  if (!fs.existsSync(CONFIG.DONE_FILE)) { fs.writeFileSync(CONFIG.DONE_FILE, '', 'utf8'); return false; }
  const done = fs.readFileSync(CONFIG.DONE_FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  return done.includes(account.raw);
}
function moveToDone(account) {
  fs.appendFileSync(CONFIG.DONE_FILE, account.raw + '\n', 'utf8');
  const lines = fs.readFileSync(CONFIG.ACCOUNTS_FILE, 'utf8').split('\n').filter(l => l.trim() !== account.raw);
  fs.writeFileSync(CONFIG.ACCOUNTS_FILE, lines.join('\n'), 'utf8');
  log.ok('Moved to done_accounts.txt');
}
function saveResult(email, data) {
  fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
  const f = path.join(CONFIG.RESULTS_DIR, `${email.replace(/[@.]/g, '_')}.json`);
  fs.writeFileSync(f, JSON.stringify({ ...data, timestamp: new Date().toISOString() }, null, 2));
}

// ─── QODERCLI PATH ──────────────────────────────────────────
function findQoderCli() {
  const locations = [
    path.join(os.homedir(), '.qoder', 'bin', 'qodercli', 'qodercli.exe'),
    path.join(os.homedir(), '.qoder', 'bin', 'qodercli', 'qodercli'),
    path.join(os.homedir(), '.qoder', 'qodercli.exe'),
    path.join(os.homedir(), '.qoder', 'qodercli'),
    path.join(os.homedir(), 'AppData', 'Local', 'qoder', 'bin', 'qodercli', 'qodercli.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'qoder', 'qodercli.exe'),
  ];
  for (const loc of locations) if (fs.existsSync(loc)) return loc;
  const qoderDir = path.join(os.homedir(), '.qoder');
  if (fs.existsSync(qoderDir)) {
    const exe = os.platform() === 'win32' ? 'qodercli.exe' : 'qodercli';
    const found = findFileRecursive(qoderDir, exe, 3);
    if (found) return found;
  }
  return 'qodercli';
}
function findFileRecursive(dir, filename, maxDepth) {
  if (maxDepth <= 0) return null;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === filename) return full;
      if (entry.isDirectory()) {
        const found = findFileRecursive(full, filename, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch (_) {}
  return null;
}

// ─── QODERCLI LOGIN (keep alive until callback) ─────────────
function startQoderCliLogin() {
  log.info('Phase 1: Starting qodercli login...');
  return new Promise((resolve, reject) => {
    const qodercliPath = findQoderCli();
    log.step(`Spawning: ${qodercliPath} login`);

    const proc = spawn(qodercliPath, ['login'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_BROWSER: 'true' },
    });

    let output = '';
    let loginUrl = null;
    let loginSuccess = false;
    let resolved = false;

    function onData(chunk) {
      const text = chunk.toString();
      output += text;
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) log.step(`qodercli: ${line.trim()}`);

      const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch && !loginUrl) {
        loginUrl = urlMatch[1];
        log.ok(`Login URL captured: ${loginUrl.slice(0, 80)}...`);
        if (!resolved) { resolved = true; resolve({ proc, url: loginUrl, output, loginSuccess, isAlive: () => !proc.killed && proc.exitCode === null }); }
      }
      if (text.includes('Login successful')) {
        loginSuccess = true;
        log.ok('qodercli confirmed: Login successful!');
      }
    }

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('error', (err) => { if (!resolved) { resolved = true; reject(err); } });
    proc.on('close', (code) => {
      log.step(`qodercli login process exited (code ${code})`);
      if (!resolved) { resolved = true; reject(new Error(`qodercli exited ${code} without providing URL`)); }
    });

    setTimeout(() => {
      if (!resolved) { resolved = true; reject(new Error('Timeout waiting for login URL')); }
    }, CONFIG.QODERCLI_TIMEOUT);
  });
}

function waitForQodercliLogin(loginInfo, timeoutMs = CONFIG.QODERCLI_CALLBACK_TIMEOUT) {
  return new Promise((resolve) => {
    const proc = loginInfo.proc;
    if (loginInfo.loginSuccess || proc.exitCode !== null || proc.killed) {
      return resolve(loginInfo.loginSuccess);
    }
    let resolved = false;
    const handler = (data) => {
      if (data.toString().includes('Login successful')) loginInfo.loginSuccess = true;
    };
    proc.stdout?.on('data', handler);
    proc.stderr?.on('data', handler);
    proc.on('close', () => { if (!resolved) { resolved = true; resolve(!!loginInfo.loginSuccess); } });
    setTimeout(() => { if (!resolved) { resolved = true; resolve(!!loginInfo.loginSuccess); } }, timeoutMs);
  });
}

// ─── FIRST MESSAGE & LOGOUT ─────────────────────────────────
function sendFirstMessage(message) {
  log.info(`Phase 3: Sending first message "${message}"...`);
  return new Promise((resolve) => {
    const qodercliPath = findQoderCli();
    const proc = spawn(qodercliPath, ['-p', message], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', gotResponse = false;

    proc.stdout.on('data', (d) => { stdout += d; if (d.toString().trim()) gotResponse = true; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      const err = stderr.toLowerCase();
      if (err.includes('credit') || err.includes('limit') || err.includes('usage limit')) {
        log.warn('Credit limit reached — trial may not be activated');
        resolve({ success: false, creditLimit: true, response: stdout, error: stderr });
      } else if (code === 0 && gotResponse) {
        log.ok('First message response received');
        resolve({ success: true, response: stdout });
      } else {
        resolve({ success: false, response: stdout, error: stderr || `exit_${code}` });
      }
    });
    proc.on('error', (err) => resolve({ success: false, error: err.message }));
    setTimeout(() => { proc.kill(); resolve({ success: false, response: stdout, error: 'timeout' }); }, CONFIG.FIRST_MESSAGE_TIMEOUT);
  });
}

function logoutQoderCli() {
  log.info('Phase 4: Logging out from Qoder...');
  return new Promise((resolve) => {
    const qodercliPath = findQoderCli();

    // Try dedicated logout command first
    const logoutProc = spawn(qodercliPath, ['logout'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', finished = false;
    logoutProc.stdout.on('data', (d) => { out += d; });
    logoutProc.stderr.on('data', (d) => { out += d; });
    logoutProc.on('close', (code) => {
      if (!finished) {
        finished = true;
        if (code === 0 || out.toLowerCase().includes('logout') || out.toLowerCase().includes('success')) {
          log.ok('qodercli logout success');
          return resolve(true);
        }
        // Fallback: interactive /logout
        interactiveLogout(resolve);
      }
    });
    setTimeout(() => { if (!finished) { finished = true; logoutProc.kill(); interactiveLogout(resolve); } }, 10000);
  });
}

function interactiveLogout(resolve) {
  log.step('Fallback: interactive /logout...');
  const qodercliPath = findQoderCli();
  const proc = spawn(qodercliPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  let sent = false, finished = false;
  proc.stdout.on('data', (d) => {
    const text = d.toString();
    if (!sent && /[>\$]|Ask|Type|qoder/i.test(text)) {
      sent = true;
      proc.stdin.write('/logout\n');
    }
  });
  proc.on('close', () => { if (!finished) { finished = true; resolve(true); } });
  proc.on('error', () => { if (!finished) { finished = true; resolve(false); } });
  setTimeout(() => { if (!finished) { finished = true; proc.kill(); resolve(false); } }, 15000);
}

// ═══════════════════════════════════════════════════════════
//  BROWSER DRIVERS
// ═══════════════════════════════════════════════════════════

// ─── CamoFox Driver ─────────────────────────────────────────
class CamoFoxDriver {
  constructor() {
    this.base = `${CONFIG.CAMOFOX_HOST}:${CONFIG.CAMOFOX_PORT}`;
    this.key = CONFIG.CAMOFOX_API_KEY;
    this.user = CONFIG.CAMOFOX_USER_ID;
    this.tabId = null;
  }

  async api(method, path, body = null, raw = false) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: CONFIG.CAMOFOX_HOST,
        port: CONFIG.CAMOFOX_PORT,
        path,
        method,
        headers: { Authorization: `Bearer ${this.key}` },
        timeout: 60000,
      };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ ...body, userId: this.user });
      }
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          if (raw) return resolve({ status: res.statusCode, data });
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('CamoFox API timeout')); });
      if (body) req.write(body);
      req.end();
    });
  }

  async start() {
    const { data } = await this.api('GET', '/');
    if (!data.browserRunning) {
      await this.api('POST', '/start');
      await sleep(5000);
    }
  }

  async newTab(url = null) {
    const body = { sessionKey: `qoder-${Date.now()}`, userId: this.user };
    if (url) body.url = url;
    const { data } = await this.api('POST', '/tabs', body);
    this.tabId = data.tabId;
    if (url) await sleep(4000);
    return this.tabId;
  }

  async navigate(url) {
    await this.api('POST', `/tabs/${this.tabId}/navigate`, { url });
    await sleep(4000);
  }

  async snapshot() {
    const { data } = await this.api('GET', `/tabs/${this.tabId}/snapshot?userId=${encodeURIComponent(this.user)}`);
    return data;
  }

  async click(ref) {
    await this.api('POST', `/tabs/${this.tabId}/click`, { ref });
    await sleep(1500);
  }

  async type(ref, text) {
    await this.api('POST', `/tabs/${this.tabId}/type`, { ref, text });
    await sleep(500);
  }

  async evaluate(expression) {
    const { data } = await this.api('POST', `/tabs/${this.tabId}/evaluate`, { expression });
    return data?.result;
  }

  async url() {
    const snap = await this.snapshot();
    return snap?.url || '';
  }

  async close() {
    if (this.tabId) await this.api('DELETE', `/tabs/${this.tabId}`, {}).catch(() => {});
  }
}

// ─── Local Puppeteer Driver ─────────────────────────────────
class LocalPuppeteerDriver {
  async init() {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    const chromePath = this.findChrome();
    if (!chromePath) throw new Error('Google Chrome not found. Set CHROME_PATH in .env');

    this.browser = await puppeteer.launch({
      headless: CONFIG.HEADLESS,
      executablePath: chromePath,
      slowMo: CONFIG.SLOW_MO,
      defaultViewport: null,
      args: [
        '--no-sandbox', '--disable-blink-features=AutomationControlled',
        '--disable-infobars', '--start-maximized', '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
        '--no-first-run', '--no-zygote', '--disable-gpu',
      ],
    });
    const context = await this.browser.createBrowserContext();
    this.page = await context.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });
  }

  findChrome() {
    if (CONFIG.CHROME_PATH && fs.existsSync(CONFIG.CHROME_PATH)) return CONFIG.CHROME_PATH;
    const platform = os.platform();
    const candidates = [];
    if (platform === 'win32') {
      [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].forEach(pf => {
        if (pf) candidates.push(path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      });
    } else if (platform === 'darwin') {
      candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    } else {
      candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser');
    }
    for (const p of candidates) if (fs.existsSync(p)) return p;
    return null;
  }

  async navigate(url) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.NAV_TIMEOUT });
    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    await randomDelay(2000, 3000);
  }

  async clickGoogleSSO() {
    const selectors = [
      'a[href*="/sso/login/google"]',
      'a[href*="google"]',
      '[class*="google" i]',
      'button[data-provider="google"]',
      '[aria-label*="Google" i]',
      'img[alt*="Google" i]',
    ];
    for (const sel of selectors) {
      const el = await this.page.$(sel);
      if (el && await el.isIntersectingViewport().catch(() => false)) {
        await el.click();
        await randomDelay(2000, 3000);
        return;
      }
    }
    // JS fallback
    await this.page.evaluate(() => {
      const els = document.querySelectorAll('button, a, div[role="button"], span[role="button"]');
      for (const el of els) {
        if ((el.textContent || '').toLowerCase().includes('google')) {
          el.scrollIntoView({ block: 'center' });
          el.click();
          return true;
        }
      }
      return false;
    }).then(clicked => {
      if (clicked) log.step('Local: Google SSO button found via JS fallback');
      else log.warn('Google SSO button not found via CSS or JS fallback');
    });
    await randomDelay(2000, 3000);
  }

  async fillGoogleEmail(email) {
    await this.page.waitForSelector('input#identifierId, input[type="email"]', { visible: true, timeout: 15000 });
    await this.page.click('input#identifierId');
    await randomDelay(300, 600);
    await this.page.type('input#identifierId', email, { delay: randomTypingDelay() });
    await randomDelay(500, 1000);
    await this.page.click('#identifierNext button').catch(() => this.page.keyboard.press('Enter'));
    await randomDelay(2000, 3000);
  }

  async fillGooglePassword(password) {
    await this.page.waitForSelector('input[name="Passwd"], input[type="password"]', { visible: true, timeout: 15000 });
    await this.page.click('input[name="Passwd"]');
    await randomDelay(300, 600);
    await this.page.type('input[name="Passwd"]', password, { delay: randomTypingDelay() });
    await randomDelay(500, 1000);
    await this.page.click('#passwordNext button').catch(() => this.page.keyboard.press('Enter'));
    await randomDelay(2500, 3500);
  }

  async url() { return this.page.url(); }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
//  GOOGLE FLOW (CamoFox)
// ═══════════════════════════════════════════════════════════
async function handleCamoFoxGoogle(driver, email, password) {
  log.step('CamoFox: clicking Google SSO...');
  const snap = await driver.snapshot();
  const refs = parseRefs(snap.snapshot);
  const googleRef = findRef(refs, ['google', 'sign in with google']);
  if (!googleRef) throw new Error('Google SSO button not found in snapshot');
  await driver.click(googleRef);

  // Email
  log.step('CamoFox: filling email...');
  await waitForCamoFoxUrl(driver, (u) => u.includes('/identifier') || u.includes('accounts.google.com'));
  const emailSnap = await driver.snapshot();
  const emailRef = findRefByType(emailSnap.snapshot, 'textbox') || findRef(parseRefs(emailSnap.snapshot), ['email', 'e-mel', 'phone']);
  if (!emailRef) throw new Error('Email input not found');
  await driver.type(emailRef, email);
  const nextRef = findRef(parseRefs(emailSnap.snapshot), ['next', 'seterusnya', 'lanjutkan']);
  if (nextRef) await driver.click(nextRef);
  else await driver.evaluate("document.querySelector('#identifierNext button')?.click() || document.querySelector('button[type=submit]')?.click()");

  await randomDelay(3000, 5000);

  // Password
  log.step('CamoFox: filling password...');
  const pwdSnap = await driver.snapshot();
  const pwdRef = findRefByType(pwdSnap.snapshot, 'textbox') || findRef(parseRefs(pwdSnap.snapshot), ['password', 'kata laluan', 'kata sandi']);
  if (pwdRef) await driver.type(pwdRef, password);
  else await driver.evaluate(`(async () => { const el = document.querySelector('input[name="Passwd"]'); if (el) { el.value = ${JSON.stringify(password)}; el.dispatchEvent(new Event('input', {bubbles:true})); } })()`);
  const pwdNextRef = findRef(parseRefs(pwdSnap.snapshot), ['next', 'seterusnya']);
  if (pwdNextRef) await driver.click(pwdNextRef);
  else await driver.evaluate("document.querySelector('#passwordNext button')?.click() || document.querySelector('button[type=submit]')?.click()");

  await randomDelay(3000, 5000);

  // 2FA / Consent / Redirect
  return handlePostPassword(driver);
}

function parseRefs(snapshotText) {
  const refs = [];
  if (!snapshotText) return refs;
  const lines = snapshotText.split('\n');
  for (const line of lines) {
    // Handles: - link "google Sign in with Google" [e1]:
    // Handles: - textbox "Masukkan kata laluan" [e1]
    const m = line.match(/^(\s*)-\s+(\w+)\s+(.+?)\s+\[e(\d+)\]/);
    if (m) {
      refs.push({ indent: m[1].length, type: m[2], text: m[3].trim(), ref: `e${m[4]}`, raw: line });
    }
  }
  return refs;
}

function findRef(refs, keywords) {
  for (const r of refs) {
    const t = `${r.type} ${r.text}`.toLowerCase();
    if (keywords.some(k => t.includes(k.toLowerCase()))) return r.ref;
  }
  return null;
}

function findRefByType(snapshotText, type) {
  const refs = parseRefs(snapshotText);
  for (const r of refs) if (r.type.toLowerCase() === type.toLowerCase()) return r.ref;
  return null;
}

async function waitForCamoFoxUrl(driver, predicate, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const u = await driver.url();
    if (predicate(u)) return u;
    await sleep(1000);
  }
  return await driver.url();
}

async function handlePostPassword(driver) {
  const start = Date.now();
  while (Date.now() - start < CONFIG.GOOGLE_TIMEOUT) {
    const u = await driver.url();
    if (u.includes('qoder.com') || u.includes('qoder.sh')) {
      log.ok('Redirected back to Qoder!');
      return true;
    }

    const snap = await driver.snapshot();
    const text = (snap.snapshot || '').toLowerCase();
    const refs = parseRefs(snap.snapshot);

    // Auto TOTP
    if (CONFIG.TOTP_CODE && (text.includes('pengesah') || text.includes('authenticator') || text.includes('totp') || text.includes('kod') || text.includes('code'))) {
      const codeRef = findRefByType(snap.snapshot, 'textbox');
      if (codeRef) {
        log.step(`Auto-entering TOTP code: ${CONFIG.TOTP_CODE}`);
        await driver.type(codeRef, CONFIG.TOTP_CODE);
        const nextRef = findRef(refs, ['next', 'seterusnya', 'verify']);
        if (nextRef) await driver.click(nextRef);
        await randomDelay(3000, 5000);
        continue;
      }
    }

    // Manual 2FA wait (only if HEADLESS=false in local, but CamoFox is always somewhat headless)
    if (CONFIG.TWO_FA_WAIT > 0 && (text.includes('2 langkah') || text.includes('2-step') || text.includes('verify') || text.includes('pengesahan'))) {
      log.warn(`🔐 Manual 2FA wait: ${CONFIG.TWO_FA_WAIT}s`);
      const deadline = Date.now() + CONFIG.TWO_FA_WAIT * 1000;
      while (Date.now() < deadline) {
        const u2 = await driver.url();
        if (u2.includes('qoder.com') || u2.includes('qoder.sh')) {
          log.ok('Redirected to Qoder — 2FA passed!');
          return true;
        }
        await sleep(2000);
      }
      log.error('Manual 2FA timeout');
      return false;
    }

    // Auto consent
    const consentTexts = ['allow', 'continue', 'next', 'approve', 'confirm', 'accept', 'izinkan', 'lanjutkan', 'setuju', 'ya'];
    const consentRef = findRef(refs, consentTexts);
    if (consentRef) {
      log.step(`Auto-clicking consent: ${consentRef}`);
      await driver.click(consentRef);
      await randomDelay(2000, 3000);
      continue;
    }

    // Advanced unsafe app fallback
    if (text.includes('advanced') || text.includes('unsafe')) {
      await driver.evaluate(`
        document.querySelector('#advancedButton, [id*="advanced"]')?.click();
        setTimeout(() => {
          for (const el of document.querySelectorAll('a, button')) {
            const t = (el.textContent || '').toLowerCase();
            if (t.includes('go to') || t.includes('unsafe') || t.includes('proceed') || t.includes('lanjutkan')) el.click();
          }
        }, 1000);
      `);
      await randomDelay(3000, 5000);
      continue;
    }

    await sleep(2000);
  }
  log.error('Timeout waiting for Google redirect');
  return false;
}

// ═══════════════════════════════════════════════════════════
//  PROCESS SINGLE ACCOUNT
// ═══════════════════════════════════════════════════════════
async function processAccount(account, idx, total) {
  const { email, password } = account;
  log.header(`[${idx}/${total}] ${email}`);

  let driver = null;
  let qodercliProc = null;

  try {
    // Phase 1: start qodercli login (keep alive)
    const loginInfo = await startQoderCliLogin();
    qodercliProc = loginInfo.proc;
    const loginUrl = loginInfo.url;

    // Phase 2: browser sign-in
    log.info(`Phase 2: Browser sign-in via ${CONFIG.BROWSER_MODE}...`);
    if (CONFIG.BROWSER_MODE === 'camofox') {
      if (!CONFIG.CAMOFOX_API_KEY || CONFIG.CAMOFOX_API_KEY === 'your_camofox_api_key_here') {
        throw new Error('CAMOFOX_API_KEY not configured');
      }
      driver = new CamoFoxDriver();
      await driver.start();
      await driver.newTab(loginUrl);
      const loginOk = await handleCamoFoxGoogle(driver, email, password);
      if (!loginOk) throw new Error('Google login failed or timed out');
    } else {
      driver = new LocalPuppeteerDriver();
      await driver.init();
      await driver.navigate(loginUrl);
      await driver.clickGoogleSSO();
      await driver.fillGoogleEmail(email);
      await driver.fillGooglePassword(password);
      const loginOk = await handleLocalPostPassword(driver);
      if (!loginOk) throw new Error('Google login failed or timed out');
    }

    // Phase 2b: wait for qodercli callback
    log.step('Waiting for qodercli callback confirmation...');
    const callbackOk = await waitForQodercliLogin(loginInfo, CONFIG.QODERCLI_CALLBACK_TIMEOUT);
    if (!callbackOk) log.warn('qodercli did not report Login successful within timeout, but continuing');
    else log.ok('qodercli callback confirmed');

    // Phase 3: first message (optional)
    let msgResult = { success: false, skipped: true };
    if (CONFIG.FIRST_MESSAGE && CONFIG.FIRST_MESSAGE.trim()) {
      await randomPause();
      msgResult = await sendFirstMessage(CONFIG.FIRST_MESSAGE);
    }

    // Phase 4: logout
    await randomPause();
    const logoutOk = await logoutQoderCli();

    saveResult(email, {
      email, status: 'SUCCESS', login: true, callbackConfirmed: callbackOk,
      firstMessage: msgResult.success, logout: logoutOk,
      error: msgResult.error || null,
    });
    moveToDone(account);
    return { success: true, email };

  } catch (err) {
    log.error(`${email} — FAILED: ${err.message}`);
    saveResult(email, { email, status: 'FAILED', error: err.message });
    return { success: false, email, error: err.message };

  } finally {
    if (driver) await driver.close().catch(() => {});
    if (qodercliProc && !qodercliProc.killed) {
      log.step('Cleaning up qodercli process...');
      qodercliProc.kill();
    }
  }
}

// ─── Local post-password flow (2FA / consent / redirect) ────
async function handleLocalPostPassword(driver) {
  const page = driver.page;
  const start = Date.now();
  while (Date.now() - start < CONFIG.GOOGLE_TIMEOUT) {
    const u = await driver.url();
    if (u.includes('qoder.com') || u.includes('qoder.sh')) {
      log.ok('Redirected back to Qoder!');
      return true;
    }

    // Auto TOTP
    if (CONFIG.TOTP_CODE) {
      try {
        const totpInput = await page.waitForSelector(
          'input[type="tel"], input[type="text"][name*="code" i], input[aria-label*="code" i], input[inputmode="numeric"]',
          { visible: true, timeout: 3000 }
        );
        if (totpInput) {
          log.step(`Auto-entering TOTP: ${CONFIG.TOTP_CODE}`);
          await totpInput.type(CONFIG.TOTP_CODE, { delay: randomTypingDelay() });
          await page.keyboard.press('Enter');
          await randomDelay(3000, 5000);
          continue;
        }
      } catch (_) {
        // No TOTP input found, continue with consent detection
      }
    }

    // Manual 2FA wait in visible browser
    if (!CONFIG.HEADLESS && CONFIG.TWO_FA_WAIT > 0) {
      const heading = await page.$eval('h1, h2, [role="heading"]', el => el.textContent?.trim()).catch(() => '');
      if (/2.step|2 langkah|verify|verifikasi|confirm|konfirmasi|pengesahan/i.test(heading)) {
        log.warn(`🔐 Manual 2FA wait: ${CONFIG.TWO_FA_WAIT}s — complete on your phone!`);
        const deadline = Date.now() + CONFIG.TWO_FA_WAIT * 1000;
        while (Date.now() < deadline) {
          const u2 = await driver.url();
          if (u2.includes('qoder.com') || u2.includes('qoder.sh')) {
            log.ok('Redirected to Qoder — 2FA passed!');
            return true;
          }
          await sleep(2000);
        }
        log.error('Manual 2FA timeout');
        return false;
      }
    }

    // Auto consent
    const clicked = await page.evaluate(() => {
      const ids = ['confirm', 'submit_approve_access', 'approve_button', 'next'];
      for (const id of ids) { const el = document.getElementById(id); if (el && el.offsetParent !== null) { el.click(); return id; } }
      const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]');
      const texts = ['allow', 'continue', 'next', 'approve', 'confirm', 'accept', 'izinkan', 'lanjutkan', 'setuju', 'ya'];
      for (const btn of buttons) {
        const t = (btn.textContent || btn.value || '').toLowerCase().trim();
        if (texts.some(x => t.includes(x))) { btn.click(); return t; }
      }
      const adv = document.querySelector('#advancedButton') || document.querySelector('[id*="advanced"]');
      if (adv) { adv.click(); return 'advanced'; }
      return null;
    });
    if (clicked) {
      log.step(`Consent clicked: ${clicked}`);
      await randomDelay(2000, 3000);
      continue;
    }

    await sleep(2000);
  }
  log.error('Timeout waiting for Google redirect');
  return false;
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  log.header('Qoder Sign — Auto Login/Logout (v3)');
  fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });

  const accounts = loadAccounts();
  if (accounts.length === 0) {
    log.error('No accounts to process. Check accounts.txt');
    process.exit(1);
  }

  log.info(`Accounts: ${accounts.length}`);
  log.info(`Browser: ${CONFIG.BROWSER_MODE} | Headless: ${CONFIG.BROWSER_MODE === 'local' ? CONFIG.HEADLESS : CONFIG.CAMOFOX_HEADLESS}`);
  log.info(`2FA: ${CONFIG.TWO_FA_WAIT > 0 ? CONFIG.TWO_FA_WAIT + 's manual' : 'auto-skip'} | TOTP auto: ${CONFIG.TOTP_CODE ? 'yes' : 'no'}`);
  log.info(`First message: "${CONFIG.FIRST_MESSAGE}"`);
  console.log('');

  const results = { success: [], failed: [] };
  let retryQueue = [...accounts];
  let retryCount = 0;

  while (retryQueue.length > 0 && retryCount <= CONFIG.MAX_RETRIES) {
    const batch = [...retryQueue];
    retryQueue = [];
    if (retryCount > 0) log.header(`RETRY ROUND ${retryCount} — ${batch.length} account(s)`);

    for (let i = 0; i < batch.length; i++) {
      const result = await processAccount(batch[i], i + 1, batch.length);
      if (result.success) results.success.push(result.email);
      else { results.failed.push({ email: result.email, error: result.error }); retryQueue.push(batch[i]); }

      if (i < batch.length - 1) {
        const delay = CONFIG.DELAY_BETWEEN + randomInt(0, 5000);
        log.info(`Waiting ${(delay / 1000).toFixed(1)}s before next account...`);
        await sleep(delay);
      }
    }
    retryCount++;
    if (retryQueue.length > 0 && retryCount <= CONFIG.MAX_RETRIES) {
      log.warn(`${retryQueue.length} failed. Retry in ${CONFIG.RETRY_DELAY / 1000}s...`);
      await sleep(CONFIG.RETRY_DELAY);
    }
  }

  log.header('SUMMARY');
  log.ok(`Success: ${results.success.length}`);
  results.success.forEach(e => log.step(`✓ ${e}`));
  if (results.failed.length > 0) {
    log.error(`Failed: ${results.failed.length}`);
    results.failed.forEach(r => log.step(`✗ ${r.email} — ${r.error}`));
  }
  log.info(`Done → ${CONFIG.DONE_FILE}`);
  log.info(`Results → ${CONFIG.RESULTS_DIR}`);
}

main().catch((err) => { log.error(`FATAL: ${err.message}`); process.exit(1); });
