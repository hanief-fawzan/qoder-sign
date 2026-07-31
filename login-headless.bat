@echo off
REM ============================================================
REM  Qoder Sign - Login (Headless Mode)
REM  Browser runs in background, no visible window
REM ============================================================

cd /d "%~dp0"
echo ============================================================
echo  Qoder Sign - Login (Headless Mode)
echo ============================================================
echo.

REM Check if .env exists, if not copy from .env.example
if not exist .env (
    echo [i] Creating .env from template...
    copy .env.example .env >nul
    echo [+] .env created
    echo.
)

REM Override HEADLESS to true via command line
set HEADLESS=true
node index.js
if errorlevel 1 pause
