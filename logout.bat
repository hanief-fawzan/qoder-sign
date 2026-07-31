@echo off
REM ============================================================
REM  Qoder Sign - Logout
REM  Remove auth token and logout from qodercli
REM ============================================================

cd /d "%~dp0"
echo ============================================================
echo  Qoder Sign - Logout
echo ============================================================
echo.

node index.js logout

echo.
pause
