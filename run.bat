@echo off
REM ============================================================
REM  Qoder Sign - Run
REM  All configuration is in .env
REM ============================================================

cd /d "%~dp0"

REM Check if .env exists
if not exist .env (
    echo [!] ERROR: .env file not found!
    echo     Please copy .env.example to .env and configure it.
    pause
    exit /b 1
)

node index.js
if errorlevel 1 pause
