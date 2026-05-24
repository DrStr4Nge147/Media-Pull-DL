@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo =================================================================
echo Media-Pull DL Electron Deployment Builder
echo =================================================================
echo.
echo This builds the dist_electron deployment artifacts:
echo   - Portable EXE
echo   - Setup EXE
echo   - ZIP
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

echo [1/2] Running Electron build...
call npm run build:electron
if errorlevel 1 (
    echo.
    echo [ERROR] Electron build failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Build artifacts in dist_electron:
echo.

if not exist dist_electron (
    echo [ERROR] dist_electron was not created.
    pause
    exit /b 1
)

set "FOUND_ARTIFACTS="

for %%F in (
    "dist_electron\Media-Pull.DL.Portable.v*.exe"
    "dist_electron\Media-Pull.DL.Setup.v*.exe"
    "dist_electron\Media-Pull.DL.v*.zip"
) do (
    for %%A in (%%~F) do (
        if exist "%%~A" (
            set "FOUND_ARTIFACTS=1"
            echo   %%~nxA
        )
    )
)

if not defined FOUND_ARTIFACTS (
    echo [WARN] No deployment artifacts matched the expected names.
    echo        Check dist_electron manually for generated files.
) else (
    echo.
    echo Done. Deployment files are ready in dist_electron.
)

echo.
pause

endlocal
