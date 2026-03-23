@echo off
setlocal

echo Encerrando processo do servidor AGUIA...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'server\\index.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Servidor encerrado (se estava em execucao).
pause
