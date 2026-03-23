param(
  [string]$TaskName = "AGUIA-Backup-Diario",
  [string]$ProjectRoot = "",
  [string]$BackupTime = "18:00",
  [int]$KeepDays = 30
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$script = Join-Path $ProjectRoot "scripts\windows\backup-db.ps1"
if (!(Test-Path $script)) {
  throw "Script nao encontrado: $script"
}

$tr = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -ProjectRoot "' + $ProjectRoot + '" -KeepDays ' + $KeepDays

schtasks /Create /TN $TaskName /SC DAILY /ST $BackupTime /TR $tr /F | Out-Null

Write-Host "Tarefa de backup criada: $TaskName"
Write-Host "Horario diario: $BackupTime"
Write-Host "Retencao: $KeepDays dia(s)"
