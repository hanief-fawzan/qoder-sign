@echo off
REM ============================================================
REM  Qoder Sign - Login (Visible Mode)
REM  Browser terlihat untuk handle captcha + klik OK di HP
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

REM Force visible mode (override .env)
set HEADLESS=false
node index.js
if errorlevel 1 pause
