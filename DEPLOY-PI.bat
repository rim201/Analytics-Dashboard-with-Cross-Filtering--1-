@echo off
chcp 65001 >nul
title Deploiement Raspberry Pi
cd /d "%~dp0"

echo.
echo  ========================================
echo   Deploiement Pi (scripts\pi -^> Raspberry)
echo  ========================================
echo   Placez d'abord dans scripts\pi\ :
echo   - agent_config.json, sensor_agent.py, install.sh
echo   - serviceAccountKey.json (Firebase)
echo.

node scripts\deploy-pi.cjs %*
set ERR=%ERRORLEVEL%

echo.
if %ERR% neq 0 (
  echo Erreur code %ERR%
) else (
  echo OK.
)
pause
exit /b %ERR%
