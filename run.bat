@echo off
REM ============================================================
REM  Qoder Sign - Launcher
REM  Jalankan program auto login/logout Qoder CLI
REM ============================================================

echo ============================================================
echo  Qoder Sign - Google SSO Auto Login
echo ============================================================
echo.

cd /d "%~dp0"

REM Jalankan script
python qoder_auto_auth.py %*
if errorlevel 1 (
    echo.
    echo [!] Ada error. Pastikan sudah jalankan setup.bat dulu.
    pause
    exit /b 1
)

echo.
pause
