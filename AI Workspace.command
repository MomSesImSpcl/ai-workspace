#!/usr/bin/env bash
# Double-click to open AI Workspace on macOS (Linux: run it, or allow executing it in your file manager).
# Running tasks continue when the window closes.
cd "$(dirname "$0")/app" || exit 1
[ -x node_modules/.bin/electron ] || npm install || exit 1
exec node_modules/.bin/electron .
