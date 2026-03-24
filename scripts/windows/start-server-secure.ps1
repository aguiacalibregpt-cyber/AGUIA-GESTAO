param(
  [string]$ApiToken = "",
  [string]$AllowedOrigins = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host "============================================"
Write-Host "AGUIA - Inicializacao Segura do Servidor LAN"
Write-Host "============================================"
Write-Host "Pasta: $repoRoot"

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  throw "node nao encontrado. Instale Node.js LTS."
}

if ($pnpm) {
  if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Instalando dependencias..."
    pnpm install
  }

  if (-not (Test-Path "dist/index.html")) {
    Write-Host "[INFO] Build nao encontrado. Gerando build..."
    pnpm build
  }
} elseif (-not (Test-Path "dist/index.html")) {
  throw "Build nao encontrado em dist/index.html e pnpm nao esta disponivel para gerar build."
}

$env:AGUIA_API_TOKEN = $ApiToken.Trim()
$env:AGUIA_ALLOWED_ORIGINS = $AllowedOrigins

if ([string]::IsNullOrWhiteSpace($env:AGUIA_API_TOKEN)) {
  Write-Host "[AVISO] AGUIA_API_TOKEN vazio. Auth API desabilitada para esta execucao."
} else {
  Write-Host "[INFO] AGUIA_API_TOKEN configurado."
}
Write-Host "[INFO] AGUIA_ALLOWED_ORIGINS=$AllowedOrigins"
Write-Host "[INFO] Iniciando servidor em http://0.0.0.0:3000"

if ($pnpm) {
  pnpm server
} else {
  node .\server\index.mjs
}
