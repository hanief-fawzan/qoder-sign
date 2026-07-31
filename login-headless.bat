@echo off
REM ============================================================
REM  Qoder Sign - Login (HEADLESS mode)
REM  Browser runs in background, no visible window
REM ============================================================

cd /d "%~dp0"
echo ============================================================
echo  Qoder Sign - Login (Headless Mode)
echo ============================================================
echo.
echo  Browser will run in HEADLESS mode (no visible window)
echo.

node index.js login --headless

if errorlevel 1 (
    echo.
    echo [!] Login failed. Check the output above.
    pause
    exit /b 1
)

echo.
pause
