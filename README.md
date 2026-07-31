# Qoder Sign — Auto Login/Logout Qoder CLI via Google SSO

Automasi login/logout Qoder CLI menggunakan Google SSO dengan Chrome Incognito. Setiap akun akan login, lalu logout otomatis, dengan jeda untuk verifikasi HP.

## ✨ Fitur

- 🔄 **Auto Login/Logout** — Setiap akun login ke Qoder via Google SSO, lalu logout otomatis
- 🕵️ **Stealth Mode** — Anti-detection dengan puppeteer-extra-plugin-stealth
- 🌐 **System Chrome** — Menggunakan Chrome yang sudah terinstall (bukan Puppeteer Chrome)
- 🎭 **Incognito Mode** — Setiap akun pakai Chrome Incognito (clean session)
- 🤖 **Human Behavior** — Mouse movements, random delays, typing simulation
- 📱 **HP Verification Support** — Jeda 2 menit untuk verifikasi di HP
- 📊 **Account Management** — Akun sukses masuk `done_accounts.txt`, akun gagal tetap di `accounts.txt`
- ⚙️ **Configuration-Driven** — Semua setting di `.env` (mandatory)

## 📋 Persyaratan

- **Windows 10/11**
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Google Chrome** — Harus terinstall di sistem
- **Qoder CLI** — Aplikasi terpisah, install dari [https://qoder.com/cli](https://qoder.com/cli)

## 🚀 Instalasi

### 1. Clone Repository

**Cara 1: Menggunakan Git (Recommended)**

Buka Command Prompt atau PowerShell, lalu jalankan:

```bash
git clone https://github.com/hanief-fawzan/qoder-sign.git
cd qoder-sign
```

**Catatan:** Repository ini PUBLIC, jadi kamu TIDAK PERLU login GitHub untuk clone.

**Cara 2: Download ZIP (Tanpa Git)**

Jika kamu tidak punya Git atau tidak ingin install:

1. Buka browser ke: https://github.com/hanief-fawzan/qoder-sign
2. Klik tombol hijau **"Code"** di pojok kanan atas
3. Pilih **"Download ZIP"**
4. Extract ZIP ke folder yang kamu inginkan
5. Buka Command Prompt di folder tersebut

**Cara 3: Menggunakan GitHub Desktop (GUI)**

Jika kamu lebih suka interface grafis:

1. Download & install [GitHub Desktop](https://desktop.github.com/)
2. Klik **"File"** → **"Clone repository..."**
3. Pilih tab **"URL"**
4. Paste: `https://github.com/hanief-fawzan/qoder-sign.git`
5. Pilih folder tujuan
6. Klik **"Clone"**

**Tidak perlu login GitHub** untuk semua cara di atas karena repository ini public.

### 2. Install Qoder CLI

Qoder CLI adalah aplikasi terpisah yang harus diinstall terlebih dahulu.

**Windows (PowerShell):**
```powershell
irm https://qoder.com/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://qoder.com/install.sh | bash
```

**Atau download manual:**
1. Kunjungi [https://qoder.com/cli](https://qoder.com/cli)
2. Pilih platform kamu (Windows/macOS/Linux)
3. Download dan jalankan installer
4. Verifikasi: `qodercli --version`

**Catatan:** Qoder CLI biasanya terinstall di `%USERPROFILE%\.qoder\bin\qodercli\`. Script ini akan auto-detect lokasi tersebut.

### 3. Install Dependencies

**Windows (Recommended):**
```bash
setup.bat
```

**Manual:**
```bash
npm install
```

### 4. Setup accounts.txt

**Copy from template:**
```bash
copy accounts.txt.example accounts.txt
```

### 5. Setup .env (MANDATORY)

**Windows:**
```bash
copy .env.example .env
```

**Linux/Mac:**
```bash
cp .env.example .env
```

Kemudian edit file `.env` sesuai kebutuhan:

```env
# Browser Settings
HEADLESS=false                    # true = no browser window, false = visible
SLOW_MO=50                        # delay antar aksi (ms)

# Chrome Path (optional, auto-detect if empty)
CHROME_PATH=                      # contoh: C:\Program Files\Google\Chrome\Application\chrome.exe

# Concurrency
CONCURRENT=1                      # jumlah akun yang diproses bersamaan
DELAY_BETWEEN=8000                # delay antar akun (ms)

# Timeouts (milliseconds)
GOOGLE_TIMEOUT=120000             # max waktu login Google (2 menit)
HP_PROMPT_WAIT=120000             # max waktu tunggu verifikasi HP (2 menit)
NAV_TIMEOUT=30000                 # timeout navigasi (30 detik)
QODERCLI_TIMEOUT=180000           # max waktu qodercli login (3 menit)

# Anti-banned: Randomization
RANDOM_DELAY_MIN=1000             # min random delay (ms)
RANDOM_DELAY_MAX=3000             # max random delay (ms)
TYPING_DELAY_MIN=30               # min typing delay per karakter (ms)
TYPING_DELAY_MAX=80               # max typing delay per karakter (ms)

# Retry Settings
MAX_RETRIES=3                     # max retry untuk akun yang gagal
RETRY_DELAY=15000                 # delay sebelum retry (ms)
```

**Catatan:**
- File `.env` bersifat **WAJIB**. Program tidak akan jalan tanpa `.env`.
- `setup.bat` akan otomatis copy `.env.example` ke `.env` jika belum ada.
- Semua konfigurasi (HEADLESS, MAX_RETRIES, dll) diatur di `.env`.

### 6. Verify Installation

Pastikan semua requirements terpenuhi:
- ✅ Node.js terinstall (`node --version`)
- ✅ Google Chrome terinstall
- ✅ Qoder CLI terinstall (`qodercli --version`)

## 📝 Cara Pakai

### 1. Edit File `accounts.txt`

Buka `accounts.txt` dan isi dengan format:

```
email1@gmail.com:password1
email2@gmail.com:password2
email3@gmail.com:password3
```

**Format:** `email:password` (satu akun per baris)

### 2. Jalankan Program

**Windows:**
```bash
run.bat
```

**Manual:**
```bash
node index.js
```

### 3. Proses Otomatis

Program akan melakukan langkah berikut untuk setiap akun:

1. Baca konfigurasi dari `.env`
2. Spawn session interactive `qodercli` dengan environment `NO_BROWSER=true`
3. Auto-select "Sign in to continue" di menu awal qodercli
4. Auto-select "Login with Qoder Platform (Browser)" sebagai metode login
5. Capture login URL dari output qodercli (karena `NO_BROWSER=true`, URL di-print bukan dibuka otomatis)
6. Buka Chrome Incognito ke URL tersebut
7. Klik "Sign in with Google"
8. Auto-fill email dan password Google
9. **JEDA 2 MENIT** — Kalau muncul verifikasi di HP, klik OK di HP kamu
10. Login ke Qoder berhasil (token tersimpan otomatis oleh qodercli)
11. Kirim command `/logout` ke session qodercli yang sama
12. Pindah akun ke `done_accounts.txt`
13. Lanjut ke akun berikutnya
14. Jika ada akun gagal, retry sesuai `MAX_RETRIES` di `.env`

### 4. Cek Hasil

- **Akun sukses:** Ada di `done_accounts.txt`
- **Akun gagal:** Tetap di `accounts.txt` (akan di-retry sesuai MAX_RETRIES)

## 🔄 Workflow

```
Account 1:
  ├─ Spawn qodercli interactive (NO_BROWSER=true)
  ├─ Auto-select Sign in → Browser login
  ├─ Capture login URL dari output
  ├─ Chrome Incognito (clean session)
  ├─ Random User Agent + Viewport
  ├─ Human-like typing + mouse movements
  ├─ Login Google SSO (auto-fill email + password)
  ├─ Wait for HP verification (2 min)
  ├─ Login to Qoder berhasil
  ├─ Send /logout ke session qodercli
  ├─ Close incognito window
  └─ Move to done_accounts.txt

Account 2:
  ├─ New qodercli session
  ├─ New Chrome Incognito (clean session)
  ├─ Different User Agent + Viewport
  ├─ Random delays (anti-pattern)
  └─ ... same flow

Account 3:
  └─ ... same flow

Failed Accounts:
  ├─ Tetap di accounts.txt
  └─ Retry up to MAX_RETRIES times
```

## 🛡️ Anti-Banned Features

- ✅ **Stealth Plugin** — Hide automation fingerprints
- ✅ **Random Delays** — Random timing between actions (anti-pattern detection)
- ✅ **Human Behavior** — Mouse movements, scrolling, typing delays
- ✅ **User Agent Rotation** — Random Chrome versions
- ✅ **Random Viewport** — Different window sizes per account
- ✅ **Incognito Mode** — Clean session per account (no cookies/cache)
- ✅ **System Chrome** — Use your actual Chrome (not Puppeteer's)

## 📁 File Structure

```
qoder-sign/
├── index.js              # Main script
├── package.json          # Dependencies
├── accounts.txt          # Input: akun yang akan diproses (copy dari .example)
├── accounts.txt.example  # Template accounts
├── .env                  # Configuration (MANDATORY, copy dari .example)
├── .env.example          # Template configuration
├── done_accounts.txt     # Output: akun yang sudah berhasil (append-only, duplicate checker)
├── results/              # JSON result per akun
├── setup.bat             # Setup script (Windows)
├── run.bat               # Run script (Windows)
└── README.md             # This file
```

## 🔧 Troubleshooting

### .env not found
- Copy `.env.example` ke `.env`
- Program tidak akan jalan tanpa `.env`

### Chrome tidak terdeteksi
- Set `CHROME_PATH` di `.env` dengan path Chrome di sistem kamu
- Contoh: `CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe`

### qodercli tidak terinstall

Download dan install Qoder CLI dari website resmi:

1. Kunjungi [https://qoder.com/cli](https://qoder.com/cli)
2. Pilih platform kamu (Windows/macOS/Linux)
3. Download installer yang sesuai
4. Jalankan installer
5. Verifikasi dengan menjalankan: `qodercli --version`

**Atau gunakan command line:**

**Windows (PowerShell):**
```powershell
irm https://qoder.com/install.ps1 | iex
```

**macOS/Linux:**
```bash
curl -fsSL https://qoder.com/install.sh | bash
```

**Catatan:** Qoder CLI biasanya terinstall di `%USERPROFILE%\.qoder\bin\qodercli\`. Script ini akan auto-detect lokasi tersebut.

### qodercli tidak ditemukan di PATH
- Script akan auto-detect di lokasi default: `%USERPROFILE%\.qoder\bin\qodercli\`
- Kalau masih tidak ditemukan, tambahkan lokasi tersebut ke PATH:
  ```cmd
  set PATH=%USERPROFILE%\.qoder\bin\qodercli;%PATH%
  ```

### Login gagal
- Cek email dan password di `accounts.txt`
- Pastikan tidak ada 2FA yang blocking
- Program akan retry otomatis sesuai `MAX_RETRIES` di `.env`
- Cek file JSON di folder `results/` untuk detail error

### Verifikasi HP tidak muncul
- Program sudah kasih jeda 2 menit (default `HP_PROMPT_WAIT=120000`)
- Kalau perlu lebih, edit `HP_PROMPT_WAIT` di `.env`

## 🔐 Security Note

⚠️ **PENTING:** File `accounts.txt` berisi password Google dalam plain text.
- Jangan commit file ini ke git
- Jangan share ke siapapun
- Hapus setelah semua akun berhasil
- Hanya jalankan di komputer pribadi

## 📄 License

MIT

## 🤝 Contributing

Pull requests welcome! Untuk major changes, please open issue dulu.
