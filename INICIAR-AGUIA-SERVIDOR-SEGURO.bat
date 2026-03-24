@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo AGUIA - Inicializacao Segura do Servidor LAN
echo ============================================
echo.

if "%AGUIA_API_TOKEN%"=="" (
  set /p AGUIA_API_TOKEN=Informe o AGUIA_API_TOKEN: 
)

if "%AGUIA_API_TOKEN%"=="" (
  echo [ERRO] Token nao informado.
  pause
  exit /b 1
)

if "%AGUIA_ALLOWED_ORIGINS%"=="" (
  set "AGUIA_ALLOWED_ORIGINS=http://127.0.0.1:3000"
)

echo [INFO] Allowed origins: %AGUIA_ALLOWED_ORIGINS%

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-server-secure.ps1" -ApiToken "%AGUIA_API_TOKEN%" -AllowedOrigins "%AGUIA_ALLOWED_ORIGINS%"
