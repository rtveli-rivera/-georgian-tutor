@echo off
REM ===============================================================
REM  Kartuli Coach - local launcher (Windows)
REM  Serves the app on http://localhost:8144 and opens your browser.
REM  Keep this window open while you use the app; close it to stop.
REM ===============================================================
cd /d "%~dp0"

set PORT=8144

echo Starting Kartuli Coach on http://localhost:%PORT% ...
start "" "http://localhost:%PORT%/index.html"

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server %PORT% --bind 127.0.0.1
) else (
  python -m http.server %PORT% --bind 127.0.0.1
)
