<#
.SYNOPSIS
  Gerencia um cluster PostgreSQL local, dedicado ao Vedas CRM.

.DESCRIPTION
  Cria um cluster isolado dentro do proprio repositorio (.localdb/), na porta
  55432, sem interferir em nenhum servico PostgreSQL ja instalado na maquina.
  Nao exige Docker.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/localdb.ps1 start
  powershell -ExecutionPolicy Bypass -File scripts/localdb.ps1 stop
  powershell -ExecutionPolicy Bypass -File scripts/localdb.ps1 reset
#>

param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'status', 'reset', 'psql')]
  [string]$Command = 'start',

  [int]$Port = 55432,
  [string]$DbUser = 'vedas',
  [string]$DbName = 'vedas'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $root '.localdb'
$logFile = Join-Path $root '.localdb.log'

function Get-PgBin {
  if ($env:PGBIN -and (Test-Path (Join-Path $env:PGBIN 'pg_ctl.exe'))) { return $env:PGBIN }

  $candidates = @()
  foreach ($base in @("$env:ProgramFiles\PostgreSQL", "${env:ProgramFiles(x86)}\PostgreSQL")) {
    if (Test-Path $base) {
      $candidates += Get-ChildItem $base -Directory |
        Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
        ForEach-Object { Join-Path $_.FullName 'bin' }
    }
  }

  $found = $candidates | Where-Object { Test-Path (Join-Path $_ 'pg_ctl.exe') } | Select-Object -First 1
  if ($found) { return $found }

  $inPath = Get-Command pg_ctl.exe -ErrorAction SilentlyContinue
  if ($inPath) { return Split-Path -Parent $inPath.Source }

  throw "PostgreSQL nao encontrado. Instale o PostgreSQL ou defina a variavel PGBIN apontando para a pasta bin."
}

$bin = Get-PgBin
$pgCtl = Join-Path $bin 'pg_ctl.exe'
$initDb = Join-Path $bin 'initdb.exe'
$createDb = Join-Path $bin 'createdb.exe'
$psql = Join-Path $bin 'psql.exe'

function Test-Running {
  & $pgCtl -D $dataDir status *> $null
  return $LASTEXITCODE -eq 0
}

function Initialize-Cluster {
  if (Test-Path (Join-Path $dataDir 'PG_VERSION')) { return }
  Write-Host "[localdb] criando cluster em $dataDir ..."
  Start-Process -FilePath $initDb -NoNewWindow -Wait -ArgumentList @(
    '-D', "`"$dataDir`"", '-U', $DbUser, '--auth=trust', '--encoding=UTF8'
  )
  Write-Host "[localdb] cluster criado"
}

function Start-Cluster {
  Initialize-Cluster
  if (Test-Running) {
    Write-Host "[localdb] ja esta rodando na porta $Port"
  }
  else {
    # O servidor herda os handles de console de quem o inicia; sem redirecionar
    # a saida, o terminal fica preso ate o Postgres encerrar. Por isso as tres
    # saidas vao para arquivo.
    $startLog = "$logFile.start"
    Start-Process -FilePath $pgCtl -NoNewWindow -Wait `
      -RedirectStandardOutput $startLog -RedirectStandardError "$startLog.err" `
      -ArgumentList @(
      '-D', "`"$dataDir`"",
      '-o', "`"-p $Port -c listen_addresses=127.0.0.1`"",
      '-l', "`"$logFile`"",
      'start'
    )
    Start-Sleep -Seconds 2
  }

  $exists = & $psql -h 127.0.0.1 -p $Port -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
  if (-not $exists) {
    & $createDb -h 127.0.0.1 -p $Port -U $DbUser $DbName
    Write-Host "[localdb] banco '$DbName' criado"
  }

  Write-Host ""
  Write-Host "  Postgres local pronto."
  Write-Host "  DATABASE_URL=postgres://$DbUser@127.0.0.1:$Port/$DbName"
  Write-Host ""
}

function Stop-Cluster {
  if (Test-Running) {
    Start-Process -FilePath $pgCtl -NoNewWindow -Wait -ArgumentList @(
      '-D', "`"$dataDir`"", '-m', 'fast', 'stop'
    )
    Write-Host "[localdb] parado"
  }
  else {
    Write-Host "[localdb] nao estava rodando"
  }
}

switch ($Command) {
  'start' { Start-Cluster }
  'stop' { Stop-Cluster }
  'status' {
    if (Test-Running) { Write-Host "[localdb] rodando na porta $Port" } else { Write-Host "[localdb] parado" }
  }
  'reset' {
    Stop-Cluster
    if (Test-Path $dataDir) { Remove-Item -Recurse -Force $dataDir }
    Write-Host "[localdb] dados apagados"
    Start-Cluster
  }
  'psql' { & $psql -h 127.0.0.1 -p $Port -U $DbUser -d $DbName }
}
