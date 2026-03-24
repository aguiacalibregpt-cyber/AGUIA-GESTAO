param(
  [Parameter(Mandatory = $true)]
  [string]$ApiToken,
  [string]$AllowedOrigins = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host "============================================"
Write-Host "AGUIA - Inicializacao Segura do Servidor LAN"
Write-Host "============================================"
Write-Host "Pasta: $repoRoot"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm nao encontrado. Instale Node.js LTS + pnpm."
}

if (-not (Test-Path "node_modules")) {
  Write-Host "[INFO] Instalando dependencias..."
  pnpm install
}

if (-not (Test-Path "dist/index.html")) {
  Write-Host "[INFO] Build nao encontrado. Gerando build..."
  pnpm build
}

$env:AGUIA_API_TOKEN = $ApiToken
$env:AGUIA_ALLOWED_ORIGINS = $AllowedOrigins

Write-Host "[INFO] AGUIA_API_TOKEN configurado."
Write-Host "[INFO] AGUIA_ALLOWED_ORIGINS=$AllowedOrigins"
Write-Host "[INFO] Iniciando servidor em http://0.0.0.0:3000"

pnpm server
