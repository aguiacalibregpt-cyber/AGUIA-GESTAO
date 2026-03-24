@echo off
setlocal

echo Encerrando processo do servidor AGUIA...

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000[ ]" ^| findstr "LISTENING"') do (
	taskkill /PID %%P /F >nul 2>nul
)

for /f "tokens=2 delims=:" %%C in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$alvos = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ( $_.CommandLine -match 'server\\index.mjs' -or $_.CommandLine -match 'pnpm.*server' -or $_.CommandLine -match 'aguia' ) }; $qtd = @($alvos).Count; $alvos | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Output ('KILLED:' + $qtd)"') do set "KILLED=%%C"

if not defined KILLED set "KILLED=0"
echo Servidor encerrado. Processos finalizados: %KILLED%
pause
