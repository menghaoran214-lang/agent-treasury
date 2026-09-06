[CmdletBinding()]
param(
    [string]$ProjectRoot,
    [int]$Port = 3333,
    [switch]$SkipCodexRegistration,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$runtimeDir = Join-Path $ProjectRoot '.runtime'
$sourceSkill = Join-Path $ProjectRoot 'skills\agent-treasury'
$targetSkill = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex\skills\agent-treasury'

Write-Host 'Agent Treasury installer - safe mock-payment setup'
$node = Get-Command node -ErrorAction Stop
$npm = Get-Command npm.cmd -ErrorAction Stop
$major = [int]((& $node.Source --version).TrimStart('v').Split('.')[0])
if ($major -lt 22) { throw 'Node.js 22 or newer is required.' }

Push-Location $ProjectRoot
try {
    & $node.Source -e "require('better-sqlite3'); require('typescript')" 2>$null
    if ($LASTEXITCODE -ne 0) {
        & $npm.Source ci
        if ($LASTEXITCODE -ne 0) { throw 'Root dependency installation failed.' }
    } else { Write-Host 'Root dependencies already ready.' }
    Push-Location (Join-Path $ProjectRoot 'apps\demo-ui')
    try {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'apps\demo-ui\node_modules\vite\bin\vite.js'))) {
            & $npm.Source ci
            if ($LASTEXITCODE -ne 0) { throw 'UI dependency installation failed.' }
        } else { Write-Host 'UI dependencies already ready.' }
        & $npm.Source run build
        if ($LASTEXITCODE -ne 0) { throw 'UI build failed.' }
    } finally { Pop-Location }
} finally { Pop-Location }

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
if (Test-Path -LiteralPath $targetSkill) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path $runtimeDir "skill-backup-$stamp"
    Copy-Item -LiteralPath $targetSkill -Destination $backup -Recurse
    Remove-Item -LiteralPath $targetSkill -Recurse -Force
}
New-Item -ItemType Directory -Path (Split-Path -Parent $targetSkill) -Force | Out-Null
Copy-Item -LiteralPath $sourceSkill -Destination $targetSkill -Recurse

if (-not $SkipCodexRegistration) {
    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if ($codex) {
        $savedPreference = $ErrorActionPreference
        $ErrorActionPreference = 'SilentlyContinue'
        try { & $codex.Source mcp get agent-treasury *> $null; $mcpExists = $LASTEXITCODE -eq 0 }
        finally { $ErrorActionPreference = $savedPreference }
        if ($mcpExists) { & $codex.Source mcp remove agent-treasury | Out-Null }
        & $codex.Source mcp add agent-treasury --url "http://127.0.0.1:$Port/mcp"
        if ($LASTEXITCODE -ne 0) { throw 'Codex MCP registration failed.' }
    } else {
        Write-Warning 'Codex CLI was not found; the Skill was installed but MCP registration was skipped.'
    }
}

& (Join-Path $PSScriptRoot 'service-control.ps1') -Action start -ProjectRoot $ProjectRoot -Port $Port
if ($LASTEXITCODE -ne 0) { throw 'Service startup failed.' }

Write-Host ''
Write-Host 'Installation complete.'
Write-Host "UI:  http://127.0.0.1:$Port"
Write-Host "MCP: http://127.0.0.1:$Port/mcp"
Write-Host 'Payment mode: mock (no real transfer)'
if (-not $NoOpen) { Start-Process "http://127.0.0.1:$Port" }
