@echo off
rem Double-click to start the Task Center. Closing this window stops the UI; running tasks continue.
cd /d "%~dp0app"
rem Open the browser once the server has had a moment to start (also works if it is already running).
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:4317/"
node src/cli.ts ui
pause
