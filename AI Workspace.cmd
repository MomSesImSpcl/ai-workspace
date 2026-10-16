@echo off
rem Double-click to open AI Workspace. Running tasks continue when the window closes.
cd /d "%~dp0app"
if not exist node_modules\electron\dist\electron.exe (
  echo First start: installing dependencies...
  call npm install || (pause & exit /b 1)
)
start "" "node_modules\electron\dist\electron.exe" .
