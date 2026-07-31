@echo off
REM ============================================================
REM  Qoder Sign - Login with Interactive Retry
REM  Asks user if they want to retry failed accounts
REM ============================================================

cd /d "%~dp0"
echo ============================================================
echo  Qoder Sign - Login (Interactive Retry Mode)
echo ============================================================
echo.

REM Check if .env exists, if not copy from .env.example
if not exist .env (
    echo [i] Creating .env from template...
    copy .env.example .env >nul
    echo [+] .env created - edit if you want to change settings
    echo.
)

REM Force visible mode and enable interactive retry
set HEADLESS=false
set MAX_RETRIES=3
set AUTO_RETRY=false
node index.js
if errorlevel 1 pause
