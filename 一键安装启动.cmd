@echo off
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer from https://nodejs.org/
  pause
  exit /b 1
)
node scripts/install.mjs
if errorlevel 1 pause
