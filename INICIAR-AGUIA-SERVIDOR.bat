@echo off
setlocal

cd /d "%~dp0"
if not exist "logs" mkdir "logs"
set "LOG_FILE=%CD%\logs\aguia-startup.log"

echo ==================================================>>"%LOG_FILE%"
echo [%date% %time%] Inicio do launcher AGUIA>>"%LOG_FILE%"

echo ============================================
echo AGUIA - Inicializacao do Servidor LAN
echo ============================================
echo Pasta: %CD%
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [AVISO] pnpm nao encontrado. Tentando iniciar com node diretamente...
  echo [%date% %time%] pnpm nao encontrado. Fallback para node.>>"%LOG_FILE%"
  where node >nul 2>nul
  if errorlevel 1 (
    echo [ERRO] node nao encontrado. Instale Node.js LTS.
    echo [%date% %time%] ERRO: node nao encontrado.>>"%LOG_FILE%"
    pause
    exit /b 1
  )
  if not exist "dist\index.html" (
    echo [ERRO] Build nao encontrado em dist\index.html.
    echo [DICA] No host de implantacao, rode uma vez: pnpm install ^&^& pnpm build
    echo [%date% %time%] ERRO: build nao encontrado em dist\index.html.>>"%LOG_FILE%"
    pause
    exit /b 1
  )

  set "PORT_PID="
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000[ ]" ^| findstr "LISTENING"') do (
    if not defined PORT_PID set "PORT_PID=%%P"
  )

  if defined PORT_PID (
    echo [ERRO] Porta 3000 ja esta em uso por outro processo (PID: %PORT_PID%).
    echo [%date% %time%] ERRO: porta 3000 ocupada (PID: %PORT_PID%).>>"%LOG_FILE%"
    pause
    exit /b 1
  )

  echo [INFO] Iniciando servidor em http://0.0.0.0:3000
  echo [INFO] Para parar, feche esta janela.
  echo [INFO] Log: %LOG_FILE%
  echo.
  node .\server\index.mjs
  set "APP_EXIT=%errorlevel%"
  if not "%APP_EXIT%"=="0" (
    echo [ERRO] Servidor encerrou com codigo %APP_EXIT%.
    echo [ERRO] Veja o log: %LOG_FILE%
    echo [%date% %time%] ERRO: servidor encerrou com codigo %APP_EXIT%.>>"%LOG_FILE%"
    pause
    exit /b %APP_EXIT%
  )
  echo [SUCESSO] Servidor finalizado normalmente.
  echo [%date% %time%] SUCESSO: servidor finalizado normalmente.>>"%LOG_FILE%"
  exit /b 0
)

if not exist "node_modules" (
  echo [INFO] Instalando dependencias na primeira execucao...
  echo [%date% %time%] Instalando dependencias com pnpm.>>"%LOG_FILE%"
  call pnpm install
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    echo [%date% %time%] ERRO: falha no pnpm install.>>"%LOG_FILE%"
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo [INFO] Build nao encontrado. Gerando build...
  echo [%date% %time%] Build nao encontrado. Executando pnpm build.>>"%LOG_FILE%"
  call pnpm build
  if errorlevel 1 (
    echo [ERRO] Falha ao gerar build.
    echo [%date% %time%] ERRO: falha no pnpm build.>>"%LOG_FILE%"
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
  echo [%date% %time%] ERRO: porta 3000 ocupada (PID: %PORT_PID%).>>"%LOG_FILE%"
  echo [INFO] Processo atual na porta:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"ProcessId=%PORT_PID%\" | Select-Object Name, ProcessId, CommandLine | Format-List"
  echo.
  echo [DICA] Se for uma instancia antiga do AGUIA, execute PARAR-AGUIA-SERVIDOR.bat e tente novamente.
  pause
  exit /b 1
)

echo [INFO] Iniciando servidor em http://0.0.0.0:3000
echo [INFO] Para parar, feche esta janela.
echo [INFO] Log: %LOG_FILE%
echo.
call pnpm server
set "APP_EXIT=%errorlevel%"
if not "%APP_EXIT%"=="0" (
  echo [ERRO] Servidor encerrou com codigo %APP_EXIT%.
  echo [ERRO] Veja o log: %LOG_FILE%
  echo [%date% %time%] ERRO: servidor encerrou com codigo %APP_EXIT%.>>"%LOG_FILE%"
  pause
  exit /b %APP_EXIT%
)

echo [SUCESSO] Servidor finalizado normalmente.
echo [%date% %time%] SUCESSO: servidor finalizado normalmente.>>"%LOG_FILE%"
