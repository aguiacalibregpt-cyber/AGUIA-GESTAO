@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo AGUIA - Inicializacao do Servidor LAN
echo ============================================
echo Pasta: %CD%
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [AVISO] pnpm nao encontrado. Tentando iniciar com node diretamente...
  where node >nul 2>nul
  if errorlevel 1 (
    echo [ERRO] node nao encontrado. Instale Node.js LTS.
    pause
    exit /b 1
  )
  if not exist "dist\index.html" (
    echo [ERRO] Build nao encontrado em dist\index.html.
    echo [DICA] No host de implantacao, rode uma vez: pnpm install ^&^& pnpm build
    pause
    exit /b 1
  )

  set "PORT_PID="
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000[ ]" ^| findstr "LISTENING"') do (
    if not defined PORT_PID set "PORT_PID=%%P"
  )

  if defined PORT_PID (
    echo [ERRO] Porta 3000 ja esta em uso por outro processo (PID: %PORT_PID%).
    pause
    exit /b 1
  )

  echo [INFO] Iniciando servidor em http://0.0.0.0:3000
  echo [INFO] Para parar, feche esta janela.
  echo.
  node .\server\index.mjs
  exit /b %errorlevel%
)

if not exist "node_modules" (
  echo [INFO] Instalando dependencias na primeira execucao...
  call pnpm install
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo [INFO] Build nao encontrado. Gerando build...
  call pnpm build
  if errorlevel 1 (
    echo [ERRO] Falha ao gerar build.
    pause
    exit /b 1
  )
)

set "PORT_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000[ ]" ^| findstr "LISTENING"') do (
  if not defined PORT_PID set "PORT_PID=%%P"
)

if defined PORT_PID (
  echo [ERRO] Porta 3000 ja esta em uso por outro processo (PID: %PORT_PID%).
  echo [INFO] Processo atual na porta:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"ProcessId=%PORT_PID%\" | Select-Object Name, ProcessId, CommandLine | Format-List"
  echo.
  echo [DICA] Se for uma instancia antiga do AGUIA, execute PARAR-AGUIA-SERVIDOR.bat e tente novamente.
  pause
  exit /b 1
)

echo [INFO] Iniciando servidor em http://0.0.0.0:3000
echo [INFO] Para parar, feche esta janela.
echo.
call pnpm server
