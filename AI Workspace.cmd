@echo off
rem Double-click to open AI Workspace. Running tasks continue when the window closes.
cd /d "%~dp0app"
if not exist node_modules\electron\dist\electron.exe (
  echo First start: installing dependencies...
  call npm install || (pause & exit /b 1)
)
rem npm may skip Electron's download script; fetch the binary directly if it is still missing.
if not exist node_modules\electron\dist\electron.exe (
  node node_modules\electron\install.js || (pause & exit /b 1)
)
rem Start menu and Desktop shortcuts open the app without this console window; rewritten each run so a moved repo stays valid.
powershell -NoProfile -Command "$s = New-Object -ComObject WScript.Shell; foreach ($d in [Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop')) { $l = $s.CreateShortcut((Join-Path $d 'AI Workspace.lnk')); $l.TargetPath = '%CD%\node_modules\electron\dist\electron.exe'; $l.Arguments = '\"%CD%\"'; $l.WorkingDirectory = '%CD%'; $l.Description = 'AI Workspace'; $l.Save() }"
start "" "node_modules\electron\dist\electron.exe" .
