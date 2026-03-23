param(
  [string]$TaskName = "AGUIA-Servidor-Autostart",
  [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$starter = Join-Path $ProjectRoot "INICIAR-AGUIA-SERVIDOR.bat"
if (!(Test-Path $starter)) {
  throw "Arquivo nao encontrado: $starter"
}

$tr = '"' + $starter + '"'

schtasks /Create /TN $TaskName /SC ONLOGON /TR $tr /F | Out-Null
Write-Host "Tarefa criada com sucesso: $TaskName"
Write-Host "Arquivo de inicializacao: $starter"
Write-Host "Proximo login no Windows: servidor inicia automaticamente."
