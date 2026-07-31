@echo off
REM ============================================================
REM  Qoder Sign - Setup (Non-Admin Mode)
REM  Install Node.js dependencies + check/install qodercli
REM  For users without admin rights - use npm.cmd install (local)
REM ============================================================

echo ============================================================
echo  Qoder Sign - Setup (Non-Admin Mode)
echo ============================================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [!] Node.js not found!
    echo     Install from https://nodejs.org/
    pause
    exit /b 1
)
echo [i] Node.js found:
node --version
echo.

REM Check npm
call npm --version >nul 2>&1
if errorlevel 1 (
    echo [!] npm not found!
    pause
    exit /b 1
)
echo [i] npm found:
call npm --version
echo.

REM Install Node.js dependencies (local, non-admin)
echo [i] Installing Node.js dependencies (local)...
call npm.cmd install
if errorlevel 1 (
    echo [!] Failed to install dependencies
    echo     Make sure you have write permission in this folder
    pause
    exit /b 1
)
echo [+] Dependencies installed
echo.

REM Check qodercli
echo [i] Checking qodercli...
call npx.cmd @qoder-ai/qodercli --version >nul 2>&1
if errorlevel 1 (
    echo [!] qodercli not found!
    echo [i] Installing qodercli locally...
    call npm.cmd install @qoder-ai/qodercli
    if errorlevel 1 (
        echo [!] Failed to install qodercli
        echo     Try manually: npm install @qoder-ai/qodercli
        pause
        exit /b 1
    )
    echo [+] qodercli installed successfully
) else (
    echo [+] qodercli found
)
echo.

REM Copy example files if not exist
if not exist accounts.txt (
    echo [i] Creating accounts.txt from template...
    copy accounts.txt.example accounts.txt >nul
    echo [+] accounts.txt created - please edit with your credentials
)

if not exist .env (
    echo [i] Creating .env from template...
    copy .env.example .env >nul
    echo [+] .env created - edit if you want to change settings
)

echo.
echo ============================================================
echo  Setup complete!
echo ============================================================
echo.
echo  Next steps:
echo    1. Edit accounts.txt with your Google credentials
echo    2. Edit .env to configure settings (optional)
echo    3. Double-click run.bat
echo.
pause
