param(
  [string]$ProjectRoot = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path $ProjectRoot "release\AGUIA-SERVIDOR-LAN"
}

$dist = Join-Path $ProjectRoot "dist"
if (!(Test-Path $dist)) {
  throw "Build nao encontrado em: $dist. Rode: pnpm build"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$items = @(
  "dist",
  "server",
  "package.json",
  "pnpm-lock.yaml",
  "INICIAR-AGUIA-SERVIDOR.bat",
  "INICIAR-AGUIA-SERVIDOR-OCULTO.vbs",
  "PARAR-AGUIA-SERVIDOR.bat",
  "scripts\\windows"
)

foreach ($item in $items) {
  $src = Join-Path $ProjectRoot $item
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination $OutDir -Recurse -Force
  }
}

$readme = Join-Path $OutDir "LEIA-ME-PRIMEIRO.txt"
@"
PACOTE PORTATIL AGUIA (HOST LOCAL)

1) Instale Node.js LTS no computador host.
2) Abra INICIAR-AGUIA-SERVIDOR-SEGURO.bat.
3) No primeiro uso, aguarde instalar dependencias.
4) Acesse no navegador: http://IP-DO-HOST:3000

Observacao:
- O launcher seguro tenta pnpm e, se houver falha de ambiente no Windows, alterna para npm automaticamente.

Backup manual:
powershell -ExecutionPolicy Bypass -File .\scripts\windows\backup-db.ps1
"@ | Set-Content -Path $readme -Encoding UTF8

Write-Host "Pacote criado em: $OutDir"
