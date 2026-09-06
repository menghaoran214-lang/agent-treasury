[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'status')]
    [string]$Action = 'status',
    [string]$ProjectRoot,
    [int]$Port = 3333
)

$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$runtimeDir = Join-Path $ProjectRoot '.runtime'
$pidFile = Join-Path $runtimeDir 'agent-treasury.pid'
$stdoutLog = Join-Path $runtimeDir 'service.log'
$stderrLog = Join-Path $runtimeDir 'service-error.log'
$healthUrl = "http://127.0.0.1:$Port/health"

function Get-ManagedProcess {
    if (-not (Test-Path -LiteralPath $pidFile)) { return $null }
    $storedPid = [int](Get-Content -LiteralPath $pidFile -Raw)
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $storedPid" -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
        return $null
    }
    if ($process.CommandLine -notmatch 'unifiedService\.ts') {
        throw "PID $storedPid no longer belongs to Agent Treasury; refusing to manage it."
    }
    return $process
}

function Test-Health {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
        return $response.status -eq 'ok'
    } catch { return $false }
}

if ($Action -eq 'status') {
    $process = Get-ManagedProcess
    [pscustomobject]@{
        running = [bool]$process
        healthy = Test-Health
        pid = if ($process) { $process.ProcessId } else { $null }
        url = "http://127.0.0.1:$Port"
        payment_mode = 'mock'
    }
    exit $(if ($process -and (Test-Health)) { 0 } else { 1 })
}

if ($Action -eq 'stop') {
    $process = Get-ManagedProcess
    if ($process) {
        Stop-Process -Id $process.ProcessId -Force
        for ($i = 0; $i -lt 30 -and (Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue); $i++) {
            Start-Sleep -Milliseconds 100
        }
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host 'Agent Treasury service stopped.'
    exit 0
}

$existing = Get-ManagedProcess
if ($existing -and (Test-Health)) {
    Write-Host "Agent Treasury is already running at http://127.0.0.1:$Port"
    exit 0
}
if ($existing) { throw 'Agent Treasury process exists but is unhealthy. Run uninstall or stop before retrying.' }

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $ProjectRoot 'data') -Force | Out-Null
$node = Get-Command node -ErrorAction Stop
$previous = @{
    TREASURY_PORT = $env:TREASURY_PORT
    TREASURY_DB_PATH = $env:TREASURY_DB_PATH
    TREASURY_PAYMENT_MODE = $env:TREASURY_PAYMENT_MODE
}
try {
    $env:TREASURY_PORT = [string]$Port
    $env:TREASURY_DB_PATH = Join-Path $ProjectRoot 'data\treasury.db'
    $env:TREASURY_PAYMENT_MODE = 'mock'
    $process = Start-Process -FilePath $node.Source `
        -ArgumentList @('--import', 'tsx', 'src/server/unifiedService.ts') `
        -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
} finally {
    $env:TREASURY_PORT = $previous.TREASURY_PORT
    $env:TREASURY_DB_PATH = $previous.TREASURY_DB_PATH
    $env:TREASURY_PAYMENT_MODE = $previous.TREASURY_PAYMENT_MODE
}
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii

for ($i = 0; $i -lt 60; $i++) {
    if (Test-Health) {
        Write-Host "Agent Treasury started: http://127.0.0.1:$Port"
        exit 0
    }
    if ($process.HasExited) { break }
    Start-Sleep -Milliseconds 500
}
throw "Agent Treasury failed to become healthy. Check $stderrLog"
