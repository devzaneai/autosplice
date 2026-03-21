@echo off
REM AutoSplice Installer for Windows

set DEST=%APPDATA%\Adobe\CEP\extensions\autosplice

echo === AutoSplice Installer ===
echo.
echo Installing to: %DEST%
echo.

mkdir "%DEST%" 2>nul

if exist "dist\cep" (
    xcopy /E /Y "dist\cep\*" "%DEST%\"
) else if exist "cep" (
    xcopy /E /Y "cep\*" "%DEST%\"
) else (
    echo ERROR: Could not find built extension.
    echo If you downloaded a release, unzip it and run this script from inside the folder.
    echo If you're building from source, run "npm run build" first.
    exit /b 1
)

echo.
echo Installation complete!
echo.
echo Next steps:
echo   1. Restart Adobe Premiere Pro
echo   2. Go to Window ^→ Extensions ^→ AutoSplice
echo.
