param(
  [string]$TaskName = "AGUIA-Backup-Diario"
)

$ErrorActionPreference = "Stop"

schtasks /Delete /TN $TaskName /F | Out-Null
Write-Host "Tarefa removida: $TaskName"
