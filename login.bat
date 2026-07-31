@echo off
REM ============================================================
REM  Qoder Sign - Login (Visible Mode)
REM  Browser terlihat untuk handle captcha + klik OK di HP
REM  Smart retry: auto-ask jika ada akun gagal
REM ============================================================

cd /d "%~dp0"
echo ============================================================
echo  Qoder Sign - Login (Visible Mode)
echo ============================================================
echo.

REM Check if .env exists, if not copy from .env.example
if not exist .env (
    echo [i] Creating .env from template...
    copy .env.example .env >nul
    echo [+] .env created - edit if you want to change settings
    echo.
)

REM Force visible mode
set HEADLESS=false

:RUN_LOGIN
node index.js

REM Check if accounts.txt still has content (failed accounts)
findstr /r /c:"^[^#]" accounts.txt >nul 2>&1
if errorlevel 1 (
    echo.
    echo [i] All accounts processed successfully!
    pause
    exit /b 0
)

REM There are still accounts in accounts.txt (failed ones)
echo.
echo ============================================================
echo  Some accounts failed. They are still in accounts.txt.
echo ============================================================
echo.
set /p RETRY="Retry failed accounts? (y/n): "
if /i "%RETRY%"=="y" (
    echo.
    echo [i] Retrying...
    echo.
    goto RUN_LOGIN
) else (
    echo.
    echo [i] Skipping retry. Failed accounts remain in accounts.txt.
    pause
)
