@echo off
REM ============================================================
REM  Qoder Sign - Setup
REM  Install Node.js dependencies
REM ============================================================

echo ============================================================
echo  Qoder Sign - Setup
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

REM Install dependencies
echo [i] Installing dependencies...
call npm install
if errorlevel 1 (
    echo [!] Failed to install dependencies
    pause
    exit /b 1
)
echo [+] Dependencies installed
echo.

echo ============================================================
echo  Setup complete!
echo ============================================================
echo.
echo  Next steps:
echo    1. Edit accounts.txt with your Google credentials
echo    2. Double-click login.bat
echo.
pause
