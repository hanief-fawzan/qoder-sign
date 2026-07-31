# Qoder Sign — Auto Login/Logout Qoder CLI via Google SSO

Setiap akun di `accounts.txt` akan:
1. **Login** ke Qoder via Google SSO (Chrome Incognito)
2. **Logout** dari Qoder CLI (`qodercli logout`)
3. Lanjut akun berikutnya

Ada **jeda 2 menit** untuk kamu klik OK di HP (Google verification prompt).

## Anti-Banned Features

- ✅ **Stealth Plugin** — Hide automation fingerprints
- ✅ **Random Delays** — Random timing between actions (anti-pattern detection)
- ✅ **Human Behavior** — Mouse movements, scrolling, typing delays
- ✅ **User Agent Rotation** — Random Chrome versions
- ✅ **Random Viewport** — Different window sizes per account
- ✅ **Incognito Mode** — Clean session per account (no cookies/cache)
- ✅ **System Chrome** — Use your actual Chrome (not Puppeteer's)

## Persyaratan

- **Windows 10/11**
- **Node.js 18+** — https://nodejs.org/
- **Google Chrome** — harus sudah terinstall
- **qodercli** — harus sudah terinstall (`npm install -g @anthropic-ai/qodercli`)

## Cara Pakai

### 1. Setup (pertama kali)
```
setup.bat
```

### 2. Isi `accounts.txt`
```
email1@gmail.com:password1
email2@gmail.com:password2
email3@gmail.com:password3
```

### 3. Jalankan
```
login.bat
```

Browser Chrome akan terbuka dalam **incognito mode**. Setiap akun:
- Auto-fill email + password Google
- **JEDA 2 MENIT** — kalau muncul verifikasi di HP, klik OK di HP kamu
- Login ke Qoder → Logout dari Qoder CLI → lanjut akun berikutnya

### 4. Akun yang sukses
Otomatis pindah dari `accounts.txt` ke `done_accounts.txt`.

## Flow Detail

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

## File

| File | Fungsi |
|------|--------|
| `accounts.txt` | Isi akun di sini (email:password) |
| `done_accounts.txt` | Akun yang sudah berhasil (auto) |
| `results/` | Screenshot + JSON per akun |
| `login.bat` | Jalankan program |
| `logout.bat` | Logout manual dari qodercli |
| `setup.bat` | Install dependencies |

## Security Note

⚠️ File `accounts.txt` berisi password Google dalam plain text. Jangan share ke siapapun!
