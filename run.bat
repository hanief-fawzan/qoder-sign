@echo off
REM ============================================================
REM  Qoder Sign - Run
REM  All configuration is in .env
REM ============================================================

cd /d "%~dp0"

REM Add qodercli to PATH if it exists in common locations
if exist "%USERPROFILE%\.qoder\bin\qodercli\qodercli.exe" (
    set "PATH=%USERPROFILE%\.qoder\bin\qodercli;%PATH%"
) else if exist "%LOCALAPPDATA%\qoder\bin\qodercli\qodercli.exe" (
    set "PATH=%LOCALAPPDATA%\qoder\bin\qodercli;%PATH%"
)

REM Check if .env exists
if not exist .env (
    echo [!] ERROR: .env file not found!
    echo     Please copy .env.example to .env and configure it.
    pause
    exit /b 1
)

node index.js
if errorlevel 1 pause
