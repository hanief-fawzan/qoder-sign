# qoder-sign

Automated login/logout for Qoder CLI via Google SSO. Spawns `qodercli` interactive sessions with `NO_BROWSER=true`, captures the sign-in URL, drives Google OAuth through Puppeteer (stealth), then logs out — one account at a time.

## What It Does

    accounts.txt -> qoder-sign -> done_accounts.txt

For each account:
1. Spawn `qodercli` interactive session (`NO_BROWSER=true`)
2. Auto-select "Sign in" -> "Login with Qoder Platform (Browser)"
3. Capture login URL from qodercli output
4. Open Chrome Incognito to that URL
5. Click "Sign in with Google", auto-fill email + password
6. Wait for HP/2FA verification if needed (configurable)
7. Token saved by qodercli automatically
8. Send `/logout` to the same qodercli session
9. Move account to `done_accounts.txt`, repeat

## Requirements

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Google Chrome** — must be installed on the system
- **Qoder CLI** — separate application, install from [https://qoder.com/cli](https://qoder.com/cli)

## Install

### 1. Clone

```bash
git clone https://github.com/hanief-fawzan/qoder-sign.git
cd qoder-sign
```

Or [download ZIP](https://github.com/hanief-fawzan/qoder-sign/archive/refs/heads/main.zip) — repo is public, no GitHub login needed.

### 2. Install Qoder CLI

Qoder CLI is **not** an npm package. Install from the official source:

**Windows (PowerShell):**
```powershell
irm https://qoder.com/install.ps1 | iex
```

**Windows (CMD):**
```cmd
curl -fsSL https://qoder.com/install.cmd -o install.cmd && install.cmd
```

**macOS/Linux:**
```bash
curl -fsSL https://qoder.com/install | bash
```

Verify: `qodercli --version`

### 3. Install Dependencies

```bash
# Windows — double-click setup.bat, or:
npm install
```

### 4. Configure

```bash
# Windows
copy .env.example .env
copy accounts.txt.example accounts.txt

# macOS/Linux
cp .env.example .env
cp accounts.txt.example accounts.txt
```

Edit `.env` — all settings live here. Key options:

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADLESS` | `false` | Run Chrome headless (no window) |
| `SLOW_MO` | `50` | Delay between actions (ms) |
| `CHROME_PATH` | auto-detect | Override Chrome path |
| `CONCURRENT` | `1` | Parallel accounts |
| `DELAY_BETWEEN` | `8000` | Delay between accounts (ms) |
| `TWO_FA_WAIT` | `0` | Seconds to wait for manual 2FA (0 = auto-skip) |
| `TOTP_CODE` | empty | Auto-fill TOTP code (skips manual 2FA) |
| `TYPING_SPEED` | `normal` | Preset: `fast`, `normal`, `slow` |
| `FIRST_MESSAGE` | `hi` | Message sent after login to activate trial |
| `MAX_RETRIES` | `3` | Retry count for failed accounts |
| `RETRY_DELAY` | `15000` | Delay before retry (ms) |

### 5. Add Accounts

Edit `accounts.txt`, one per line:

```
user1@gmail.com:password1
user2@gmail.com:password2
```

Lines starting with `#` are ignored.

## Usage

```bash
# Windows
run.bat

# Manual
node index.js
```

## Results

- **Success:** account moved to `done_accounts.txt`
- **Failure:** stays in `accounts.txt`, retried up to `MAX_RETRIES` times
- **Per-account logs:** `results/*.json`

## Anti-Ban Measures

- Puppeteer stealth plugin (hides automation fingerprints)
- Random delays, mouse movements, scrolling
- User agent rotation + random viewport sizes
- Incognito mode per account (clean session, no cookies)
- System Chrome (not Puppeteer's bundled Chromium)

## File Structure

```
qoder-sign/
├── index.js              # Main script
├── package.json          # Dependencies
├── .env.example          # Config template
├── accounts.txt.example  # Account list template
├── results/              # JSON results per account
├── setup.bat             # Windows setup
├── run.bat               # Windows run
└── logout.bat            # Windows logout
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `.env` not found | Copy `.env.example` to `.env` |
| Chrome not detected | Set `CHROME_PATH` in `.env` |
| qodercli not found | Install from [qoder.com/cli](https://qoder.com/cli), ensure it's in PATH |
| Login fails | Check credentials in `accounts.txt`, check `results/*.json` for details |
| HP verification timeout | Increase `HP_PROMPT_WAIT` / `QODERCLI_TIMEOUT` in `.env` |

## Security

`accounts.txt` contains plaintext passwords. Never commit it, never share it. The `.gitignore` already excludes it.

## License

MIT
