@echo off
REM ===========================================================================
REM  MediNova EHR prototype — double-click this file to view it.
REM
REM  Why a server is needed at all: the components are ES modules, and every
REM  browser refuses to load those from a file:// page. This starts a small
REM  local web server and opens the prototype. Close this window to stop it.
REM ===========================================================================

cd /d "%~dp0"

echo Starting the MediNova prototype...
echo.
echo   Start here       http://127.0.0.1:4173/          (sign in, then the schedule)
echo   Component gallery  http://127.0.0.1:4173/gallery.html
echo   Patient screen   http://127.0.0.1:4173/screens/patient-directory.html
echo.
echo Keep this window open. Close it to stop the server.
echo.

REM Give the server a moment to bind before the browser opens.
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4173/"

npx --yes http-server . -p 4173 -c-1
