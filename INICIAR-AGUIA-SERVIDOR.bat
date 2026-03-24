@echo off
setlocal

cd /d "%~dp0"
if not exist "logs" mkdir "logs"
set "LOG_FILE=%CD%\logs\aguia-startup.log"
for /f %%A in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path '%LOG_FILE%') { (Get-Item '%LOG_FILE%').Length } else { 0 }"') do set "LOG_SIZE=%%A"
if defined LOG_SIZE if %LOG_SIZE% GTR 1048576 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$l = Get-Content '%LOG_FILE%' -ErrorAction SilentlyContinue; if ($l) { $l | Select-Object -Last 500 | Set-Content '%LOG_FILE%' }"
)

echo ==================================================>>"%LOG_FILE%"
echo [%date% %time%] Inicio do launcher AGUIA>>"%LOG_FILE%"

echo ============================================
echo AGUIA - Inicializacao do Servidor LAN
echo ============================================
echo Pasta: %CD%
echo.
if "%AGUIA_ALLOWED_ORIGINS%"=="" (
  set "AGUIA_ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000,http://0.0.0.0:3000"
)

echo [INFO] Delegando inicializacao para o modo robusto (scripts\windows\start-server-secure.ps1)
echo [INFO] Allowed origins: %AGUIA_ALLOWED_ORIGINS%
echo [%date% %time%] INFO: delegando inicializacao para start-server-secure.ps1>>"%LOG_FILE%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-server-secure.ps1" -ApiToken "%AGUIA_API_TOKEN%" -AllowedOrigins "%AGUIA_ALLOWED_ORIGINS%"
set "APP_EXIT=%errorlevel%"

if not "%APP_EXIT%"=="0" (
  echo [ERRO] Falha ao iniciar servidor. Codigo %APP_EXIT%.
  echo [ERRO] Verifique o log: %CD%\logs\aguia-startup-secure.log
  echo [%date% %time%] ERRO: inicio falhou com codigo %APP_EXIT%.>>"%LOG_FILE%"
  pause
  exit /b %APP_EXIT%
)

echo [SUCESSO] Execucao concluida sem erros.
echo [%date% %time%] SUCESSO: inicializacao concluida.>>"%LOG_FILE%"
