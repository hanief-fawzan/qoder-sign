# Qoder Sign — Auto Login/Logout Qoder CLI via Google SSO

Automasi login/logout Qoder CLI menggunakan Google SSO dengan Chrome Incognito. Setiap akun akan login, lalu logout otomatis, dengan jeda untuk verifikasi HP.

## ✨ Fitur

- 🔄 **Auto Login/Logout** — Setiap akun login ke Qoder, lalu logout via `qodercli logout`
- 🕵️ **Stealth Mode** — Anti-detection dengan puppeteer-extra-plugin-stealth
- 🌐 **System Chrome** — Menggunakan Chrome yang sudah terinstall (bukan Puppeteer Chrome)
- 🎭 **Incognito Mode** — Setiap akun pakai Chrome Incognito (clean session)
- 🤖 **Human Behavior** — Mouse movements, random delays, typing simulation
- 📱 **HP Verification Support** — Jeda 2 menit untuk verifikasi di HP
- 📊 **Account Management** — Auto-move akun sukses ke `done_accounts.txt`

## 📋 Persyaratan

- **Windows 10/11**
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Google Chrome** — Harus terinstall di sistem
- **qodercli** — Akan diinstall otomatis atau manual: `npm install -g @anthropic-ai/qodercli`

## 🚀 Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/hanief-fawzan/qoder-sign.git
cd qoder-sign
```

### 2. Install Dependencies

**Windows (Recommended):**
```bash
setup.bat
```

**Manual:**
```bash
npm install
```

### 3. Setup accounts.txt

**Copy from template:**
```bash
copy accounts.txt.example accounts.txt
```

### 4. Setup .env (Optional)

Jika ingin mengubah konfigurasi (timeout, delay, dll), copy file `.env.example`:

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
```

**Catatan:**
- File `.env` bersifat **optional**. Jika tidak ada, program akan menggunakan default values.
- `setup.bat` akan otomatis copy `.env.example` ke `.env` jika belum ada.
- `login.bat` dan `login-headless.bat` juga akan auto-create `.env` jika belum ada.

### 5. Verify Installation

Pastikan semua requirements terpenuhi:
- ✅ Node.js terinstall (`node --version`)
- ✅ Google Chrome terinstall
- ✅ qodercli terinstall (`npx qodercli --version`)

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
login.bat
```

**Manual:**
```bash
node index.js
```

### 3. Proses Otomatis

Program akan:
1. Buka Chrome Incognito
2. Navigate ke Qoder login page
3. Klik "Sign in with Google"
4. Auto-fill email dan password
5. **JEDA 2 MENIT** — Kalau muncul verifikasi di HP, klik OK di HP kamu
6. Login ke Qoder berhasil
7. Logout dari Qoder CLI (`qodercli logout`)
8. Pindah akun ke `done_accounts.txt`
9. Lanjut ke akun berikutnya

### 5. Cek Hasil

- **Akun sukses:** Ada di `done_accounts.txt`
- **Akun gagal:** Tetap di `accounts.txt` (bisa retry)
- **Screenshot error:** Ada di folder `results/`

## 🔄 Workflow

```
Account 1:
  ├─ Chrome Incognito (clean session)
  ├─ Random User Agent + Viewport
  ├─ Human-like typing + mouse movements
  ├─ Login Google SSO
  ├─ Wait for HP verification (2 min)
  ├─ Login to Qoder
  ├─ qodercli logout (terminal command)
  └─ Close incognito window

Account 2:
  ├─ New Chrome Incognito (clean session)
  ├─ Different User Agent + Viewport
  ├─ Random delays (anti-pattern)
  └─ ... same flow

Account 3:
  └─ ... same flow
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
├── .env                  # Configuration (copy dari .example, optional)
├── .env.example          # Template configuration
├── done_accounts.txt     # Output: akun yang sudah berhasil
├── results/              # Screenshot & JSON per akun
├── setup.bat             # Setup script (Windows)
├── login.bat             # Run script (Windows)
├── logout.bat            # Manual logout (Windows)
└── README.md             # This file
```

## 🔧 Troubleshooting

### Chrome tidak terdeteksi
- Pastikan Google Chrome terinstall di path default
- Atau edit `findSystemChrome()` di `index.js`

### qodercli tidak terinstall
```bash
npm install -g @anthropic-ai/qodercli
```

### Login gagal
- Cek email dan password di `accounts.txt`
- Cek screenshot di folder `results/`
- Pastikan tidak ada 2FA yang blocking

### Verifikasi HP tidak muncul
- Program sudah kasih jeda 2 menit
- Kalau perlu lebih, edit `HP_PROMPT_WAIT` di `index.js`

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
