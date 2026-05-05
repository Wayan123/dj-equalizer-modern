@echo off
setlocal
title Modern Audio Enhancer - Launcher

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%" >nul 2>&1
if errorlevel 1 (
  echo Failed to enter project directory: %SCRIPT_DIR%
  echo If this file is opened from \\wsl.localhost, create a Windows shortcut or run it from this directory.
  pause
  exit /b 1
)
set "PROJECT_DIR=%CD%"
if defined SystemRoot cd /d "%SystemRoot%" >nul 2>&1

echo ============================================
echo    MODERN AUDIO ENHANCER - One-Click Start
echo ============================================
echo.
echo Starting WSL with conda environment...
echo.

set MODE=%~1
if "%MODE%"=="" set MODE=windows

echo Launch mode: %MODE%
echo.

if /I "%MODE%"=="build-exe" goto build_exe
if /I "%MODE%"=="exe" goto build_exe
if /I "%MODE%"=="windows" goto windows_app
if /I "%MODE%"=="app" goto windows_app

for /f "usebackq delims=" %%I in (`wsl.exe -e wslpath -a "%PROJECT_DIR%"`) do set "WSL_PROJECT_DIR=%%I"
if not defined WSL_PROJECT_DIR (
  echo Failed to resolve WSL project path.
  pause
  exit /b 1
)
wsl -e bash -lc "cd \"%WSL_PROJECT_DIR%\" && ./scripts/dev.sh %MODE%"
goto done

:windows_app
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\windows-start.ps1" -RepoPath "%PROJECT_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"
if errorlevel 1 (
  echo.
  echo Failed to start Windows app session.
  pause
)
goto finish

:build_exe
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\scripts\build-windows-exe.ps1" -RepoPath "%PROJECT_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"
if errorlevel 1 (
  echo.
  echo Failed to build Windows EXE.
  pause
)
goto finish

:done
set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo Modern Audio Enhancer has stopped.
pause

:finish
popd >nul 2>&1
endlocal & exit /b %EXIT_CODE%
