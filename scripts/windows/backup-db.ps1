param(
  [string]$ProjectRoot = "",
  [string]$BackupRoot = "",
  [int]$KeepDays = 30
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $ProjectRoot "backups\db"
}

$dbFile = Join-Path $ProjectRoot "server\data\db.json"
if (!(Test-Path $dbFile)) {
  throw "Banco nao encontrado: $dbFile"
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$tmpJson = Join-Path $BackupRoot ("db_" + $stamp + ".json")
$zipFile = Join-Path $BackupRoot ("db_" + $stamp + ".zip")

Copy-Item -Path $dbFile -Destination $tmpJson -Force

Compress-Archive -Path $tmpJson -DestinationPath $zipFile -Force
Remove-Item -Path $tmpJson -Force

$limit = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem -Path $BackupRoot -Filter "db_*.zip" |
  Where-Object { $_.LastWriteTime -lt $limit } |
  Remove-Item -Force

Write-Host "Backup criado: $zipFile"
Write-Host "Retencao aplicada: $KeepDays dia(s)"
