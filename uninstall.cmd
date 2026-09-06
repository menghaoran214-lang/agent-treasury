@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall.ps1"
if errorlevel 1 (
  echo.
  echo Uninstall failed. See the message above.
  pause
  exit /b 1
)
pause
