[CmdletBinding()]
param(
    [string]$ProjectRoot,
    [int]$Port = 3333
)

$ErrorActionPreference = 'Continue'
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$targetSkill = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex\skills\agent-treasury\SKILL.md'

$nodeVersion = if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { 'missing' }
$npmVersion = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { npm.cmd --version } else { 'missing' }
$service = & (Join-Path $PSScriptRoot 'service-control.ps1') -Action status -ProjectRoot $ProjectRoot -Port $Port 2>$null
$codexState = 'not installed'
if (Get-Command codex -ErrorAction SilentlyContinue) {
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try { codex mcp get agent-treasury *> $null; $codexFound = $LASTEXITCODE -eq 0 }
    finally { $ErrorActionPreference = $savedPreference }
    $codexState = if ($codexFound) { 'registered' } else { 'not registered' }
}

[pscustomobject]@{
    project = $ProjectRoot
    node = $nodeVersion
    npm = $npmVersion
    ui_built = Test-Path -LiteralPath (Join-Path $ProjectRoot 'apps\demo-ui\dist\index.html')
    skill_installed = Test-Path -LiteralPath $targetSkill
    codex_mcp = $codexState
    service = $service
}
