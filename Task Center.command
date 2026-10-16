#!/usr/bin/env bash
# Double-click to start the Task Center on macOS (Linux: run it, or allow executing it in your file manager).
# Closing this window stops the UI; running tasks continue.
cd "$(dirname "$0")/app" || exit 1
url=http://127.0.0.1:4317/
# Open the browser once the server has had a moment to start (also works if it is already running).
(sleep 2; if command -v open >/dev/null; then open "$url"; else xdg-open "$url"; fi) >/dev/null 2>&1 &
node src/cli.ts ui
