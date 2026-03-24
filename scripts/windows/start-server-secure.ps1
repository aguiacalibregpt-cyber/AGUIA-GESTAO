param(
  [string]$ApiToken = "",
  [string]$AllowedOrigins = "http://127.0.0.1:3000,http://localhost:3000,http://0.0.0.0:3000"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$logDir = Join-Path $repoRoot "logs"
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir "aguia-startup-secure.log"

if (Test-Path $logFile) {
  $tam = (Get-Item $logFile).Length
  if ($tam -gt 1048576) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $rot = Join-Path $logDir ("aguia-startup-secure-" + $stamp + ".log")
    Move-Item -Path $logFile -Destination $rot -Force
    $antigos = Get-ChildItem -Path $logDir -Filter "aguia-startup-secure-*.log" | Sort-Object LastWriteTime -Descending
    if ($antigos.Count -gt 5) {
      $antigos | Select-Object -Skip 5 | Remove-Item -Force -ErrorAction SilentlyContinue
    }
  }
}

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $logFile -Value $line
  Write-Host $Message
}

function Invoke-PnpmInstallWithRetry {
  param(
    [switch]$IncludeDevDependencies
  )

  $args = @('install')
  if (-not $IncludeDevDependencies) {
    $args += '--prod'
  }

  for ($tentativa = 1; $tentativa -le 2; $tentativa++) {
    Write-Log "[INFO] Executando: pnpm $($args -join ' ') (tentativa $tentativa/2)"
    & pnpm @args
    if ($LASTEXITCODE -eq 0) {
      return
    }

    if ($tentativa -eq 1) {
      Write-Log "[AVISO] pnpm install falhou (codigo $LASTEXITCODE). Tentando recuperacao automatica..."
      if (Test-Path "node_modules") {
        cmd /c "rmdir /s /q node_modules" | Out-Null
      }
      & pnpm store prune | Out-Null
    }
  }

  throw "Falha no pnpm install apos tentativas de recuperacao."
}

Write-Log "============================================"
Write-Log "AGUIA - Inicializacao Segura do Servidor LAN"
Write-Log "============================================"
Write-Log "Pasta: $repoRoot"
Write-Log "Log: $logFile"

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  Write-Log "[ERRO] node nao encontrado. Instale Node.js LTS."
  exit 1
}

try {
  if ($pnpm) {
    if (-not (Test-Path "node_modules")) {
      Write-Log "[INFO] Instalando dependencias..."
      Invoke-PnpmInstallWithRetry -IncludeDevDependencies
    }

    if (-not (Test-Path "dist/index.html")) {
      Write-Log "[INFO] Build nao encontrado. Gerando build..."
      pnpm build
      if ($LASTEXITCODE -ne 0) {
        throw "Falha no pnpm build (codigo $LASTEXITCODE)."
      }
    }
  } elseif (-not (Test-Path "dist/index.html")) {
    throw "Build nao encontrado em dist/index.html e pnpm nao esta disponivel para gerar build."
  }

  $env:AGUIA_API_TOKEN = $ApiToken.Trim()
  $env:AGUIA_ALLOWED_ORIGINS = $AllowedOrigins

  if ([string]::IsNullOrWhiteSpace($env:AGUIA_API_TOKEN)) {
    Write-Log "[AVISO] AGUIA_API_TOKEN vazio. Auth API desabilitada para esta execucao."
  } else {
    Write-Log "[INFO] AGUIA_API_TOKEN configurado."
  }
  Write-Log "[INFO] AGUIA_ALLOWED_ORIGINS=$AllowedOrigins"
  Write-Log "[INFO] Iniciando servidor em processo dedicado..."

  # Inicia diretamente via node para evitar encerramento precoce do wrapper do pnpm.
  $proc = Start-Process -FilePath "node" -ArgumentList @(".\\server\\index.mjs") -WorkingDirectory $repoRoot -PassThru
  if (-not $proc) {
    throw "Falha ao iniciar processo do servidor."
  }

  Write-Log "[INFO] Processo iniciado. PID=$($proc.Id)"

  $escutando = $false
  for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Milliseconds 500

    if ($proc.HasExited) {
      throw "Servidor encerrou logo apos iniciar. ExitCode=$($proc.ExitCode)."
    }

    $porta = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
      Where-Object { $_.OwningProcess -eq $proc.Id }

    if ($porta) {
      $escutando = $true
      break
    }
  }

  if (-not $escutando) {
    throw "Servidor iniciado, mas nao entrou em LISTENING na porta 3000 dentro do tempo esperado."
  }

  Write-Log "[SUCESSO] Servidor ativo em http://0.0.0.0:3000 (PID=$($proc.Id))."
  exit 0
} catch {
  Write-Log "[ERRO] $($_.Exception.Message)"
  Write-Log "[ERRO] Consulte este log para detalhes: $logFile"
  exit 1
}
