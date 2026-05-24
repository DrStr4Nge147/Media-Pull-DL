@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo =================================================================
echo Media-Pull DL Electron Dev Mode
echo =================================================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found on PATH.
    pause
    exit /b 1
)

if not exist package.json (
    echo [ERROR] package.json was not found.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [ERROR] node_modules was not found. Run npm install first.
    pause
    exit /b 1
)

echo Starting Electron dev mode...
echo.
call npm run electron:dev
if errorlevel 1 (
    echo.
    echo [ERROR] Electron dev mode exited with an error.
    pause
    exit /b 1
)

echo.
echo Electron dev mode stopped.
pause

endlocal
