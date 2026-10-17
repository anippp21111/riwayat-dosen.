@echo off
cd /d "%~dp0"
set "NODE_EXE=C:\laragon\bin\nodejs\node-v22\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo Node.js tidak ditemukan. Pastikan fitur Node.js Laragon sudah terpasang.
  pause
  exit /b 1
)
start "Riwayat Dosen PNL - server" /min "%NODE_EXE%" "%CD%\local\server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
