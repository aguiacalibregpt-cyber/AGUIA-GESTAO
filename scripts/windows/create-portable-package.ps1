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

# Nao inclui dados/sigilo da instalacao de origem no pacote portatil.
$serverDataDir = Join-Path $OutDir "server\data"
New-Item -ItemType Directory -Force -Path $serverDataDir | Out-Null

$sensiveis = @(
  "db.json",
  "db.json.tmp",
  ".security-secret"
)

foreach ($nome in $sensiveis) {
  $alvo = Join-Path $serverDataDir $nome
  if (Test-Path $alvo) {
    Remove-Item -Path $alvo -Force -ErrorAction SilentlyContinue
  }
}

$notaDados = Join-Path $serverDataDir "LEIA-ME-DADOS.txt"
@"
Esta pasta armazena os dados da instalacao (db.json).

Atualizacao segura:
1) Faca backup antes de atualizar.
2) Nao sobrescreva o arquivo server\\data\\db.json da instalacao em uso.
3) Se o arquivo nao existir, o servidor criara um novo automaticamente no primeiro start.
"@ | Set-Content -Path $notaDados -Encoding UTF8

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

Importante:
- Este pacote NAO inclui server\\data\\db.json nem .security-secret.
- Em atualizacoes, preserve o server\\data\\db.json da instalacao existente.
"@ | Set-Content -Path $readme -Encoding UTF8

Write-Host "Pacote criado em: $OutDir"
