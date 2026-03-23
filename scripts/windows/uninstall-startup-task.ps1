param(
  [string]$TaskName = "AGUIA-Servidor-Autostart"
)

$ErrorActionPreference = "Stop"

schtasks /Delete /TN $TaskName /F | Out-Null
Write-Host "Tarefa removida: $TaskName"
