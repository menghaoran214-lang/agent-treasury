@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\service-control.ps1" -Action start
if errorlevel 1 exit /b 1
start "" "http://127.0.0.1:3333"
