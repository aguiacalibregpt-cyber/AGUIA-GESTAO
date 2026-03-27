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

  $cmdArgs = @('install')
  if (-not $IncludeDevDependencies) {
    $cmdArgs += '--prod'
  }

  for ($tentativa = 1; $tentativa -le 2; $tentativa++) {
    Write-Log "[INFO] Executando: pnpm $($cmdArgs -join ' ') (tentativa $tentativa/2)"
    & pnpm @cmdArgs
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

function Invoke-NpmInstallWithRetry {
  param(
    [switch]$IncludeDevDependencies
  )

  $cmdArgs = @('install', '--no-audit', '--no-fund')
  if (-not $IncludeDevDependencies) {
    $cmdArgs += '--omit=dev'
  }

  for ($tentativa = 1; $tentativa -le 2; $tentativa++) {
    Write-Log "[INFO] Executando: npm $($cmdArgs -join ' ') (tentativa $tentativa/2)"
    & npm @cmdArgs
    if ($LASTEXITCODE -eq 0) {
      return
    }

    if ($tentativa -eq 1) {
      Write-Log "[AVISO] npm install falhou (codigo $LASTEXITCODE). Tentando recuperacao automatica..."
      if (Test-Path "node_modules") {
        cmd /c "rmdir /s /q node_modules" | Out-Null
      }
      & npm cache verify | Out-Null
    }
  }

  throw "Falha no npm install apos tentativas de recuperacao."
}

Write-Log "============================================"
Write-Log "AGUIA - Inicializacao Segura do Servidor LAN"
Write-Log "============================================"
Write-Log "Pasta: $repoRoot"
Write-Log "Log: $logFile"

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  Write-Log "[ERRO] node nao encontrado. Instale Node.js LTS."
  exit 1
}

try {
  if ($repoRoot -match '\s') {
    Write-Log "[AVISO] Caminho com espacos detectado. Em alguns Windows/antivirus isso pode causar ENOENT no install."
  }

  $precisaBuild = -not (Test-Path "dist/index.html")
  $includeDevDependencies = $precisaBuild

  if ($pnpm -or $npm) {
    if (-not (Test-Path "node_modules")) {
      Write-Log "[INFO] Instalando dependencias..."
      if ($pnpm) {
        try {
          Invoke-PnpmInstallWithRetry -IncludeDevDependencies:$includeDevDependencies
        } catch {
          Write-Log "[AVISO] pnpm indisponivel/instavel nesta maquina: $($_.Exception.Message)"
          if ($npm) {
            Write-Log "[INFO] Alternando para npm install como fallback..."
            Invoke-NpmInstallWithRetry -IncludeDevDependencies:$includeDevDependencies
          } else {
            throw
          }
        }
      } elseif ($npm) {
        Invoke-NpmInstallWithRetry -IncludeDevDependencies:$includeDevDependencies
      }
    }

    if ($precisaBuild) {
      Write-Log "[INFO] Build nao encontrado. Gerando build..."
      if ($pnpm) {
        & pnpm build
        if ($LASTEXITCODE -eq 0) {
          $precisaBuild = $false
        } elseif ($npm) {
          Write-Log "[AVISO] pnpm build falhou (codigo $LASTEXITCODE). Tentando npm run build..."
          & npm run build
          if ($LASTEXITCODE -eq 0) {
            $precisaBuild = $false
          }
        }
      } elseif ($npm) {
        & npm run build
        if ($LASTEXITCODE -eq 0) {
          $precisaBuild = $false
        }
      }

      if ($precisaBuild) {
        throw "Falha ao gerar build com pnpm/npm."
      }
    }
  } elseif ($precisaBuild) {
    throw "Build nao encontrado em dist/index.html e pnpm/npm nao estao disponiveis para gerar build."
  }

  $tokenFinal = $ApiToken.Trim()
  if ([string]::IsNullOrWhiteSpace($tokenFinal)) {
    Write-Log "[INFO] AGUIA_API_TOKEN nao informado. Solicitando token para esta execucao..."
    $tokenFinal = (Read-Host "Informe AGUIA_API_TOKEN").Trim()
  }

  if ([string]::IsNullOrWhiteSpace($tokenFinal)) {
    throw "AGUIA_API_TOKEN nao informado. Modo bloqueado exige token explicito para iniciar."
  }

  $env:AGUIA_API_TOKEN = $tokenFinal
  $env:AGUIA_ALLOWED_ORIGINS = $AllowedOrigins

  if ([string]::IsNullOrWhiteSpace($env:AGUIA_API_TOKEN)) {
    Write-Log "[AVISO] AGUIA_API_TOKEN vazio. Auth API desabilitada para esta execucao."
  } else {
    Write-Log "[INFO] AGUIA_API_TOKEN configurado."
  }
  Write-Log "[INFO] AGUIA_ALLOWED_ORIGINS=$AllowedOrigins"
  Write-Log "[INFO] Iniciando servidor em processo dedicado..."

  # Verifica se a porta 3000 já está em uso antes de tentar iniciar.
  $portaEmUso = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($portaEmUso) {
    # OwningProcess pode ser 0 sem privilegios elevados; exibir 'desconhecido' nesse caso.
    $pidEmUso = if ($portaEmUso[0].OwningProcess -gt 0) { $portaEmUso[0].OwningProcess } else { 'desconhecido (execute como Administrador para ver o PID)' }
    Write-Log "[AVISO] Porta 3000 ja esta em uso (PID=$pidEmUso). O servidor pode ja estar em execucao."
    Write-Log "[AVISO] Finalize o servidor com PARAR-AGUIA-SERVIDOR.bat antes de reiniciar."
    exit 1
  }

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

    $todasPorta = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    $porta = $todasPorta | Where-Object { $_.OwningProcess -eq $proc.Id }
    # Fallback: sem privilegios elevados OwningProcess pode ser 0; se a porta abriu e ninguem mais
    # estava usando, assume que eh o processo que acabamos de iniciar.
    if (-not $porta -and $todasPorta) {
      $porta = $todasPorta
    }

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
