@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo AGUIA - Inicializacao Segura do Servidor LAN
echo ============================================
echo.

if "%AGUIA_API_TOKEN%"=="" (
  echo [AVISO] Token nao informado. O servidor sera iniciado sem auth de API.
)

if "%AGUIA_ALLOWED_ORIGINS%"=="" (
  set "AGUIA_ALLOWED_ORIGINS=http://127.0.0.1:3000"
)

echo [INFO] Allowed origins: %AGUIA_ALLOWED_ORIGINS%

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-server-secure.ps1" -ApiToken "%AGUIA_API_TOKEN%" -AllowedOrigins "%AGUIA_ALLOWED_ORIGINS%"
