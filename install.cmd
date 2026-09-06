@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. See the message above.
  pause
  exit /b 1
)
echo.
echo Agent Treasury is ready.
pause
