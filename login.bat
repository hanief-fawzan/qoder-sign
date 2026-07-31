@echo off
REM Qoder Sign - Login (Visible Mode)
REM Browser terlihat untuk handle captcha + klik OK di HP
cd /d "%~dp0"
node index.js
if errorlevel 1 pause
